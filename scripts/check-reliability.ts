import assert from 'node:assert/strict';
import { requestGas } from '../api/_lib/gas.js';
import { DEFAULT_APP_SETTINGS, evaluateStudentAccess, readSettings } from '../api/_lib/settings.js';
import { setStudentSession } from '../api/_lib/session.js';
import sheetHandler from '../api/sheet.js';

// Isolated transport and handler checks: no live student data or network calls.
process.env.GAS_WEB_APP_URL = 'https://script.google.com/macros/s/test/exec';
process.env.GAS_API_SECRET = 'test-only-secret-not-production-123456';
process.env.SESSION_SECRET = 'test-only-session-secret-not-production-123456';
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const ok = (data: any) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function response() {
  return {
    statusCode: 200, headers: {} as Record<string, string>, body: null as any,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}
try {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = async () => { calls++; await gate; return ok({ status: 'success' }); };
  const reads = Array.from({ length: 12 }, () => requestGas('getSettings', { method: 'GET' }));
  assert.equal(calls, 1, 'simultaneous identical reads share one request');
  release();
  await Promise.all(reads);
  await requestGas('getSettings', { method: 'GET' });
  assert.equal(calls, 2, 'completed result is not retained as stale data');

  calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('simulated lost response'); };
  await assert.rejects(requestGas('saveSubmission'), /simulated/);
  assert.equal(calls, 1, 'writes must not be replayed');
  calls = 0;
  await assert.rejects(requestGas('getSettings', { method: 'GET' }), /simulated/);
  assert.equal(calls, 3);
  globalThis.fetch = async () => ok({ status: 'success' });
  await requestGas('getSettings', { method: 'GET' }); // failed pending promise must be cleared

  let clock = originalNow();
  Date.now = () => clock;
  calls = 0;
  globalThis.fetch = async () => { calls++; clock += 15_000; throw new Error('simulated delay'); };
  await assert.rejects(requestGas('getSettings', { method: 'GET' }), (error: any) => error.status === 504);
  assert.equal(calls, 2, 'do not start a third attempt after the aggregate deadline');
  Date.now = originalNow;

  const settings = { ...DEFAULT_APP_SETTINGS, accessStartAt: '2026-09-17T06:00', accessEndAt: '2026-09-17T07:00' };
  assert.equal(evaluateStudentAccess(settings, Date.parse('2026-09-16T20:59:59Z')).reason, 'before_start');
  assert.equal(evaluateStudentAccess(settings, Date.parse('2026-09-16T21:00:00Z')).isOpen, true);
  assert.equal(evaluateStudentAccess(settings, Date.parse('2026-09-16T22:00:01Z')).reason, 'after_end');
  assert.equal(evaluateStudentAccess({ ...settings, studentAccessEnabled: false }).reason, 'disabled');

  const closed = { ...settings, accessStartAt: '', accessEndAt: '2000-01-01T00:00' };
  let writes = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') writes++;
    return ok({ status: 'success', found: true, settings: closed });
  };
  await readSettings(true);
  const signed = response();
  setStudentSession(signed, { id: 'test-2-5-25', grade: 2, classNum: 5, studentNum: 25, name: '김과학' });
  const cookie = signed.headers['Set-Cookie'].split(';')[0];
  for (const action of ['saveSubmission', 'saveStudentData']) {
    const res = response();
    await sheetHandler({ method: 'POST', headers: { cookie }, body: { action, data: { step1: { summary: 'test' } } } }, res);
    assert.equal(res.statusCode, 403, 'already signed-in students cannot submit after closing');
    assert.equal(res.body.code, 'STUDENT_ACCESS_CLOSED');
  }
  assert.equal(writes, 0, 'closed-period attempts must not mutate Sheets');
  for (const action of ['getRoster', 'getSubmissions', 'saveRoster']) {
    const res = response();
    await sheetHandler({ method: 'POST', headers: {}, body: { action } }, res);
    assert.equal(res.statusCode, 401);
  }
  console.log('PASS: shared reads, retry cleanup/budget, no write replay, KST boundaries, closed-period writes, admin protection');
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
}
