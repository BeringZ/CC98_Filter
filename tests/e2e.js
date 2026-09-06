// ============================================================
// CC98_Filter 端到端测试（需 ZJU 内网可达 www.cc98.org）
//
// 前置：启动带扩展的 Chrome for Testing（普通 Chrome 137+ 禁用 --load-extension）：
//
// "$CHROME" \
//   --user-data-dir=/tmp/cc98-filter-test \
//   --load-extension=/path/to/CC98_Filter/src \
//   --remote-debugging-port=9222 \
//   --no-proxy-server --no-sandbox \
//   --no-first-run "https://www.cc98.org/"
//
// 用法: node tests/e2e.js <stage>  [扩展ID]
//   check  - 检查扩展注入与页面状态
//   login  - 登录 CC98（需改下方 USER/PASS 或用环境变量）
//   test   - 过滤功能全套测试
//
// 要点：MV3 service worker 会休眠、无法稳定枚举，
//       所以 storage 读写统一走「把 popup 页当标签页打开」的方式——
//       扩展页主世界可以直接 evaluate chrome.storage，同时顺带测了 popup UI。
// ============================================================
const { chromium } = require('playwright-core');

const USER = process.env.CC98_USER || 'Bering';
const PASS = process.env.CC98_PASS || '';
const CDP = 'http://127.0.0.1:9222';

async function getCtx(browser) {
  return browser.contexts()[0];
}

// 打开 popup 扩展页（临时标签页），返回 { page, close }
async function openPopup(ctx, extId) {
  const pop = await ctx.newPage();
  await pop.goto('chrome-extension://' + extId + '/popup/popup.html');
  await pop.waitForTimeout(600);
  return {
    page: pop,
    close: () => pop.close().catch(() => {}),
    getRules: () => pop.evaluate(() =>
      new Promise(r => chrome.storage.local.get('cc98f_rules', d => r(d.cc98f_rules || [])))),
    setRules: (rules) => pop.evaluate((rs) =>
      new Promise(r => chrome.storage.local.set({ cc98f_rules: rs }, r)), rules),
  };
}

async function main() {
  const stage = process.argv[2] || 'check';
  const extId = process.argv[3];
  if (stage !== 'check' && !extId) throw new Error('需要传入扩展 ID（chrome://extensions 查看）');

  const browser = await chromium.connectOverCDP(CDP);
  const ctx = await getCtx(browser);
  let page = ctx.pages().find(p => p.url().includes('cc98.org'));
  if (!page) page = await ctx.newPage();

  if (stage === 'check') {
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => ({
      styleInjected: !!document.getElementById('cc98f-style'),
      rows: document.querySelectorAll('.mainPageListRow, .card-topic, .focus-topic').length,
      replies: document.querySelectorAll('.reply').length,
    }));
    console.log('[e2e] 页面状态:', JSON.stringify(state));
    console.log('[e2e] 扩展注入:', state.styleInjected ? 'OK' : '失败');
    browser.close();
    return;
  }

  if (stage === 'login') {
    await page.goto('https://www.cc98.org/logOn', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const filled = await page.evaluate(({ u, p }) => {
      const setNativeValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const ue = document.getElementById('loginName');
      const pe = document.getElementById('loginPassword');
      if (!ue || !pe) return false;
      ue.focus(); setNativeValue(ue, u);
      pe.focus(); setNativeValue(pe, p);
      return true;
    }, { u: USER, p: PASS });
    if (!filled) throw new Error('登录表单未找到（页面结构变了？）');
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('登录'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(4000);
    await page.goto('https://www.cc98.org/', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const loggedIn = await page.evaluate(() => !document.querySelector('a[href*="logOn"]'));
    console.log('[e2e] 登录:', loggedIn ? 'OK' : '失败');
    browser.close();
    return;
  }

  if (stage === 'test') {
    // T1 悬停出现快捷按钮
    const row = page.locator('.mainPageListRow').first();
    await row.waitFor({ timeout: 10000 });
    await row.hover();
    await page.waitForTimeout(400);
    const btnVisible = await page.evaluate(() => {
      const b = document.querySelector('.cc98f-quickbtn');
      return b ? b.classList.contains('cc98f-show') : false;
    });
    console.log('[e2e] T1 悬停快捷按钮:', btnVisible ? 'OK' : 'FAIL');

    // T2 通过快捷菜单屏蔽当前版块
    await page.evaluate(() => document.querySelector('.cc98f-quickbtn').click());
    await page.waitForTimeout(300);
    const items = await page.evaluate(() =>
      [...document.querySelectorAll('.cc98f-quickmenu-item')].map(i => i.textContent));
    const boardIdx = items.findIndex(t => t.includes('屏蔽版块'));
    if (boardIdx >= 0) {
      await page.evaluate((i) => document.querySelectorAll('.cc98f-quickmenu-item')[i].click(), boardIdx);
      await page.waitForTimeout(900);
      const filtered = await page.evaluate(() => document.querySelectorAll('.cc98f-filtered').length);
      console.log('[e2e] T2 快捷屏蔽版块后过滤数:', filtered, filtered > 0 ? 'OK' : 'FAIL');
    }

    // T3 全禁用 -> 零残留恢复
    const pop = await openPopup(ctx, extId);
    const rules = await pop.getRules();
    await pop.setRules(rules.map(r => ({ ...r, enabled: false })));
    await page.waitForTimeout(900);
    const leftovers = await page.evaluate(() =>
      document.querySelectorAll('.cc98f-filtered, .cc98f-ph').length);
    console.log('[e2e] T3 全禁用残留:', leftovers, leftovers === 0 ? 'OK' : 'FAIL');

    // 恢复 + 清理
    await pop.setRules([]);
    await pop.close();
    console.log('[e2e] 规则已清空');
    browser.close();
  }
}

main().catch(e => { console.error('[e2e] FAIL:', e.message); process.exit(1); });
