// ============================================================
// CC98 Filter - Popup（轻量：高频快捷操作）
// 完整规则管理在 Options Page
// ============================================================
(function () {
  'use strict';

  const Store = globalThis.CC98FStore;
  const RECENT_COUNT = 5;
  const TYPE_NAMES = { user: '用户', keyword: '关键词', board: '版块' };

  const masterSwitch = document.getElementById('masterSwitch');
  const addType = document.getElementById('addType');
  const addInput = document.getElementById('addInput');
  const recentList = document.getElementById('recentList');
  const pageStats = document.getElementById('pageStats');
  const manageBtn = document.getElementById('manageBtn');

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------- 本页统计 ----------
  async function loadPageStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('cc98.org')) {
        pageStats.textContent = '当前页面不是 CC98';
        return;
      }
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'cc98f-get-stats' });
      if (resp) {
        pageStats.textContent = resp.enabled
          ? '本页已过滤 ' + resp.filteredCount + ' 条内容'
          : '过滤已关闭';
      }
    } catch (e) {
      pageStats.textContent = '本页统计不可用（刷新页面试试）';
    }
  }

  // ---------- 渲染最近规则 ----------
  async function renderRecent() {
    const rules = await Store.loadRules();
    const recent = rules
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, RECENT_COUNT);

    if (recent.length === 0) {
      recentList.innerHTML = '<div class="empty">暂无规则，上方可快速添加</div>';
      return;
    }

    recentList.innerHTML = recent.map(function (rule) {
      return '<div class="rule-item" data-id="' + escapeHtml(rule.id) + '">' +
        '<span class="rule-type">' + TYPE_NAMES[rule.type] + '</span>' +
        '<span class="rule-pattern" title="' + escapeHtml(rule.pattern) + '">' +
        escapeHtml(rule.pattern) + '</span>' +
        '<label class="switch"><input type="checkbox" class="rule-toggle" ' +
        (rule.enabled ? 'checked' : '') + '><span class="slider"></span></label>' +
        '<button class="rule-del" title="删除规则">×</button>' +
        '</div>';
    }).join('');

    recentList.querySelectorAll('.rule-item').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelector('.rule-toggle').addEventListener('change', function (e) {
        Store.toggleRule(id, e.target.checked);
      });
      row.querySelector('.rule-del').addEventListener('click', function () {
        Store.removeRule(id);
      });
    });
  }

  // storage 变化时刷新列表（options 页改动也能同步过来）
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes[Store.RULES_KEY]) renderRecent();
  });

  // ---------- 事件 ----------
  masterSwitch.addEventListener('change', function () {
    Store.saveEnabled(masterSwitch.checked);
  });

  async function handleAdd() {
    const value = addInput.value.trim();
    if (!value) return;
    await Store.addRule(addType.value, value);
    addInput.value = '';
    renderRecent();
  }

  addInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') handleAdd();
  });

  // select 切换时更新 placeholder
  addType.addEventListener('change', function () {
    addInput.placeholder = '输入' + TYPE_NAMES[addType.value] + '，回车添加';
  });

  manageBtn.addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });

  // ---------- 初始化 ----------
  (async function init() {
    masterSwitch.checked = await Store.loadEnabled();
    await renderRecent();
    loadPageStats();
  })();
})();
