import assert from 'node:assert/strict';
import vm from 'node:vm';
import { GAS_SCRIPT } from '../src/data/gasScript.js';
import handler from '../api/gemini/generate-lyrics.js';
import { DEFAULT_APP_SETTINGS, readSettings } from '../api/_lib/settings.js';
import { setStudentSession } from '../api/_lib/session.js';

const properties = new Map<string, string>();
let clock = Date.now();
let locked = false;
function freshScript() {
  const context = vm.createContext({
    Date: { now: () => clock },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key: string) => properties.get(key) || null,
      setProperty: (key: string, value: string) => { assert.equal(locked, true); properties.set(key, value); },
    }) },
    LockService: { getScriptLock: () => ({
      waitLock: () => { assert.equal(locked, false); locked = true; },
      releaseLock: () => { locked = false; },
    }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('quota must not touch student work'); } },
  });
  vm.runInContext(GAS_SCRIPT, context);
  return context;
}
for (let i = 0; i < 10; i++) assert.equal(freshScript().consumeGeminiQuota_('test-student').allowed, true);
assert.equal(freshScript().consumeGeminiQuota_('test-student').allowed, false);
assert.equal(freshScript().consumeGeminiQuota_('other-student').allowed, true);
clock += 30 * 60 * 1000;
assert.equal(freshScript().consumeGeminiQuota_('test-student').allowed, true);
assert.equal(locked, false);

process.env.GAS_WEB_APP_URL = 'https://script.google.com/macros/s/test/exec';
process.env.GAS_API_SECRET = 'test-only-secret-not-production-123456';
process.env.SESSION_SECRET = 'test-only-session-secret-not-production-123456';
process.env.GEMINI_API_KEY = 'test-only-never-call-live-api';
function response() {
  return {
    statusCode: 200, headers: {} as Record<string, string>, body: null as any,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}
const originalFetch = globalThis.fetch;
try {
  const actions: string[] = [];
  globalThis.fetch = async (url, init) => {
    const action = init?.method === 'GET' ? new URL(String(url)).searchParams.get('action') : JSON.parse(String(init?.body)).action;
    actions.push(action);
    const data = action === 'getSettings'
      ? { status: 'success', found: true, settings: DEFAULT_APP_SETTINGS }
      : { status: 'success', allowed: false, retryAfterSeconds: 123 };
    assert.ok(['getSettings', 'consumeGeminiQuota'].includes(action), 'must never call the paid API when blocked');
    return new Response(JSON.stringify(data));
  };
  await readSettings(true);
  const signed = response();
  setStudentSession(signed, { id: 'test-student', grade: 2, classNum: 5, studentNum: 25, name: '김과학' });
  const res = response();
  await handler({ method: 'POST', headers: { cookie: signed.headers['Set-Cookie'].split(';')[0] }, body: { unit: '소화', summary: '테스트' } }, res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '123');
  assert.deepEqual(actions, ['getSettings', 'consumeGeminiQuota']);
  console.log('PASS: quota survives fresh script contexts, per-student isolation/reset, lock release, no Sheets mutation, API returns 429 without paid generation');
} finally { globalThis.fetch = originalFetch; }
