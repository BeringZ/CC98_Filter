// ============================================================
// CC98 Filter - 可逆渲染层（Renderer）
// 原则：永不修改/删除原始内容，只加 class + 插入 placeholder
//       解除屏蔽 = 移除 class + 移除 placeholder，天然可恢复
// 动作：hide（隐藏）/ collapse（折叠）/ blur（模糊）/ replace（替换文案）
// ============================================================
(function (global) {
  'use strict';

  let uid = 0;

  const STYLE_ID = 'cc98f-style';
  const CSS = [
    '.cc98f-hidden { display: none !important; }',
    '.cc98f-blurred { filter: blur(6px); cursor: pointer; }',
    '.cc98f-blurred:hover { filter: blur(4px); }',
    '.cc98f-blurred.cc98f-revealed { filter: none; }',
    '.cc98f-ph {',
    '  display: flex; align-items: center; gap: 8px;',
    '  padding: 6px 12px; margin: 4px 0;',
    '  border: 1px dashed rgba(128,128,128,.45); border-radius: 6px;',
    '  font-size: 12px; color: #888;',
    '  background: rgba(128,128,128,.08);',
    '  user-select: none;',
    '}',
    '.cc98f-ph-icon { flex: none; opacity: .7; }',
    '.cc98f-ph-reason { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.cc98f-ph-btn {',
    '  flex: none; border: 1px solid rgba(128,128,128,.5); border-radius: 4px;',
    '  background: transparent; color: inherit; font-size: 12px;',
    '  padding: 2px 8px; cursor: pointer;',
    '}',
    '.cc98f-ph-btn:hover { background: rgba(128,128,128,.15); }',
    /* 页内快捷屏蔽按钮 */
    '.cc98f-quickbtn {',
    '  position: absolute; z-index: 99990;',
    '  width: 24px; height: 24px; line-height: 24px; text-align: center;',
    '  border-radius: 50%; background: rgba(30,30,30,.78); color: #fff;',
    '  font-size: 13px; cursor: pointer; opacity: 0;',
    '  transition: opacity .12s; box-shadow: 0 2px 8px rgba(0,0,0,.3);',
    '  pointer-events: auto;',
    '}',
    '.cc98f-quickbtn.cc98f-show { opacity: 1; }',
    '.cc98f-quickmenu {',
    '  position: absolute; z-index: 99991;',
    '  background: #fff; color: #333; border: 1px solid rgba(0,0,0,.15);',
    '  border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.18);',
    '  padding: 4px; min-width: 180px; font-size: 13px;',
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  .cc98f-quickmenu { background: #2a2a2a; color: #ddd; border-color: rgba(255,255,255,.15); }',
    '  .cc98f-quickmenu-item:hover { background: rgba(255,255,255,.1); }',
    '}',
    '.cc98f-quickmenu-item { padding: 7px 12px; border-radius: 5px; cursor: pointer; white-space: nowrap; }',
    '.cc98f-quickmenu-item:hover { background: rgba(0,0,0,.08); }',
    /* 撤销 toast */
    '.cc98f-toast {',
    '  position: fixed; z-index: 99999; left: 50%; bottom: 32px;',
    '  transform: translateX(-50%);',
    '  display: flex; align-items: center; gap: 12px;',
    '  background: rgba(30,30,30,.92); color: #fff;',
    '  padding: 10px 18px; border-radius: 8px; font-size: 13px;',
    '  box-shadow: 0 4px 16px rgba(0,0,0,.3);',
    '  animation: cc98f-toast-in .2s ease-out;',
    '}',
    '@keyframes cc98f-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }',
    '.cc98f-toast-undo {',
    '  border: 1px solid rgba(255,255,255,.5); border-radius: 4px;',
    '  background: transparent; color: #fff; font-size: 13px;',
    '  padding: 3px 10px; cursor: pointer;',
    '}',
    '.cc98f-toast-undo:hover { background: rgba(255,255,255,.15); }'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.documentElement.appendChild(style);
  }

  // ---------- placeholder ----------

  function actionLabel(rule) {
    if (rule.action === 'collapse') return '已折叠';
    if (rule.action === 'replace' && rule.replacement) return rule.replacement;
    return '已过滤';
  }

  function reasonText(rule, item) {
    if (rule.type === 'user') return '用户规则 · ' + rule.pattern;
    if (rule.type === 'board') return '版块规则 · ' + rule.pattern;
    return '关键词 "' + rule.pattern + '"';
  }

  function ensurePlaceholder(el, rule, item) {
    const id = el.dataset.cc98fId;
    let ph = el.previousElementSibling;
    if (ph && ph.classList.contains('cc98f-ph') && ph.dataset.cc98fFor === id) {
      // 已存在，仅更新文案
      ph.querySelector('.cc98f-ph-reason').textContent =
        actionLabel(rule) + ' · ' + reasonText(rule, item);
      return;
    }
    removePlaceholder(el);
    ph = document.createElement('div');
    ph.className = 'cc98f-ph';
    ph.dataset.cc98fFor = id;
    ph.dataset.cc98fRuleId = rule.id;

    const icon = document.createElement('span');
    icon.className = 'cc98f-ph-icon';
    icon.textContent = '⛔';
    const reason = document.createElement('span');
    reason.className = 'cc98f-ph-reason';
    reason.textContent = actionLabel(rule) + ' · ' + reasonText(rule, item);
    const btn = document.createElement('button');
    btn.className = 'cc98f-ph-btn';
    btn.textContent = '临时查看';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleReveal(el);
    });

    ph.appendChild(icon);
    ph.appendChild(reason);
    ph.appendChild(btn);
    el.parentNode.insertBefore(ph, el);
  }

  function removePlaceholder(el) {
    const id = el.dataset.cc98fId;
    if (!id) return;
    const ph = el.previousElementSibling;
    if (ph && ph.classList.contains('cc98f-ph') && ph.dataset.cc98fFor === id) {
      ph.remove();
    }
    el.classList.remove('cc98f-revealed');
  }

  // ---------- 展开 / 收起 ----------

  function toggleReveal(el) {
    if (el.classList.contains('cc98f-blurred')) {
      el.classList.toggle('cc98f-revealed');
      return;
    }
    const revealed = el.classList.toggle('cc98f-revealed');
    if (revealed) {
      el.classList.remove('cc98f-hidden');
      const ph = el.previousElementSibling;
      if (ph && ph.classList.contains('cc98f-ph')) {
        ph.querySelector('.cc98f-ph-btn').textContent = '收起';
      }
    } else {
      el.classList.add('cc98f-hidden');
      const ph = el.previousElementSibling;
      if (ph && ph.classList.contains('cc98f-ph')) {
        ph.querySelector('.cc98f-ph-btn').textContent = '临时查看';
      }
    }
  }

  // ---------- 应用 / 恢复 ----------

  // 对 el 应用规则（幂等：同一规则重复调用无副作用）
  function apply(el, rule, item) {
    if (!el.dataset.cc98fId) {
      uid += 1;
      el.dataset.cc98fId = String(uid);
    }
    el.classList.add('cc98f-filtered');
    el.dataset.cc98fRuleId = rule.id;

    if (rule.action === 'blur') {
      el.classList.remove('cc98f-hidden');
      el.classList.add('cc98f-blurred');
      removePlaceholder(el);
      el.title = '已模糊 · 关键词 "' + rule.pattern + '"，点击临时查看';
    } else {
      el.classList.remove('cc98f-blurred', 'cc98f-revealed');
      el.classList.add('cc98f-hidden');
      ensurePlaceholder(el, rule, item);
    }
  }

  // 完全恢复元素原始状态
  function reset(el) {
    el.classList.remove('cc98f-filtered', 'cc98f-hidden', 'cc98f-blurred', 'cc98f-revealed');
    el.classList.remove('cc98f-revealed');
    removePlaceholder(el);
    delete el.dataset.cc98fRuleId;
    el.removeAttribute('title');
  }

  global.CC98FRenderer = {
    injectStyle: injectStyle,
    apply: apply,
    reset: reset,
    toggleReveal: toggleReveal
  };
})(globalThis);
