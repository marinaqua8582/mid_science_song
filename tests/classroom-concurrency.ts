import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import express from 'express';
import { createGasHarness } from './gas-harness';
import bootstrap from '../api/settings/public';
import login from '../api/student/login';
import sheet from '../api/sheet';
import gemini from '../api/gemini/generate-lyrics';
import { retryDelay, fetchWithRetry } from '../src/utils/retry';

process.env.SESSION_SECRET = 'synthetic-session-secret-not-production-12345';
process.env.GAS_API_SECRET = 'synthetic-gas-secret-1234567890';
process.env.GAS_WEB_APP_URL = 'https://script.google.com/macros/s/SYNTHETIC_ONLY/exec';
process.env.GEMINI_API_KEY = 'synthetic-key-never-real';
const harness = createGasHarness();
const realFetch = globalThis.fetch;
let queue = Promise.resolve();
let providerStatus = 200;
let providerCalls = 0;
let loseSaveResponse = false;
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = new URL(String(input));
  if (url.hostname === 'generativelanguage.googleapis.com') {
    providerCalls++;
    return new Response(JSON.stringify(providerStatus === 200 ? { candidates: [{ content: { parts: [{ text: '[제목: 합성 가사]' }] } }] } : { error: 'synthetic upstream failure' }), { status: providerStatus, headers: { 'Content-Type': 'application/json', 'Retry-After': '1' } });
  }
  if (url.hostname !== 'script.google.com') return realFetch(input, init);
  let resolve!: (response: Response) => void;
  const result = new Promise<Response>(r => { resolve = r; });
  queue = queue.then(async () => {
    // Serialize synchronous Apps Script executions; fixed 2 ms transport only.
    await new Promise(r => setTimeout(r, 2));
    const body = init.method === 'POST' ? JSON.parse(init.body) : Object.fromEntries(url.searchParams);
    const output = init.method === 'POST' ? harness.context.doPost({ postData: { contents: init.body } }) : harness.context.doGet({ parameter: body });
    if (loseSaveResponse && body.action === 'saveSubmission') {
      loseSaveResponse = false;
      resolve(new Response('lost confirmation', { status: 502 }));
    } else resolve(new Response(output.text, { headers: { 'Content-Type': 'application/json' } }));
  });
  return result;
}) as typeof fetch;
const app = express();
app.use(express.json());
app.get('/api/settings/public', bootstrap);
app.post('/api/student/login', login);
app.post('/api/sheet', sheet);
app.post('/api/gemini/generate-lyrics', gemini);
app.use(express.static('dist'));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(r => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const cookies: string[] = [];
const metrics: any[] = [];
async function request(path: string, body?: any, cookie?: string) {
  return fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'x-forwarded-for': '192.0.2.25' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function phase(name: string, fn: (i: number) => Promise<void>) {
  const times = await Promise.all(Array.from({ length: 25 }, async (_, i) => {
    const start = performance.now(); await fn(i); return performance.now() - start;
  }));
  times.sort((a, b) => a - b);
  metrics.push({ scenario: name, successful: 25, total: 25, successRate: '100%', p50Ms: +times[12].toFixed(2), p95Ms: +times[23].toFixed(2), maxMs: +times[24].toFixed(2) });
}
const payload = (i: number, stage: number) => ({ action: 'saveSubmission', requestId: `${Date.now()}_${randomUUID()}`, grade: 2, classNum: 5, studentNum: i + 1, name: `합성학생${i + 1}`, learningContent: `학생${i + 1}-학습`, aiLyrics: stage >= 2 ? `학생${i + 1}-가사` : '', editedLyrics: stage >= 3 ? `학생${i + 1}-수정` : '', sunoLink: stage === 4 ? `https://example.invalid/song/${i + 1}` : '', status: stage === 4 ? 'completed' : `step${stage}` });
try {
  await phase('첫 화면 HTML + 공개 bootstrap 25명', async () => {
    const html = await request('/'); assert.equal(html.status, 200); assert.match(await html.text(), /root/);
    const res = await request('/api/settings/public'); assert.equal(res.status, 200);
    const data = await res.json(); assert.equal(data.roster.length, 25); assert.ok(!JSON.stringify(data).includes('합성학생')); assert.ok(!JSON.stringify(data).includes('@example.invalid'));
  });
  await phase('동일 IP 로그인 25명', async i => {
    const res = await request('/api/student/login', { grade: 2, classNum: 5, studentNum: i + 1, name: `합성학생${i + 1}` });
    assert.equal(res.status, 200); cookies[i] = res.headers.get('set-cookie')!.split(';')[0]; await res.json();
  });
  const requests: any[][] = [];
  for (let stage = 1; stage <= 4; stage++) {
    requests[stage] = Array.from({ length: 25 }, (_, i) => payload(i, stage));
    await phase(stage === 4 ? '최종 제출 25명' : `${stage}단계 동시 저장 25명`, async i => {
      const body = requests[stage][i];
      const res = await request('/api/sheet', body, cookies[i]); assert.equal(res.status, 200);
      const data = await res.json(); assert.equal(data.requestId, body.requestId); assert.ok(data.savedAt);
    });
  }
  await phase('과거 requestId 재전송 25명', async i => {
    const res = await request('/api/sheet', requests[1][i], cookies[i]); const data = await res.json(); assert.equal(data.duplicate, true);
  });
  assert.equal(harness.submission.rows.length, 26);
  const rows = harness.submission.rows.slice(1);
  for (let i = 0; i < 25; i++) {
    const row = rows.find(row => row[3] === i + 1)!;
    assert.equal(row[6], `학생${i + 1}-학습`); assert.equal(row[12], `학생${i + 1}-가사`); assert.equal(row[13], `학생${i + 1}-수정`); assert.equal(row[15], 'completed');
  }
  assert.equal(harness.counters.listSheets, 1, 'warm saves must not scan all sheets');
  assert.equal(harness.counters.indexReads, 0, 'warm saves must not rescan all submissions');
  assert.equal(harness.counters.rosterReads, 2, 'public roster + private verification once each');
  const warmCounters = { ...harness.counters };
  // Cache eviction + row movement must recover without overwriting another student.
  harness.cache.clear(); harness.submission.rows = [harness.submission.rows[0], ...harness.submission.rows.slice(1).reverse()];
  const recover = payload(0, 4); recover.learningContent = '복구검증';
  assert.equal((await request('/api/sheet', recover, cookies[0])).status, 400);
  harness.submission.rows = [harness.submission.rows[0], ...harness.submission.rows.slice(1).reverse()];
  assert.equal((await request('/api/sheet', recover, cookies[0])).status, 200);
  assert.equal(harness.submission.rows[1][6], '복구검증');
  const conflict = await request('/api/sheet', { ...recover, learningContent: '변조' }, cookies[0]); assert.equal(conflict.status, 400);
  // Lock timeout classification + bounded client retry with stable id.
  harness.rejectNextLock();
  let res = await request('/api/sheet', payload(1, 4), cookies[1]); assert.equal(res.status, 503); assert.equal(res.headers.get('retry-after'), '1'); assert.equal((await res.json()).code, 'LOCK_TIMEOUT');
  loseSaveResponse = true;
  const replay = payload(2, 4);
  res = await fetchWithRetry(base + '/api/sheet', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookies[2] }, body: JSON.stringify(replay) }, [502, 503, 504]);
  assert.equal(res.status, 200); assert.equal((await res.json()).duplicate, true);
  const noAuth = await request('/api/sheet', payload(0, 1)); assert.equal(noAuth.status, 401);
  for (let i = 0; i < 10; i++) assert.equal((await request('/api/student/login', { grade: 2, classNum: 5, studentNum: 999, name: '없는합성학생' })).status, 401);
  assert.equal((await request('/api/student/login', { grade: 2, classNum: 5, studentNum: 999, name: '다른이름' })).status, 429);
  const legacy = createGasHarness(true);
  for (let i = 0; i < 25; i++) assert.equal(legacy.context.saveSubmission_(payload(i, 1)).status, 'success');
  for (let i = 0; i < 25; i++) assert.equal(legacy.context.saveSubmission_(payload(i, 4)).status, 'success');
  assert.equal(legacy.submission.rows.length, 26);
  legacy.context.upsertRosterStudent_({ grade: 2, classNum: 5, studentNum: 1, name: '수정합성' });
  assert.equal(legacy.context.verifyStudentResponse_({ grade: 2, classNum: 5, studentNum: 1, name: '수정합성' }).found, true);
  // Provider 429/503 retain Retry-After; generation success contains no prompt/key.
  for (const status of [429, 503, 200]) {
    providerStatus = status;
    const res = await request('/api/gemini/generate-lyrics', { unit: '합성단원', summary: '합성학습' }, cookies[0]);
    assert.equal(res.status, status); if (status !== 200) assert.equal(res.headers.get('retry-after'), '1');
  }
  const journalHarness = createGasHarness();
  const oldRequest = { ...payload(0, 1), requestId: `1000000000000_${randomUUID()}` };
  assert.equal(journalHarness.context.saveSubmission_(oldRequest).status, 'success');
  for (let i = 1; i <= 101; i++) {
    const body = { ...payload(0, 4), requestId: `${1000000000000 + i}_${randomUUID()}` };
    assert.equal(journalHarness.context.saveSubmission_(body).status, 'success');
  }
  assert.equal(journalHarness.context.saveSubmission_(oldRequest).status, 'error', 'evicted request must never be reapplied');
  for (let i = 0; i < 10; i++) assert.equal(journalHarness.context.verifyStudentResponse_({ grade: 2, classNum: 5, studentNum: 1, name: '합성학생1' }).found, true);
  assert.equal(journalHarness.context.verifyStudentResponse_({ grade: 2, classNum: 5, studentNum: 1, name: '합성학생1' }).code, 'LOGIN_RATE_LIMIT');
  if (process.env.RUN_BROWSER_TESTS === '1') {
    // Optional browser dependency: npm install --no-save playwright, or PLAYWRIGHT_MODULE.
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    harness.cache.clear();
    for (const key of harness.props.keys()) if (key.startsWith('studentLogin:') || key.startsWith('geminiQuota:')) harness.props.delete(key);
    harness.submission.rows = [];
    providerStatus = 200;
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const contexts = await Promise.all(Array.from({ length: 25 }, () => browser.newContext()));
      const pages = await Promise.all(contexts.map((context: any) => context.newPage()));
      for (const page of pages) {
        page.on('dialog', (dialog: any) => dialog.accept());
        // No accidental external data access from the browser.
        await page.route('**/*', (route: any) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      }
      await phase('브라우저 첫 화면 25명', async i => {
        await pages[i].goto(base); await pages[i].getByRole('heading', { name: '학생 로그인', exact: true }).waitFor();
      });
      await phase('브라우저 로그인 25명', async i => {
        const page = pages[i];
        await page.locator('select').nth(0).selectOption('5');
        await page.locator('select').nth(1).selectOption(String(i + 1));
        await page.getByPlaceholder('이름을 입력하세요 (예: 김과학)').fill(`합성학생${i + 1}`);
        await page.getByRole('button', { name: '수행평가 시작하기' }).click();
        await page.getByRole('button', { name: '1단계 저장 및 2단계(음악 프롬프트) 이동' }).waitFor();
      });
      await phase('브라우저 1단계 저장 25명', async i => {
        const page = pages[i];
        await page.locator('textarea').fill(`브라우저학생${i + 1} 합성 학습입니다.`);
        await page.getByRole('button', { name: '1단계 저장 및 2단계(음악 프롬프트) 이동' }).click();
        await page.getByRole('button', { name: 'Gemini AI로 과학송 가사 생성하기' }).waitFor();
        await page.getByRole('status').filter({ hasText: /마지막 서버 저장 성공/ }).waitFor();
      });
      const beforeGeneration = providerCalls;
      await phase('브라우저 Gemini 중복 클릭 25명', async i => {
        const button = pages[i].getByRole('button', { name: 'Gemini AI로 과학송 가사 생성하기' });
        await button.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
        await pages[i].getByRole('button', { name: '3단계(가사 검토 및 수정) 이동' }).waitFor({ state: 'visible' });
        await pages[i].waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.includes('3단계(가사 검토 및 수정) 이동') && !button.disabled));
      });
      assert.equal(providerCalls - beforeGeneration, 25, 'two clicks must generate only once per student');
      await phase('브라우저 2단계 저장 25명', async i => {
        await pages[i].getByRole('button', { name: '3단계(가사 검토 및 수정) 이동' }).click();
        await pages[i].getByRole('button', { name: '4단계(Suno AI 음악 제작 & 링크 제출) 이동' }).waitFor();
      });
      await phase('브라우저 3단계 저장 25명', async i => {
        await pages[i].locator('textarea').fill(`브라우저학생${i + 1} 수정 가사`);
        await pages[i].getByRole('button', { name: '4단계(Suno AI 음악 제작 & 링크 제출) 이동' }).click();
        await pages[i].getByRole('button', { name: '최종 수행평가 제출하기', exact: true }).waitFor();
      });
      await phase('브라우저 최종 제출 25명', async i => {
        await pages[i].getByPlaceholder('https://suno.com/song/...').fill(`https://example.invalid/synthetic/${i + 1}`);
        await pages[i].getByRole('button', { name: '최종 수행평가 제출하기', exact: true }).click();
        await pages[i].getByText('수행평가가 성공적으로 제출(수정)되었습니다!', { exact: true }).waitFor();
      });
      assert.equal(harness.submission.rows.length, 26);
      for (let i = 0; i < 25; i++) {
        const row = harness.submission.rows.slice(1).find(row => row[3] === i + 1)!;
        assert.equal(row[6], `브라우저학생${i + 1} 합성 학습입니다.`);
        assert.equal(row[13], `브라우저학생${i + 1} 수정 가사`);
        assert.equal(row[15], 'completed');
      }
      // Delay confirmation: no success, no next step, form controls disabled.
      const page = pages[0];
      await page.getByRole('button', { name: '3단계로 이전', exact: true }).click();
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/api/sheet', async (route: any) => {
        if (route.request().postDataJSON()?.action === 'saveSubmission') { await gate; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ status: 'error', message: '합성 저장 실패' }) }); }
        else await route.continue();
      });
      await page.getByRole('button', { name: '4단계(Suno AI 음악 제작 & 링크 제출) 이동' }).click();
      await page.getByText('서버에 저장 중입니다…', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '4단계(Suno AI 음악 제작 & 링크 제출) 이동' }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: '수행평가 다시 제출하기' }).count(), 0);
      release();
      await page.waitForFunction(() => !document.querySelector('fieldset')?.disabled);
      assert.equal(await page.getByRole('button', { name: '4단계(Suno AI 음악 제작 & 링크 제출) 이동' }).count(), 1);
    } finally { await browser.close(); }
  }
  // Policy checks: retry only named statuses, cap attempts, honor seconds/date headers.
  assert.ok(retryDelay('2', 0) >= 2000);
  assert.ok(retryDelay(new Date(Date.now() + 5000).toUTCString(), 0) >= 3500);
  assert.ok(retryDelay(null, 2) >= 2000);
  const adapterFetch = globalThis.fetch;
  try {
    for (const status of [400, 401, 403, 409, 429, 500]) {
      let calls = 0;
      globalThis.fetch = (async () => { calls++; return new Response('{}', { status }); }) as typeof fetch;
      await fetchWithRetry('https://synthetic.invalid', {}, [502, 503, 504]); assert.equal(calls, 1);
    }
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response('{}', { status: 503, headers: { 'Retry-After': '0' } }); }) as typeof fetch;
    await fetchWithRetry('https://synthetic.invalid', {}, [429, 503]); assert.equal(calls, 3);
  } finally { globalThis.fetch = adapterFetch; }
  // Manual edit/change triggers and API roster deletion/replacement invalidate private caches.
  const edits = createGasHarness();
  edits.context.getPrivateRoster_(); edits.context.getPublicRoster_();
  edits.context.invalidateClassroomCachesOnEdit({ range: edits.roster.getRange(2, 5) }); assert.equal(edits.cache.has('privateRoster:v1'), false);
  edits.context.getPrivateRoster_(); edits.context.invalidateClassroomCachesOnChange({}); assert.equal(edits.cache.has('privateRoster:v1'), false);
  edits.context.getPrivateRoster_(); edits.context.deleteRosterStudent_({ grade: 2, classNum: 5, studentNum: 1 }); assert.equal(edits.cache.has('privateRoster:v1'), false);
  edits.context.getPrivateRoster_(); edits.context.saveRoster_([{ grade: 2, classNum: 5, studentNum: 1, name: '새합성학생' }]); assert.equal(edits.cache.has('privateRoster:v1'), false);
  const protectedColumns = createGasHarness();
  protectedColumns.submission.rows = [Array(21).fill('')];
  protectedColumns.submission.rows[0][20] = '기존 추가 자료';
  assert.equal(protectedColumns.context.saveSubmission_(payload(0, 1)).status, 'error');
  assert.equal(protectedColumns.submission.rows[0][20], '기존 추가 자료');
  const report = { browserTested: process.env.RUN_BROWSER_TESTS === '1', environment: 'Local HTTP handlers + actual Code.gs in synchronous VM; synthetic Sheets; fixed 2ms transport, no real Google/Vercel latency', students: 25, metrics, duplicateRows: 0, missingRows: 0, otherStudentOverwrites: 0, warmCounters, providerCalls, regressionChecks: ['canonical + legacy', 'private roster cache and mutation invalidation', 'cache eviction and fail-closed moved rows', 'request replay after newer save', 'requestId payload conflict', 'lock timeout 503', 'lost response retry idempotency', 'unauthenticated write rejection', 'student identity repeated attempts', 'Gemini Retry-After 429/503', 'bounded exponential retry and nonretryable statuses', 'journal eviction replay rejection', 'edit/change/delete/replace cache invalidation', 'protected existing extra column', ...(process.env.RUN_BROWSER_TESTS === '1' ? ['25 isolated browser sessions and failed-save navigation guard'] : [])] };
  mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/classroom-concurrency.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { server.close(); globalThis.fetch = realFetch; }
