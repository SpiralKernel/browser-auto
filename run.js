// Main automation for the CAU lab-safety course (sysks.cau.edu.cn).
// Flow: login -> fetch course tree -> for each unfinished course: open it,
// play the video (accelerated), answer the ejected questions with the
// correctAnswer from the API, wait for the server-side finish() -> next course.
const { chromium } = require('playwright');
const cfg = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trims = (s, n = 200) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + ' …' : s; };

const RATE = Number(process.env.RATE || 8);            // video playback rate
const MODE = process.env.MODE || 'all';                 // 'one' | 'all' | 'section'
const SECTION = process.env.SECTION || '安全概述';       // which section to process in 'section' mode
const DRY = process.env.DRY === '1';                    // just list courses, no watching

const API = 'https://sysks.cau.edu.cn/api/jeecg-boot/jcedutec/courseSource';
const BASE = 'https://sysks.cau.edu.cn/students/courseDetail';

// ---------------------------------------------------------------- state caches
const questionCache = new Map();   // courseId -> questions (with correctAnswer)
const finishedCourses = new Set(); // courseIds for which the server /finish was POSTed
let courseTree = null;             // full myCourseTypeTree result

function normalizeQuestions(rows) {
  return (rows || []).map((q) => ({
    id: q.id,
    stem: q.stem || '',
    correctAnswer: (q.correctAnswer || '').toString(),
    ejectTime: q.ejectTime,
    kind: q.kind_dictText || q.kind,
    optiona: q.optiona || '',
    optionb: q.optionb || '',
    optionc: q.optionc || '',
    optiond: q.optiond || '',
  }));
}

function attachListeners(page) {
  page.on('request', (req) => {
    const u = req.url();
    if (/\/courseSource\/finish(\?|$)/.test(u) && /POST/i.test(req.method())) {
      const d = req.postData() || '';
      const m = d.match(/"id":"(\d+)"/);
      if (m) { finishedCourses.add(m[1]); console.log(`[finish] server finish() for course ${m[1]}`); }
    }
  });
  page.on('response', async (resp) => {
    const u = resp.url();
    if (u.includes('queryCourseQuestionRelaByMainId')) {
      try {
        const j = await resp.json();
        if (j && j.result) {
          const m = u.match(/id=(\d+)/);
          if (m) {
            questionCache.set(m[1], normalizeQuestions(j.result));
            console.log(`[qcapture] course ${m[1]}:`, JSON.stringify((normalizeQuestions(j.result)).map((q) => ({ id: q.id, eject: q.ejectTime, ans: q.correctAnswer, kind: q.kind }))));
          }
        }
      } catch (e) {}
    } else if (u.includes('myCourseTypeTree')) {
      try {
        const j = await resp.json();
        if (j && j.result) courseTree = j.result;
      } catch (e) {}
    }
  });
  return page;
}

// ---------------------------------------------------------------- login / nav
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

async function gotoCourse(page, courseId) {
  const url = `${BASE}?graphId=${cfg.GRAPH_ID}&id=${courseId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  await login(page);
  await sleep(2500);
  if (!/courseDetail/.test(page.url())) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);
  }
  return page.url();
}

function courseIdFromUrl(page) {
  const m = page.url().match(/id=(\d+)/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- course tree
function collectCourses() {
  if (!courseTree) return [];
  const out = [];
  const walk = (nodes, sectionTitle) => {
    for (const n of nodes || []) {
      if (n.children && n.children.length) walk(n.children, n.title || sectionTitle);
      else if (n.key && /^\d+$/.test(String(n.key))) out.push({ id: String(n.key), title: n.title || '', section: sectionTitle || '' });
    }
  };
  walk(courseTree, '');
  return out;
}
const isFinishedTitle = (t) => /学完|已完成|已学完|完成/.test(t || '');

// ---------------------------------------------------------------- eject answer
// Detect an ejected-question modal and select the correct answer (from the API).
// Handles single-choice (radio) and multi-choice (checkbox) options.
// Returns { answered: true, id } when a question was answered, else false.
async function answerEject(page, questions, answeredIds) {
  const modal = page.locator('.ant-modal-wrap').first();
  if (!(await modal.count())) return false;
  if (!(await modal.isVisible().catch(() => false))) return false;

  const stem = (await modal.innerText()).trim();
  if (!/视频习题|题/.test(stem)) return false;

  const opts = await modal.locator('input[type="radio"], input[type="checkbox"]').evaluateAll((inputs) =>
    inputs.map((inp) => {
      let w = inp.closest('label') || inp.parentElement;
      let text = (w ? w.textContent || '' : '').trim();
      text = text.replace(/^[A-D]\s*[:：]?\s*/, '');
      return { value: inp.value, text, checked: inp.checked };
    })
  );
  if (!opts.length) return false;

  const stemNorm = stem.replace(/\s+/g, '');
  let q = null;
  for (const vv of questions) {
    if (answeredIds.has(vv.id)) continue;
    const k = (vv.stem || '').replace(/\s+/g, '');
    if (!k) continue;
    if (stemNorm.includes(k.slice(0, 25)) || k.includes(stemNorm.slice(0, 25))) { q = vv; break; }
  }
  if (!q) {
    const optTexts = opts.map((o) => o.text).join('');
    for (const vv of questions) {
      if (answeredIds.has(vv.id)) continue;
      const all = `${vv.optiona}${vv.optionb}${vv.optionc}${vv.optiond}`;
      if (all && (optTexts.includes(all.substr(0, 6)) || optTexts.includes(vv.optiona))) { q = vv; break; }
    }
  }
  if (!q) { console.log('[answer] no matching question; options=', JSON.stringify(opts)); return { answered: false }; }

  const val = String(q.correctAnswer || '').trim();
  const values = val.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  let selected = 0;
  for (const v of values) {
    const label = modal.locator(`label:has(input[value="${v}"])`).first();
    if (await label.count()) {
      await label.click({ force: true });
      selected++;
    } else {
      const inp = modal.locator(`input[value="${v}"]`).first();
      if (await inp.count()) { await inp.check({ force: true }).catch(() => {}); selected++; }
    }
  }
  console.log(`[answer] ${q.id} eject=${q.ejectTime} -> ${values.join(',')} (${selected} selected)`);
  await sleep(250);
  const submit = modal.locator('button').filter({ hasText: /提\s*交|提交/ }).first();
  if (await submit.count()) await submit.click();
  else { console.log('[answer] no submit button, press Enter'); await page.keyboard.press('Enter'); }
  await sleep(600);
  answeredIds.add(q.id);
  return { answered: true, id: q.id };
}

// ---------------------------------------------------------------- watch a video
async function playAndAnswer(page, questions) {
  const v = page.locator('video').first();
  if (!(await v.count())) { console.log('[play] no video found'); return { done: false, answered: 0 }; }

  const ejectQs = questions.filter((q) => q.ejectTime != null && q.ejectTime !== '').sort((a, b) => (+a.ejectTime) - (+b.ejectTime));
  const answeredIds = new Set();

  await v.evaluate((el, rate) => { el.muted = true; el.playbackRate = rate; el.play().catch(() => {}); }, RATE);
  console.log(`[play] started ${RATE}x, ${ejectQs.length} eject questions`);

  await v.evaluate((el) => { el.__ended = false; el.addEventListener('ended', () => { el.__ended = true; }); });

  let answered = 0;
  let curRate = RATE;
  let lastReport = {};
  const startT = Date.now();
  let duration = 0;
  for (let i = 0; i < 3000; i++) {
    await sleep(250);
    const st = await v.evaluate((el) => ({ ended: el.__ended || el.ended, paused: el.paused, t: el.currentTime, dur: el.duration })).catch(() => null);
    if (!st) { console.log('[play] video detached'); break; }
    duration = st.dur || 0;
    // per-course wall-clock budget so a stuck course can't stall the run
    const budget = Math.max(90, Math.min(420, (st.dur / RATE) * 3 + 60));
    if (Date.now() - startT > budget * 1000) { console.log('[play] course time-budget hit'); break; }

    // Always answer a visible eject BEFORE considering ended (near-end ejects race the 'ended' event).
    const res = await answerEject(page, questions, answeredIds);
    if (res && res.answered) {
      answered++;
      await v.evaluate((el) => { el.play().catch(() => {}); }).catch(() => {});
      // recompute based on next unanswered eject at the loop top
      await sleep(300);
      continue;
    }
    if (st.ended) { console.log('[play] video ENDED'); break; }

    // Choose playback rate: slow to 1x when nearing the next unhandled eject.
    const nextEject = ejectQs.filter((q) => !answeredIds.has(q.id)).map((q) => +q.ejectTime).sort((a, b) => a - b)[0];
    let target = RATE;
    if (nextEject != null && st.t >= nextEject - 5) target = 1;
    if (target !== curRate) {
      await v.evaluate((el, r) => { el.playbackRate = r; el.play().catch(() => {}); }, target);
      curRate = target;
      console.log(`[rate] ${target}x (next eject @${nextEject}, t=${st.t.toFixed(1)})`);
    }

    const sec = Math.floor(st.t);
    if (!lastReport[sec] || sec % 60 === 0) {
      console.log(`  [t] ${st.t.toFixed(1)}/${st.dur.toFixed(1)} (${((st.t / st.dur) * 100).toFixed(0)}%) answered=${answered}`);
      lastReport[sec] = true;
    }
  }
  return { done: true, answered };
}

// ---------------------------------------------------------------- one course
async function processCourse(page, courseId, title) {
  console.log(`\n========== COURSE ${courseId} ${title} ==========`);
  await gotoCourse(page, courseId);
  const curId = courseIdFromUrl(page) || courseId;
  // Wait for the questions API to be captured (it fires on course load).
  let questions = questionCache.get(curId) || [];
  for (let i = 0; i < 20 && questions.length === 0; i++) { await sleep(500); questions = questionCache.get(curId) || []; }
  console.log(`[questions] ${questions.length} for course ${curId}`);
  if (questions.length === 0) {
    // Some courses have no eject questions; still watch the video.
    console.log('[questions] none, watching without answering');
  }

  // Ensure playback started (the page may auto-play; force it).
  const v = page.locator('video').first();
  if (await v.count()) {
    await v.evaluate((el, rate) => { el.muted = true; el.playbackRate = rate; el.play().catch(() => {}); }, RATE);
  }

  const res = await playAndAnswer(page, questions);
  // Give the page time to POST finish() after the video ends.
  await sleep(3000);

  const finishPOST = finishedCourses.has(curId);
  console.log(`[result] course ${curId} finishPOST=${finishPOST} answered=${res.answered}/${questions.length}`);
  return { courseId: curId, title, finished: finishPOST, answered: res.answered, questions: questions.length, finishPOST };
}

// ---------------------------------------------------------------- main
(async () => {
  const browser = await chromium.launch({ headless: !cfg.HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, userAgent: cfg.USER_AGENT, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (/error/i.test(m.type())) console.log('[console]', trims(m.text(), 140)); });
  attachListeners(page);

  // Login by visiting the initial course page.
  const firstId = cfg.COURSE_URL.match(/id=(\d+)/)[1];
  await gotoCourse(page, firstId);
  console.log('[login] reached', page.url());

  if (MODE === 'one') {
    const curId = courseIdFromUrl(page) || firstId;
    const questions = questionCache.get(curId) || [];
    console.log('[questions]', questions.length);
    await processCourse(page, curId, 'current');
    await browser.close();
    return;
  }

  if (MODE === 'ids') {
    const ids = (process.env.COURSE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    console.log(`[ids] processing ${ids.length} courses:`, ids.join(', '));
    const results = [];
    for (const id of ids) {
      try { results.push(await processCourse(page, id, `id=${id}`)); }
      catch (e) { console.log('[error]', id, trims(String(e && e.stack ? e.stack : e), 200)); results.push({ courseId: id, finished: false, error: trims(String(e), 120) }); }
    }
    console.log('\n========== SUMMARY ==========');
    for (const r of results) console.log(`  ${r.courseId} -> finished=${r.finished} answered=${r.answered}/${r.questions}${r.error ? ' ERROR: ' + r.error : ''}`);
    await browser.close();
    return;
  }

  // Collect the tree (it should be captured by now).
  for (let i = 0; i < 20 && !courseTree; i++) { await sleep(500); }
  let courses = collectCourses();
  if (!courses.length && courseTree) {
    // Fallback: navigate to a section to force the tree call (it already loaded).
    console.log('[warn] no courses parsed from tree');
  }
  console.log(`\n===== FOUND ${courses.length} courses =====`);
  courses.forEach((c, i) => console.log(`  ${i + 1}. ${c.title}`));

  if (DRY) { await browser.close(); return; }

  // Filter to what we process this run.
  let todo = courses.filter((c) => !isFinishedTitle(c.title));
  if (MODE === 'section') {
    todo = todo.filter((c) => (c.section || '').includes(SECTION));
  }
  console.log(`\n===== PROCESSING ${todo.length} unfinished courses =====`);

  const results = [];
  for (const [i, c] of todo.entries()) {
    console.log(`\n[${i + 1}/${todo.length}]`);
    try {
      results.push(await processCourse(page, c.id, c.title));
    } catch (e) {
      console.log('[error] processing', c.id, trims(String(e && e.stack ? e.stack : e), 200));
      results.push({ courseId: c.id, title: c.title, finished: false, error: trims(String(e), 120) });
    }
  }

  console.log('\n========== SUMMARY ==========');
  for (const r of results) console.log(`  ${r.courseId} ${trims(r.title, 40)} -> finished=${r.finished} answered=${r.answered}/${r.questions}${r.error ? ' ERROR: ' + r.error : ''}`);
  const ok = results.filter((r) => r.finished).length;
  console.log(`\n${ok}/${results.length} courses finished this run.`);

  await browser.close();
})().catch((e) => { console.log('[fatal]', e && e.stack ? e.stack : e); process.exit(1); });
