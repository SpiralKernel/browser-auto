// Completion checker: log in, read the course tree, and report how many lessons
// are 学完 vs 未学 across the whole course graph. Run it after the long watch to
// confirm the objective is met.
const { chromium } = require('playwright');
const cfg = require('./config');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
  if (/onecas|tpass\/login/.test(page.url())) {
    await page.locator('#un').first().fill(cfg.USERNAME);
    await page.locator('#pd').first().fill(cfg.PASSWORD);
    await sleep(400);
    const s = page.locator('input[type="submit"], input[type="button"][value*="登录" i], button:has-text("登录"), button:has-text("登 录")').first();
    if (await s.count()) await s.click();
    else await page.locator('#pd').first().press('Enter');
    await sleep(7000);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: !cfg.HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, userAgent: cfg.USER_AGENT, locale: 'zh-CN' });
  const page = await ctx.newPage();
  let tree = null, stats = null;
  page.on('response', async (resp) => {
    const u = resp.url();
    if (u.includes('myCourseTypeTree')) { try { const j = await resp.json(); if (j && j.result) tree = j.result; } catch (e) {} }
    if (u.includes('queryCourseTypeById')) { try { const j = await resp.json(); if (j && j.result) stats = j.result; } catch (e) {} }
  });
  await page.goto(cfg.COURSE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500); await login(page); await sleep(3000);
  if (!/courseDetail/.test(page.url())) { await page.goto(cfg.COURSE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500); }
  for (let i = 0; i < 20 && !tree; i++) await sleep(500);
  if (!tree) { console.log('ERROR: could not read course tree'); await browser.close(); return; }

  const flat = [];
  const walk = (nodes, sec) => {
    for (const n of nodes || []) {
      if (n.children && n.children.length) walk(n.children, n.title);
      else if (n.key && /^\d+$/.test(String(n.key))) flat.push({ title: n.title || '', sec });
    }
  };
  walk(tree, '');
  const done = flat.filter((c) => /学完|已完成|已学完/.test(c.title));
  const todo = flat.filter((c) => !/学完|已完成|已学完/.test(c.title));

  console.log(`\n===== COMPLETION CHECK =====`);
  console.log(`Total lessons: ${flat.length}`);
  console.log(`  学完 (done): ${done.length}`);
  console.log(`  未学 (todo): ${todo.length}`);
  if (todo.length) {
    console.log('\n--- still 未学 (up to 30) ---');
    todo.slice(0, 30).forEach((c) => console.log(`  ${c.title}`));
  }
  if (stats) console.log('\nqueryCourseTypeById (section totals):', JSON.stringify(stats).slice(0, 400));
  await browser.close();
})().catch((e) => { console.log('[fatal]', e && e.stack ? e.stack : e); process.exit(1); });
