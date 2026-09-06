// ============================================================
// CC98 Filter - Background Service Worker
// 规则同步已统一走 chrome.storage.onChanged，这里只负责安装时的
// 旧版数据迁移预热（v0.x 的 blockedUsers/blockedBoards -> 统一规则）
// ============================================================

const RULES_KEY = 'cc98f_rules';

chrome.runtime.onInstalled.addListener(async function () {
  const data = await chrome.storage.local.get([RULES_KEY, 'blockedUsers', 'blockedBoards']);
  if (Array.isArray(data[RULES_KEY])) return; // 已迁移

  const rules = [];
  (data.blockedUsers || []).forEach(function (u) {
    if (u && u.username) {
      rules.push({
        id: 'user:' + u.username,
        type: 'user',
        pattern: u.username,
        enabled: u.enabled !== false,
        action: 'replace',
        replacement: u.customLabel || '',
        createdAt: u.firstBlockTime || Date.now(),
        updatedAt: u.lastBlockTime || Date.now()
      });
    }
  });
  (data.blockedBoards || []).forEach(function (b) {
    if (b && b.name) {
      rules.push({
        id: 'board:' + b.name,
        type: 'board',
        pattern: b.name,
        enabled: b.enabled !== false,
        action: 'hide',
        replacement: '',
        createdAt: b.firstBlockTime || Date.now(),
        updatedAt: b.lastBlockTime || Date.now()
      });
    }
  });

  if (rules.length > 0) {
    const payload = {};
    payload[RULES_KEY] = rules;
    await chrome.storage.local.set(payload);
    console.log('[CC98 Filter] 迁移完成:', rules.length, '条规则');
  }
});
