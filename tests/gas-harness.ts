import vm from 'node:vm';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function createGasHarness(legacy = false, prepare = true) {
  const counters = { rosterReads: 0, listSheets: 0, indexReads: 0, writes: 0 };
  const cache = new Map<string, string>();
  const props = new Map<string, string>([['GAS_API_SECRET', 'synthetic-gas-secret-1234567890']]);
  let held = false;
  let rejectLock = false;
  const hooks = { beforeWrite: null as null | (() => void), flush: null as null | (() => void), rejectSheetsUnderLock: false };
  function checkSheets() { if (hooks.rejectSheetsUnderLock && held) throw Error('Sheets I/O under global lock'); }
  class Sheet {
    rows: any[][] = [];
    constructor(public name: string, public id: number) {}
    getName() { return this.name; }
    getSheetId() { return this.id; }
    getMaxRows() { checkSheets(); return 1000; }
    getLastRow() { checkSheets(); return this.rows.length; }
    getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
    getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
    getRange(r: number, c: number, h = 1, w = 1) {
      checkSheets();
      if (r < 1 || c < 1 || h < 1 || w < 1) throw Error('invalid range');
      const self = this;
      return {
        getValues() {
          if (self.name === 'Roster') counters.rosterReads++;
          if (self.name !== 'Roster' && r === 2 && h > 1) counters.indexReads++;
          return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => self.rows[r + i - 1]?.[c + j - 1] ?? ''));
        },
        getValue() { return self.rows[r - 1]?.[c - 1] ?? ''; },
        setValues(values: any[][]) {
          hooks.beforeWrite?.();
          if (values.length !== h || values.some(row => row.length !== w)) throw Error('range size mismatch');
          counters.writes++;
          values.forEach((row, i) => {
            self.rows[r + i - 1] ||= [];
            row.forEach((value, j) => { self.rows[r + i - 1][c + j - 1] = value; });
          });
        },
        setValue(value: any) { this.setValues([[value]]); },
        getSheet() { return self; },
      };
    }
    appendRow(row: any[]) { this.rows.push([...row]); counters.writes++; }
    clearContents() { this.rows = []; }
    deleteRow(row: number) { this.rows.splice(row - 1, 1); }
  }
  const roster = new Sheet('Roster', 1);
  const submission = new Sheet('Submissions', 2);
  const sheets = [roster, submission];
  roster.rows = [['ID', '학년', '반', '번호', '이름', '구글 아이디'], ...Array.from({ length: 25 }, (_, i) => [`synthetic-${i}`, 2, 5, i + 1, `합성학생${i + 1}`, `synthetic-${i}@example.invalid`])];
  if (legacy) submission.rows = [['최종수정시각', '반', '번호', '이름', '단원', '학습정리', '핵심단어', '음악스타일', '구조프롬프트', '상황프롬프트', '추가프롬프트', 'AI가사', '학생수정가사', 'Suno링크']];
  const ss = {
    getSheetById: (id: number) => sheets.find(sheet => sheet.id === id) || null,
    getSheetByName: (name: string) => sheets.find(sheet => sheet.name === name) || null,
    getSheets: () => { counters.listSheets++; return sheets; },
    insertSheet: (name: string) => { const sheet = new Sheet(name, sheets.length + 1); sheets.push(sheet); return sheet; },
  };
  const context: any = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => { checkSheets(); return ss; }, flush() { checkSheets(); hooks.flush?.(); } },
    CacheService: { getScriptCache: () => ({ get: (key: string) => cache.get(key) || null, put: (key: string, value: string) => cache.set(key, value), remove: (key: string) => cache.delete(key), removeAll: (keys: string[]) => keys.forEach(key => cache.delete(key)) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => props.get(key) || null, setProperty: (key: string, value: string) => props.set(key, value), setProperties: (values: Record<string, string>) => Object.entries(values).forEach(([key, value]) => props.set(key, value)) }) },
    LockService: { getScriptLock: () => ({ tryLock() { if (held || rejectLock) { rejectLock = false; return false; } held = true; return true; }, waitLock() { if (held) throw Error('lock held'); held = true; }, releaseLock() { held = false; } }) },
    Utilities: { getUuid: randomUUID, DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_: any, value: string) => createHash('sha256').update(value).digest(), base64EncodeWebSafe: (value: Buffer) => value.toString('base64url') },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
  });
  vm.runInContext(readFileSync('deployment/Code.gs', 'utf8'), context);
  if (prepare) context.prepareSubmissionStorage();
  return { context, counters, cache, props, roster, submission, hooks, rejectNextLock() { rejectLock = true; } };
}
