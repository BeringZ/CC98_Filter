// ============================================================
// CC98 Filter - DOM 适配层（Adapter）
// 职责：把 CC98 各种页面元素归一化为统一 ContentItem
//       { kind, username, board, text }
// CC98 改版时只需要修这个文件里的 selector / extract
// ============================================================
(function (global) {
  'use strict';

  function firstText(el, selectors) {
    for (let i = 0; i < selectors.length; i++) {
      const found = el.querySelector(selectors[i]);
      if (found) return found.textContent.trim();
    }
    return null;
  }

  function cleanBoardName(name) {
    if (!name) return null;
    name = name.trim();
    if (name.length >= 2 && name[0] === '[' && name[name.length - 1] === ']') {
      name = name.slice(1, -1).trim();
    }
    return name || null;
  }

  const ADAPTERS = [
    // ---------- 热榜 / 主页列表行 ----------
    {
      kind: 'hot',
      selector: '.mainPageListRow',
      extract: function (el) {
        const board = cleanBoardName(firstText(el, ['.mainPageListBoardName a', '.mainPageListBoardName']));
        const title = firstText(el, ['.mainPageListTitle']) || el.textContent.trim();
        return { kind: 'hot', username: null, board: board, text: title };
      }
    },
    // ---------- 帖子卡片（新旧两版首页 / 版块列表） ----------
    {
      kind: 'topic',
      selector: '.card-topic, .focus-topic',
      extract: function (el) {
        const username = firstText(el, ['.card-topic-userName', '.focus-topic-userName']);
        const board = cleanBoardName(firstText(el, ['.card-topic-boardName a', '.card-topic-boardName', '.focus-topic-board']));
        const title = firstText(el, ['.card-topic-title', '.focus-topic-title']) || '';
        return { kind: 'topic', username: username, board: board, text: title };
      }
    },
    // ---------- 帖子内回复 ----------
    {
      kind: 'reply',
      selector: '.reply',
      extract: function (el) {
        const username = firstText(el, ['.userMessage-userName']);
        const content = firstText(el, ['.substance']) || '';
        return { kind: 'reply', username: username, board: null, text: content };
      }
    },
    // ---------- 私信联系人列表 ----------
    {
      kind: 'contact',
      selector: '.message-message-person',
      extract: function (el) {
        const username = firstText(el, ['.message-message-pName']);
        const preview = firstText(el, ['.message-message-pMessage']) || '';
        return { kind: 'contact', username: username, board: null, text: preview };
      }
    },
    // ---------- 私信聊天窗口 ----------
    {
      kind: 'messageWindow',
      selector: '.message-message-window',
      extract: function (el) {
        const title = firstText(el, ['.message-message-wTitle']) || '';
        const m = title.match(/与\s+(.+?)\s+的私信/);
        return { kind: 'messageWindow', username: m ? m[1] : null, board: null, text: title };
      }
    }
  ];

  // 在 root 范围内收集所有待处理元素
  // root 可以是 Element / Document / DocumentFragment / 文本节点(取其父元素)
  // 返回 [{ el, adapter, item }]
  function collect(root) {
    const results = [];
    if (!root) return results;
    if (root.nodeType === 3) root = root.parentElement; // 文本节点 -> 父元素
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11)) return results;

    ADAPTERS.forEach(function (adapter) {
      // root 自身命中 selector 的情况（增量处理时 root 就是单个节点）
      if (root.matches && root.matches(adapter.selector)) {
        results.push({ el: root, adapter: adapter, item: adapter.extract(root) });
      }
      root.querySelectorAll(adapter.selector).forEach(function (el) {
        results.push({ el: el, adapter: adapter, item: adapter.extract(el) });
      });
    });

    return results;
  }

  // 判断节点是否与过滤逻辑相关（用于 MutationObserver 预筛）
  function looksRelevant(node) {
    if (!node) return false;
    if (node.nodeType === 3) node = node.parentElement; // 文本节点 -> 父元素
    if (!node || node.nodeType !== 1) return false;
    if (node.closest && node.closest('.cc98f-ph, .cc98f-quickbtn, .cc98f-toast')) return false;
    for (let i = 0; i < ADAPTERS.length; i++) {
      const sel = ADAPTERS[i].selector;
      if (node.matches && node.matches(sel)) return true;
      if (node.querySelector && node.querySelector(sel)) return true;
    }
    return false;
  }

  global.CC98FAdapters = {
    ADAPTERS: ADAPTERS,
    collect: collect,
    looksRelevant: looksRelevant
  };
})(globalThis);
