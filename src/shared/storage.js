// ============================================================
// CC98 Filter - 共享存储层
// 统一 Rule 模型：user / board / keyword 三类规则一套代码
// 同时被 content script、popup、options 复用
// ============================================================
(function (global) {
  'use strict';

  const RULES_KEY = 'cc98f_rules';
  const ENABLED_KEY = 'cc98f_enabled';
  const LEGACY_USERS_KEY = 'blockedUsers';
  const LEGACY_BOARDS_KEY = 'blockedBoards';

  const RULE_TYPES = ['user', 'board', 'keyword'];
  const RULE_ACTIONS = ['hide', 'collapse', 'blur', 'replace'];

  // ---------- 规则构造 ----------

  function makeRule(type, pattern, extra) {
    extra = extra || {};
    const now = Date.now();
    return {
      id: type + ':' + pattern,
      type: type,
      pattern: String(pattern),
      enabled: extra.enabled !== false,
      action: RULE_ACTIONS.indexOf(extra.action) >= 0 ? extra.action : 'hide',
      replacement: typeof extra.replacement === 'string' ? extra.replacement : '',
      createdAt: now,
      updatedAt: now
    };
  }

  // ---------- 校验 ----------

  function isValidRule(r) {
    return r &&
      typeof r.pattern === 'string' &&
      r.pattern.trim().length > 0 &&
      RULE_TYPES.indexOf(r.type) >= 0;
  }

  // 归一化：补齐缺失字段（兼容手工编辑 / 旧导入文件）
  function normalizeRule(r) {
    const base = makeRule(r.type, r.pattern.trim(), r);
    if (typeof r.enabled === 'boolean') base.enabled = r.enabled;
    if (r.id) base.id = base.type + ':' + base.pattern;
    if (typeof r.createdAt === 'number') base.createdAt = r.createdAt;
    if (typeof r.updatedAt === 'number') base.updatedAt = r.updatedAt;
    return base;
  }

  // ---------- 旧版数据迁移 ----------

  function migrateLegacy(data) {
    const rules = [];
    (data[LEGACY_USERS_KEY] || []).forEach(function (u) {
      if (u && u.username) {
        rules.push(makeRule('user', u.username, {
          enabled: u.enabled !== false,
          action: 'replace',
          replacement: u.customLabel || ''
        }));
      }
    });
    (data[LEGACY_BOARDS_KEY] || []).forEach(function (b) {
      if (b && b.name) {
        rules.push(makeRule('board', b.name, { enabled: b.enabled !== false }));
      }
    });
    return rules;
  }

  // ---------- 读写 ----------

  async function loadRules() {
    const data = await chrome.storage.local.get([RULES_KEY, LEGACY_USERS_KEY, LEGACY_BOARDS_KEY]);
    let rules = data[RULES_KEY];
    if (!Array.isArray(rules)) {
      rules = migrateLegacy(data);
      if (rules.length > 0) {
        const payload = {};
        payload[RULES_KEY] = rules;
        await chrome.storage.local.set(payload);
      }
    }
    return rules.filter(isValidRule).map(normalizeRule);
  }

  async function saveRules(rules) {
    const payload = {};
    payload[RULES_KEY] = rules;
    await chrome.storage.local.set(payload);
  }

  async function loadEnabled() {
    const data = await chrome.storage.local.get(ENABLED_KEY);
    return data[ENABLED_KEY] !== false;
  }

  async function saveEnabled(enabled) {
    const payload = {};
    payload[ENABLED_KEY] = !!enabled;
    await chrome.storage.local.set(payload);
  }

  // ---------- 规则 CRUD ----------

  async function addRule(type, pattern, extra) {
    const rules = await loadRules();
    const id = type + ':' + String(pattern).trim();
    const existing = rules.find(function (r) { return r.id === id; });
    if (existing) {
      // 已存在：重新启用并更新动作
      existing.enabled = true;
      existing.action = (extra && extra.action) || existing.action;
      if (extra && typeof extra.replacement === 'string') existing.replacement = extra.replacement;
      existing.updatedAt = Date.now();
      await saveRules(rules);
      return { rule: existing, created: false };
    }
    const rule = makeRule(type, String(pattern).trim(), extra);
    rules.push(rule);
    await saveRules(rules);
    return { rule: rule, created: true };
  }

  async function removeRule(id) {
    const rules = await loadRules();
    const idx = rules.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return null;
    const removed = rules.splice(idx, 1)[0];
    await saveRules(rules);
    return removed;
  }

  async function toggleRule(id, enabled) {
    const rules = await loadRules();
    const rule = rules.find(function (r) { return r.id === id; });
    if (rule) {
      rule.enabled = !!enabled;
      rule.updatedAt = Date.now();
      await saveRules(rules);
    }
    return rule;
  }

  async function updateRule(id, patch) {
    const rules = await loadRules();
    const rule = rules.find(function (r) { return r.id === id; });
    if (rule) {
      if (RULE_ACTIONS.indexOf(patch.action) >= 0) rule.action = patch.action;
      if (typeof patch.replacement === 'string') rule.replacement = patch.replacement;
      rule.updatedAt = Date.now();
      await saveRules(rules);
    }
    return rule;
  }

  // ---------- 导入 / 导出 ----------

  function buildExport(rules, enabled) {
    return {
      version: 2,
      plugin: 'CC98_Filter',
      exportedAt: new Date().toISOString(),
      enabled: enabled !== false,
      rules: rules
    };
  }

  // 返回 { rules, enabled, mode } 或抛出 Error
  function parseImport(jsonText) {
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      throw new Error('文件不是有效的 JSON');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('备份文件格式不正确');
    }

    // v2 格式：统一规则数组
    if (Array.isArray(data.rules)) {
      const rules = data.rules.filter(isValidRule).map(normalizeRule);
      if (rules.length === 0) throw new Error('备份文件中没有有效规则');
      return { rules: rules, enabled: data.enabled !== false, mode: 'v2' };
    }

    // v1 格式：blockedUsers / blockedBoards
    if (Array.isArray(data.blockedUsers) || Array.isArray(data.blockedBoards)) {
      const rules = migrateLegacy(data);
      if (rules.length === 0) throw new Error('备份文件中没有有效规则');
      return { rules: rules, enabled: true, mode: 'v1' };
    }

    throw new Error('备份文件缺少规则数据（缺少 rules 或 blockedUsers/blockedBoards 字段）');
  }

  // ---------- 匹配引擎 ----------

  // item: { username, board, text }，均可为 null
  // 返回第一条命中的启用规则，或 null
  function matchItem(item, rules) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule.enabled) continue;
      if (rule.type === 'user' && item.username && item.username === rule.pattern) return rule;
      if (rule.type === 'board' && item.board && item.board === rule.pattern) return rule;
      if (rule.type === 'keyword' && item.text) {
        const kw = rule.pattern.toLowerCase();
        if (kw && item.text.toLowerCase().indexOf(kw) >= 0) return rule;
      }
    }
    return null;
  }

  global.CC98FStore = {
    RULES_KEY: RULES_KEY,
    ENABLED_KEY: ENABLED_KEY,
    RULE_TYPES: RULE_TYPES,
    RULE_ACTIONS: RULE_ACTIONS,
    makeRule: makeRule,
    loadRules: loadRules,
    saveRules: saveRules,
    loadEnabled: loadEnabled,
    saveEnabled: saveEnabled,
    addRule: addRule,
    removeRule: removeRule,
    toggleRule: toggleRule,
    updateRule: updateRule,
    buildExport: buildExport,
    parseImport: parseImport,
    matchItem: matchItem,
    migrateLegacy: migrateLegacy
  };
})(globalThis);
