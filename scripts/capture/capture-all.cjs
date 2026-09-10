#!/usr/bin/env node
/**
 * README 素材一键采集（在线上 DSH web 实例中真实操作插件 UI）。
 *
 * 产物（写入 /tmp/ss-out/）：
 *   screenshot-panel.png   定时面板（含自定义时间 + 已设定列表）
 *   screenshot-dock.png    待发送 dock（倒计时中段，进度条可见）
 *   screenshot-fired.png   到期「⏰ 定时提醒」消息块（真实触发后截图）
 *   frames-create/*.png    创建流程分镜（由 assemble.sh 合成 GIF）
 *   frames-fired/*.png     到期触发分镜（由 assemble.sh 合成 GIF）
 *
 * 前提：
 *   - dsh web 运行于 127.0.0.1:3080，本插件已装入 web profile；
 *   - playwright 库（复用 @playwright/mcp 内置的即可，见 PW 常量）；
 *   - 全程不发送真实消息给模型（仅「你好」一条用于建立对话布局）。
 *
 * 用法: node capture-all.cjs [--out /tmp/ss-out] [--base http://127.0.0.1:3080]
 */
const { chromium } = require('/home/wujue/.nvm/versions/node/v22.22.2/lib/node_modules/@playwright/mcp/node_modules/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = argOf('--out', '/tmp/ss-out');
const BASE = argOf('--base', 'http://127.0.0.1:3080');
const HOST = BASE.replace(/^https?:\/\//, '');
const PW = '/home/wujue/.nvm/versions/node/v22.22.2/lib/node_modules/@playwright/mcp/node_modules/playwright';

const FR_CREATE = path.join(OUT, 'frames-create');
const FR_FIRED = path.join(OUT, 'frames-fired');
for (const d of [OUT, FR_CREATE, FR_FIRED]) fs.mkdirSync(d, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const DEMO_TEXT = '下午4点提醒我提交周报';

async function waitIdle(page) {
  for (let i = 0; i < 60; i++) {
    const stopped = await page.evaluate(() =>
      ![...document.querySelectorAll('button')].some(b => /停止|Stop/.test(b.getAttribute('aria-label') || b.title || '')));
    if (stopped) return;
    await sleep(2000);
  }
}

async function openPanel(page) {
  await page.getByRole('button', { name: '定时发送' }).click({ force: true });
  await page.waitForTimeout(600);
  const panel = page.locator('.ss-panel');
  if (await panel.count() === 0) throw new Error('panel did not open');
  return panel;
}

async function fillCustomTime(page, panel, when) {
  await page.getByText('自定义…', { exact: true }).click({ force: true });
  await sleep(400);
  const dateStr = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  const inputs = panel.locator('input');
  for (let i = 0; i < await inputs.count(); i++) {
    const t = await inputs.nth(i).getAttribute('type');
    if (t === 'date') await inputs.nth(i).fill(dateStr);
    if (t === 'time') await inputs.nth(i).fill(timeStr);
  }
  await sleep(300);
}

async function clearInput(page, tb) {
  for (let i = 0; i < 6; i++) {
    await tb.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await sleep(250);
    if ((await tb.evaluate(el => (el.innerText || '').trim().length)) === 0) return;
  }
  await tb.evaluate(el => { el.innerText = ''; el.dispatchEvent(new InputEvent('input', { bubbles: true })); });
}

(async () => {
  const cookie = execFileSync('node', [path.join(__dirname, 'mint-cookie.cjs'), HOST]).toString().trim();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  const eq = cookie.indexOf('=');
  await ctx.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), domain: HOST.split(':')[0], path: '/', httpOnly: true, sameSite: 'Strict' }]);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(6000);

  // 1. 新建演示会话
  await page.getByRole('button', { name: /新(建)?会话/ }).first().click();
  await sleep(1000);
  const tb = page.locator('div[contenteditable="true"]').last();

  // 2. 「你好」建立对话布局（唯一一条真实消息，回复很短）
  await tb.click(); await tb.type('你好', { delay: 40 }); await tb.press('Enter');
  log('warm-up sent');
  await sleep(8000);
  try { await page.waitForFunction(() => document.body.innerText.includes('告诉我你想做什么'), { timeout: 90000 }); } catch { log('warm-up marker timeout'); }
  await waitIdle(page); await sleep(2000);

  // 3. 面板截图：创建一条 10 分钟任务（进已设定列表），再开面板选自定义时间
  await clearInput(page, tb);
  await tb.click(); await tb.type(DEMO_TEXT, { delay: 25 });
  (await openPanel(page));
  await page.getByRole('button', { name: /^加入/ }).click();
  await sleep(900);
  await openPanel(page);
  await fillCustomTime(page, page.locator('.ss-panel'), new Date(Date.now() + 40 * 60000));
  await page.locator('.ss-panel-title').click(); // 去掉时间输入的选中态
  await sleep(400);
  await page.locator('.ss-panel').screenshot({ path: path.join(OUT, 'screenshot-panel.png') });
  log('panel saved');
  await page.keyboard.press('Escape'); await sleep(400);

  // 4. 清场：删除任务（必须用「删除提醒」按钮，别碰「插话发送」！）
  while (await page.locator('[aria-label="删除提醒"]').count() > 0) {
    await page.locator('[aria-label="删除提醒"]').first().click(); await sleep(600);
  }
  await waitIdle(page);

  // 5. 创建流程分镜：清空 → 输入 → 开面板 → 确认 → dock 出现
  await clearInput(page, tb); await sleep(300);
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
  await page.screenshot({ path: path.join(FR_CREATE, 'create-00.png') });
  await tb.click(); await tb.type(DEMO_TEXT, { delay: 30 }); await sleep(500);
  await page.screenshot({ path: path.join(FR_CREATE, 'create-01.png') });
  await openPanel(page); await sleep(750);
  await page.screenshot({ path: path.join(FR_CREATE, 'create-02.png') });
  await sleep(650);
  await page.screenshot({ path: path.join(FR_CREATE, 'create-03.png') });
  await page.getByRole('button', { name: /^加入/ }).click(); await sleep(350);
  await page.screenshot({ path: path.join(FR_CREATE, 'create-04.png') });
  await sleep(700); await page.screenshot({ path: path.join(FR_CREATE, 'create-05.png') });
  await sleep(800); await page.screenshot({ path: path.join(FR_CREATE, 'create-06.png') });
  log('create frames done');
  await page.locator('[aria-label="删除提醒"]').first().click(); await sleep(600);

  // 6. dock 截图（倒计时中段）+ 到期触发采集
  await clearInput(page, tb);
  await tb.click(); await tb.type(DEMO_TEXT, { delay: 20 });
  const panel = await openPanel(page);
  const fireDate = new Date(Date.now() + 4 * 60000); fireDate.setSeconds(0, 0);
  await fillCustomTime(page, panel, fireDate);
  await page.getByRole('button', { name: /^加入/ }).click(); await sleep(900);
  const dock = page.locator('.ss-dock-root');
  if (await dock.count() === 0) throw new Error('dock missing');
  const dBox = await dock.boundingBox();
  const tBox = await tb.boundingBox();
  const region = {
    x: Math.min(dBox.x, tBox.x) - 14,
    y: dBox.y - 170,
    width: Math.max(dBox.x + dBox.width, tBox.x + tBox.width) - Math.min(dBox.x, tBox.x) + 14,
    height: (tBox.y + tBox.height + 122) - (dBox.y - 170),
  };

  const fireAt = fireDate.getTime();
  let w = fireAt - 100000 - Date.now();
  if (w > 0) { log(`waiting ${Math.round(w / 1000)}s until T-100s`); await sleep(w); }
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await sleep(300);
  { // dock 截图（全 dock + 输入框 + footer，进度条已走到中段）
    const d2 = await dock.boundingBox(); const t2 = await tb.boundingBox();
    const x = Math.min(d2.x, t2.x) - 14;
    const wd = Math.max(d2.x + d2.width, t2.x + t2.width) - x + 14;
    const y = d2.y - 12; const h = (t2.y + t2.height + 122) - y;
    await page.screenshot({ path: path.join(OUT, 'screenshot-dock.png'), clip: { x, y, width: wd, height: h } });
  }
  log('dock saved at T-' + Math.round((fireAt - Date.now()) / 1000) + 's');

  // 到期触发：1fps 采帧，检测「上下文注入 · 定时提醒」行出现后再采 6s
  w = fireAt - 90000 - Date.now();
  if (w > 0) { log(`waiting ${Math.round(w / 1000)}s until T-90s`); await sleep(w); }
  let idx = 0, injectedAt = 0;
  while (idx < 160) {
    await page.screenshot({ path: path.join(FR_FIRED, `f-${String(idx).padStart(3, '0')}.png`), clip: region });
    const now = Date.now();
    if (!injectedAt) {
      if ((await page.evaluate(() => document.body.innerText)).includes('上下文注入')) { injectedAt = now; log('INJECTED at frame', idx); }
    } else if (idx > 0 && now - injectedAt > 25000) break; // 覆盖注入→模型呈现全过程
    idx++;
    await sleep(Math.max(60, 1000 - (Date.now() - now)));
  }
  if (!injectedAt) { await page.screenshot({ path: path.join(OUT, 'fail-full.png') }); throw new Error('reminder never fired'); }
  log('fired frames:', idx);

  // 7. 到期消息块截图：触发完成后全页截图，供 assemble.sh / 手动裁剪
  await waitIdle(page); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'fired-full.png') });
  log('fired-full saved');
  await page.locator('[aria-label="删除提醒"]').first().click().catch(() => {});
  await clearInput(page, tb);
  await waitIdle(page); await sleep(1000);

  // 8. /later 命令演示分镜
  const FR_LATER = path.join(OUT, 'frames-later');
  fs.mkdirSync(FR_LATER, { recursive: true });
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
  await clearInput(page, tb); await sleep(300);
  await page.screenshot({ path: path.join(FR_LATER, 'later-00.png') });
  await tb.click();
  await tb.type('/later +60m 下午4点提醒我提交周报', { delay: 28 });
  await sleep(500);
  await page.screenshot({ path: path.join(FR_LATER, 'later-01.png') });
  await tb.press('Enter');
  await sleep(1500);
  await page.screenshot({ path: path.join(FR_LATER, 'later-02.png') });
  await sleep(800);
  await page.screenshot({ path: path.join(FR_LATER, 'later-03.png') });
  log('later frames done');
  await page.locator('[aria-label="删除提醒"]').first().click().catch(() => {});
  await clearInput(page, tb);

  console.log('CAPTURE OK →', OUT);
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
