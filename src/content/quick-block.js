// ============================================================
// CC98 Filter - 页内快捷屏蔽（Quick Block）
// 核心交互：看见 -> 点一下 -> 屏蔽（可撤销）
// 悬停帖子/回复/热榜项时浮出 ⛔ 按钮，点击弹出屏蔽菜单
// ============================================================
(function (global) {
  'use strict';

  const HOST_SELECTOR = '.card-topic, .focus-topic, .reply, .mainPageListRow';
  let btn = null;
  let menu = null;
  let currentHost = null;
  let currentItem = null;
  let hideTimer = null;

  function createButton() {
    btn = document.createElement('div');
    btn.className = 'cc98f-quickbtn';
    btn.textContent = '⛔';
    btn.title = 'CC98 Filter 快捷屏蔽';
    document.body.appendChild(btn);

    btn.addEventListener('mouseenter', function () {
      clearTimeout(hideTimer);
    });
    btn.addEventListener('mouseleave', scheduleHide);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openMenu();
    });
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (btn) btn.classList.remove('cc98f-show');
      closeMenu();
    }, 250);
  }

  function positionButton(host) {
    const rect = host.getBoundingClientRect();
    btn.style.left = Math.max(4, rect.right + window.scrollX - 26) + 'px';
    btn.style.top = Math.max(4, rect.top + window.scrollY + 6) + 'px';
    btn.classList.add('cc98f-show');
  }

  // ---------- 快捷菜单 ----------

  function closeMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
  }

  function addMenuItem(label, onClick) {
    const item = document.createElement('div');
    item.className = 'cc98f-quickmenu-item';
    item.textContent = label;
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      closeMenu();
      btn.classList.remove('cc98f-show');
      onClick();
    });
    menu.appendChild(item);
  }

  function openMenu() {
    closeMenu();
    if (!currentHost || !currentItem) return;

    menu = document.createElement('div');
    menu.className = 'cc98f-quickmenu';

    const item = currentItem;

    if (item.username) {
      addMenuItem('屏蔽用户「' + item.username + '」', function () {
        block('user', item.username);
      });
    }
    if (item.board) {
      addMenuItem('屏蔽版块「' + item.board + '」', function () {
        block('board', item.board);
      });
    }
    // 关键词：默认取标题前 12 个字
    const suggest = (item.text || '').slice(0, 12).trim();
    addMenuItem('屏蔽关键词…', function () {
      const kw = prompt('输入要屏蔽的关键词（标题/正文包含即命中）:', suggest);
      if (kw && kw.trim()) block('keyword', kw.trim());
    });
    addMenuItem('屏蔽动作：切换 隐藏/折叠/模糊', function () {
      const actions = ['hide', 'collapse', 'blur', 'replace'];
      const names = { hide: '隐藏', collapse: '折叠', blur: '模糊', replace: '替换' };
      const pick = prompt(
        '选择默认屏蔽动作：\n' +
        actions.map(function (a, i) { return (i + 1) + '. ' + names[a]; }).join('\n') +
        '\n输入序号 (1-4):', '1');
      const idx = parseInt(pick, 10);
      if (idx >= 1 && idx <= 4) {
        localStorage.setItem('cc98f_default_action', actions[idx - 1]);
        toast('默认动作已设为「' + names[actions[idx - 1]] + '」');
      }
    });

    const rect = currentHost.getBoundingClientRect();
    menu.style.left = Math.max(4, rect.right + window.scrollX - 200) + 'px';
    menu.style.top = (rect.top + window.scrollY + 32) + 'px';
    document.body.appendChild(menu);
  }

  async function block(type, pattern) {
    const action = localStorage.getItem('cc98f_default_action') || 'hide';
    const result = await global.CC98FStore.addRule(type, pattern, { action: action });
    const label = type === 'user' ? '用户' : type === 'board' ? '版块' : '关键词';
    if (result.created) {
      toast('已屏蔽' + label + '「' + pattern + '」', async function () {
        await global.CC98FStore.removeRule(result.rule.id);
        toast('已撤销屏蔽');
      });
    } else {
      toast(label + '「' + pattern + '」已在规则中，已重新启用');
    }
  }

  // ---------- 撤销 toast ----------

  function toast(msg, undoFn) {
    const old = document.querySelector('.cc98f-toast');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'cc98f-toast';
    const text = document.createElement('span');
    text.textContent = msg;
    el.appendChild(text);

    if (undoFn) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'cc98f-toast-undo';
      undoBtn.textContent = '撤销';
      undoBtn.addEventListener('click', function () {
        undoFn();
        el.remove();
      });
      el.appendChild(undoBtn);
    }

    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, undoFn ? 6000 : 2500);
  }

  // ---------- 事件绑定 ----------

  function init() {
    if (!document.body) return;
    createButton();

    document.addEventListener('mouseover', function (e) {
      const host = e.target.closest && e.target.closest(HOST_SELECTOR);
      if (!host || host === currentHost) return;
      if (host.closest('.cc98f-ph, .cc98f-quickmenu')) return;

      currentHost = host;
      currentItem = extractItem(host);
      clearTimeout(hideTimer);
      closeMenu();
      positionButton(host);
    });

    document.addEventListener('mouseout', function (e) {
      if (!currentHost) return;
      const to = e.relatedTarget;
      if (to && (to.closest('.cc98f-quickbtn') || to.closest('.cc98f-quickmenu'))) return;
      if (to && currentHost.contains(to)) return;
      if (e.target.closest && e.target.closest(HOST_SELECTOR)) scheduleHide();
    });

    // 模糊内容的点击展开
    document.addEventListener('click', function (e) {
      const blurred = e.target.closest && e.target.closest('.cc98f-blurred');
      if (blurred) {
        e.preventDefault();
        e.stopPropagation();
        global.CC98FRenderer.toggleReveal(blurred);
      }
    }, true);
  }

  function extractItem(host) {
    // 复用 Adapter 提取逻辑
    for (let i = 0; i < global.CC98FAdapters.ADAPTERS.length; i++) {
      const adapter = global.CC98FAdapters.ADAPTERS[i];
      if (host.matches(adapter.selector)) return adapter.extract(host);
    }
    return null;
  }

  global.CC98FQuickBlock = { init: init, toast: toast, block: block };
})(globalThis);
