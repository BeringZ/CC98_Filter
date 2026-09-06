// ============================================================
// CC98 Filter - Content Script 主入口
// 数据流：CC98 DOM -> Adapter 提取 ContentItem -> RuleEngine 匹配
//         -> Renderer 可逆渲染
// 规则同步：不再依赖消息通信（v0.3 的 action 名错位 bug），
//           统一走 chrome.storage.onChanged，任何上下文改规则即时生效
// ============================================================
(function (global) {
  'use strict';

  const Store = global.CC98FStore;
  const Adapters = global.CC98FAdapters;
  const Renderer = global.CC98FRenderer;

  const REPROCESS_DEBOUNCE = 80;

  class CC98Filter {
    constructor() {
      this.rules = [];
      this.enabled = true;
      this.observer = null;
      this.reprocessTimer = null;
    }

    async init() {
      Renderer.injectStyle();
      this.rules = await Store.loadRules();
      this.enabled = await Store.loadEnabled();

      // 规则 / 开关变化：storage.onChanged 驱动，全上下文一致
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        if (changes[Store.RULES_KEY]) {
          this.rules = changes[Store.RULES_KEY].newValue || [];
          this.scheduleReprocessAll();
        }
        if (changes[Store.ENABLED_KEY]) {
          this.enabled = changes[Store.ENABLED_KEY].newValue !== false;
          this.scheduleReprocessAll();
        }
      }.bind(this));

      // popup 查询本页统计
      chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request && request.type === 'cc98f-get-stats') {
          sendResponse({
            enabled: this.enabled,
            filteredCount: document.querySelectorAll('.cc98f-filtered').length
          });
        }
        return false;
      }.bind(this));

      this.startObserver();
      this.process(document);
      global.CC98FQuickBlock.init();

      console.log('[CC98 Filter] 初始化完成，规则数:', this.rules.length);
    }

    // ---------- MutationObserver：增量处理 ----------

    startObserver() {
      this.observer = new MutationObserver((mutations) => {
        const roots = [];
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (Adapters.looksRelevant(node)) roots.push(node);
          }
        }
        if (roots.length === 0) return;
        clearTimeout(this.reprocessTimer);
        this.reprocessTimer = setTimeout(() => {
          roots.forEach((root) => this.process(root));
        }, REPROCESS_DEBOUNCE);
      });

      this.observer.observe(document.body, { childList: true, subtree: true });
    }

    // ---------- 处理 ----------

    scheduleReprocessAll() {
      clearTimeout(this.reprocessTimer);
      this.reprocessTimer = setTimeout(() => this.process(document), REPROCESS_DEBOUNCE);
    }

    // 幂等处理：同一元素同一规则只应用一次；规则变化时先恢复再重应用
    process(root) {
      const entries = Adapters.collect(root);
      for (const entry of entries) {
        const el = entry.el;
        if (el.closest('.cc98f-ph')) continue;

        const prevRuleId = el.dataset.cc98fRuleId || null;
        const rule = this.enabled ? Store.matchItem(entry.item, this.rules) : null;

        if (rule && rule.id === prevRuleId) continue; // 无变化
        if (prevRuleId) Renderer.reset(el);           // 规则变了，先恢复

        if (rule) Renderer.apply(el, rule, entry.item);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      new CC98Filter().init();
    });
  } else {
    new CC98Filter().init();
  }
})(globalThis);
