import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGasHarness } from './gas-harness';
const payload = (n: number) => ({ grade: 2, classNum: 99, studentNum: n, name: `synthetic-${n}`, requestId: `${Date.now()}_${randomUUID()}`, learningContent: `content-${n}`, status: 'step1' });
for (const legacy of [false, true]) {
  const h = createGasHarness(legacy);
  h.hooks.rejectSheetsUnderLock = true;
  const first = payload(1);
  let same: any; let other: any;
  h.hooks.beforeWrite = () => {
    h.hooks.beforeWrite = null;
    same = h.context.saveSubmission_(first);
    // A different student's full write can finish while the first student is in flight.
    other = h.context.saveSubmission_(payload(2));
  };
  assert.equal(h.context.saveSubmission_(first).status, 'success');
  assert.equal(same.code, 'LOCK_TIMEOUT');
  assert.equal(other.status, 'success');
  assert.equal(h.context.saveSubmission_(first).duplicate, true);
  assert.equal(h.context.saveSubmission_({ ...first, learningContent: 'different' }).code, 'REQUEST_ID_CONFLICT');
  for (let i = 3; i <= 25; i++) assert.equal(h.context.saveSubmission_(payload(i)).status, 'success');
  assert.equal(h.submission.rows.length, 26);
  const numberColumn = legacy ? 2 : 3;
  assert.equal(new Set(h.submission.rows.slice(1).map(row => row[numberColumn])).size, 25);
  for (const row of h.submission.rows.slice(1)) {
    assert.equal(row[legacy ? 5 : 6], `content-${row[numberColumn]}`);
    assert.equal(JSON.parse(row[legacy ? 18 : 20]).entries.length, 1);
  }
  // An uncertain flush cannot surrender ownership or allow a second writer.
  h.hooks.flush = () => { throw Error('synthetic flush failure'); };
  const uncertain = payload(26);
  assert.throws(() => h.context.saveSubmission_(uncertain));
  h.hooks.flush = null;
  assert.equal(h.context.saveSubmission_(uncertain).code, 'LOCK_TIMEOUT');
}
const missing = createGasHarness(false, false);
assert.equal(missing.context.saveSubmission_(payload(1)).code, 'STORAGE_NOT_READY');
const migration = createGasHarness();
const prior = Array.from({ length: 6 }, (_, i) => payload(i + 1));
prior.forEach(body => migration.context.saveSubmission_(body));
const preserved = JSON.stringify(migration.submission.rows);
for (const key of migration.props.keys()) if (key.startsWith('submission')) migration.props.delete(key);
assert.equal(migration.context.prepareSubmissionStorage().existingRows, 6);
assert.equal(JSON.stringify(migration.submission.rows), preserved);
prior.forEach(body => assert.equal(migration.context.saveSubmission_(body).duplicate, true));
const existing = createGasHarness();
// A layout change must fail closed; never silently replace another student's row.
existing.context.saveSubmission_(payload(1));
existing.submission.rows[1][3] = 2;
const before = JSON.stringify(existing.submission.rows);
assert.equal(existing.context.saveSubmission_(payload(1)).code, 'STORAGE_LAYOUT_CONFLICT');
assert.equal(JSON.stringify(existing.submission.rows), before);
console.log('PASS: interleaved student writes, same-student exclusion, durable replay/conflict, 25 unique complete rows, no Sheets I/O under global lock, uncertain flush fail-closed, layout protection');
