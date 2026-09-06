// ============================================================
// CC98 Filter - Options Page（完整规则管理）
// 标签筛选 / 搜索 / 新建 / 动作切换 / 启停 / 删除 / 导入导出 / 清空
// ============================================================
(function () {
  'use strict';

  const Store = globalThis.CC98FStore;
  const TYPE_NAMES = { user: '用户', keyword: '关键词', board: '版块' };
  const ACTION_NAMES = { hide: '隐藏', collapse: '折叠', blur: '模糊', replace: '替换' };

  let currentType = 'all';
  let searchKeyword = '';
  let rulesCache = [];

  const $ = function (id) { return document.getElementById(id); };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleDateString('zh-CN') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  // ---------- 渲染 ----------

  async function refresh() {
    rulesCache = await Store.loadRules();
    renderTable();
  }

  function visibleRules() {
    return rulesCache
      .filter(function (r) { return currentType === 'all' || r.type === currentType; })
      .filter(function (r) {
        if (!searchKeyword) return true;
        return r.pattern.toLowerCase().indexOf(searchKeyword) >= 0;
      })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  function renderTable() {
    const tbody = $('ruleTableBody');
    const list = visibleRules();
    $('emptyHint').style.display = list.length === 0 ? 'block' : 'none';
    tbody.innerHTML = list.map(function (rule) {
      return '<tr data-id="' + escapeHtml(rule.id) + '">' +
        '<td class="rule-pattern-cell" title="' + escapeHtml(rule.pattern) + '">' +
        escapeHtml(rule.pattern) + '</td>' +
        '<td><span class="type-badge">' + TYPE_NAMES[rule.type] + '</span></td>' +
        '<td><select class="action-select">' +
        Object.keys(ACTION_NAMES).map(function (a) {
          return '<option value="' + a + '"' + (rule.action === a ? ' selected' : '') + '>' +
            ACTION_NAMES[a] + '</option>';
        }).join('') +
        '</select></td>' +
        '<td><label class="switch"><input type="checkbox" class="rule-toggle" ' +
        (rule.enabled ? 'checked' : '') + '><span class="slider"></span></label></td>' +
        '<td class="time-cell">' + formatDate(rule.updatedAt) + '</td>' +
        '<td><button class="rule-del" title="删除规则">×</button></td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('tr').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelector('.rule-toggle').addEventListener('change', function (e) {
        Store.toggleRule(id, e.target.checked);
      });
      row.querySelector('.action-select').addEventListener('change', function (e) {
        Store.updateRule(id, { action: e.target.value });
      });
      row.querySelector('.rule-del').addEventListener('click', function () {
        Store.removeRule(id);
      });
    });
  }

  // ---------- 添加规则 ----------

  $('addAction').addEventListener('change', function () {
    $('addReplacement').style.display =
      $('addAction').value === 'replace' ? 'block' : 'none';
  });

  async function handleAdd() {
    const pattern = $('addPattern').value.trim();
    if (!pattern) { $('addPattern').focus(); return; }
    await Store.addRule($('addType').value, pattern, {
      action: $('addAction').value,
      replacement: $('addReplacement').value.trim()
    });
    $('addPattern').value = '';
    $('addReplacement').value = '';
  }

  $('addBtn').addEventListener('click', handleAdd);
  $('addPattern').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') handleAdd();
  });
  $('addReplacement').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') handleAdd();
  });

  // ---------- 筛选 / 搜索 ----------

  $('typeTabs').addEventListener('click', function (e) {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    currentType = tab.dataset.type;
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t === tab);
    });
    renderTable();
  });

  $('searchInput').addEventListener('input', function (e) {
    searchKeyword = e.target.value.trim().toLowerCase();
    renderTable();
  });

  // ---------- 总开关 ----------

  $('masterSwitch').addEventListener('change', function (e) {
    Store.saveEnabled(e.target.checked);
  });

  // ---------- 导入 / 导出 / 清空 ----------

  $('exportBtn').addEventListener('click', async function () {
    const data = Store.buildExport(await Store.loadRules(), await Store.loadEnabled());
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cc98_filter_backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });

  $('importBtn').addEventListener('click', function () {
    $('importFile').click();
  });

  $('importFile').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const parsed = Store.parseImport(e.target.result);
        const merge = confirm(
          '解析成功：共 ' + parsed.rules.length + ' 条规则（' +
          (parsed.mode === 'v1' ? '旧版格式，已自动迁移' : 'v2 格式') + '）\n\n' +
          '选择「确定」= 合并（保留现有规则）\n' +
          '选择「取消」= 覆盖（替换全部规则）');
        if (merge) {
          const existing = await Store.loadRules();
          const seen = new Set(existing.map(function (r) { return r.id; }));
          let added = 0;
          for (const rule of parsed.rules) {
            if (!seen.has(rule.id)) {
              existing.push(rule);
              seen.add(rule.id);
              added += 1;
            }
          }
          await Store.saveRules(existing);
          alert('合并完成，新增 ' + added + ' 条规则');
        } else {
          await Store.saveRules(parsed.rules);
          await Store.saveEnabled(parsed.enabled);
          alert('覆盖完成，导入 ' + parsed.rules.length + ' 条规则');
        }
        refresh();
      } catch (err) {
        alert('导入失败：' + err.message);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  $('clearBtn').addEventListener('click', async function () {
    if (!confirm('确定要清空全部 ' + rulesCache.length + ' 条规则吗？此操作不可撤销！')) return;
    if (!confirm('再次确认：真的要清空全部规则吗？建议先导出备份。')) return;
    await Store.saveRules([]);
  });

  // ---------- storage 同步 / 初始化 ----------

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes[Store.RULES_KEY]) refresh();
  });

  (async function init() {
    $('masterSwitch').checked = await Store.loadEnabled();
    await refresh();
  })();
})();
