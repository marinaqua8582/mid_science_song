export const GAS_SCRIPT = String.raw`/**
 * Science Song 수행평가용 Google Apps Script
 *
 * 1. 이 코드를 수행평가 Google Sheets의 Apps Script 편집기에 붙여넣습니다.
 * 2. 웹 앱으로 새 버전을 배포하고 액세스 권한을 "모든 사용자"로 설정합니다.
 * 3. 조회 요청은 행을 만들거나 수정하지 않습니다.
 */

var ROSTER_SHEET_NAME = 'Roster';
var SUBMISSIONS_SHEET_NAME = 'Submissions';
var CANONICAL_HEADERS = [
  'ID', '학년', '반', '번호', '이름',
  '단원', '학습정리', '핵심단어', '음악스타일',
  '구조프롬프트', '상황프롬프트', '추가프롬프트',
  'AI가사', '학생수정가사', 'Suno링크',
  '상태', '제출일시', '교사점수', '피드백', '평가상세(JSON)'
];

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return responseJSON({ status: 'success', message: 'GAS Active' });
    }
    if (action === 'getRoster') {
      return responseJSON({ status: 'success', data: getRosterRows_() });
    }
    if (action === 'getSubmissions' || action === 'getData') {
      return responseJSON({ status: 'success', data: getSubmissionObjects_() });
    }
    if (action === 'getStudentData' || action === 'getSubmission') {
      return responseJSON(findStudentResponse_(params));
    }

    return responseJSON({ status: 'error', message: 'Invalid read action' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var contents = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = contents.action || '';

    if (action === 'ping') {
      return responseJSON({ status: 'success', message: 'GAS Active' });
    }
    if (action === 'getRoster') {
      return responseJSON({ status: 'success', data: getRosterRows_() });
    }
    if (action === 'getSubmissions' || action === 'getData') {
      return responseJSON({ status: 'success', data: getSubmissionObjects_() });
    }
    if (action === 'getStudentData' || action === 'getSubmission') {
      return responseJSON(findStudentResponse_(contents.data || contents));
    }
    if (action === 'getStudentGoogleId') {
      return responseJSON(findStudentGoogleIdResponse_(contents.data || contents));
    }
    if (action === 'saveRoster') {
      return responseJSON(saveRoster_(contents.roster));
    }
    if (action === 'upsertRosterStudent') {
      return responseJSON(upsertRosterStudent_(contents.student || contents.data || contents));
    }
    if (action === 'deleteRosterStudent') {
      return responseJSON(deleteRosterStudent_(contents.student || contents.data || contents));
    }
    if (action === 'saveSubmission' || action === 'saveStudentData') {
      return responseJSON(saveSubmission_(contents.data || contents));
    }

    return responseJSON({ status: 'error', message: 'Invalid action' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRosterRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.map(function(row) { return row.slice(0, 5); });
}

function saveRoster_(roster) {
  if (!Array.isArray(roster)) {
    return { status: 'error', message: 'roster must be an array' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(ROSTER_SHEET_NAME) || ss.insertSheet(ROSTER_SHEET_NAME);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, 6).setValues([['ID', '학년', '반', '번호', '이름', '구글 아이디']]);

    var rows = [];
    for (var i = 0; i < roster.length; i++) {
      var item = roster[i] || {};
      var name = String(item.name || '').trim();
      if (!name) continue;
      rows.push([
        item.id || makeSubmissionId_(item.grade, item.classNum, item.studentNum).replace(/^sub-/, ''),
        Number(item.grade) || 2,
        Number(item.classNum) || '',
        Number(item.studentNum) || '',
        name,
        String(item.googleId || '').trim()
      ]);
    }
    if (rows.length) sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    return { status: 'success', count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function findStudentGoogleIdResponse_(query) {
  query = query || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return { status: 'success', found: false };

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 6)).getValues();
  var targetGrade = Number(query.grade) || 2;
  var targetClass = Number(query.classNum);
  var targetNum = Number(query.studentNum);
  var targetName = normalizeName_(query.name);

  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i][1]) === targetGrade && Number(rows[i][2]) === targetClass &&
        Number(rows[i][3]) === targetNum && normalizeName_(rows[i][4]) === targetName) {
      var googleId = String(rows[i][5] || '').trim();
      return { status: 'success', found: googleId !== '', googleId: googleId };
    }
  }
  return { status: 'success', found: false };
}

function upsertRosterStudent_(student) {
  student = student || {};
  var name = String(student.name || '').trim();
  if (!Number(student.classNum) || !Number(student.studentNum) || !name) {
    return { status: 'error', message: '반, 번호, 이름이 모두 있어야 합니다.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(ROSTER_SHEET_NAME) || ss.insertSheet(ROSTER_SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 6).setValues([['ID', '학년', '반', '번호', '이름', '구글 아이디']]);
    }

    var rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    var targetRow = -1;
    for (var i = 0; i < rows.length; i++) {
      if (Number(rows[i][1]) === Number(student.grade || 2) &&
          Number(rows[i][2]) === Number(student.classNum) &&
          Number(rows[i][3]) === Number(student.studentNum)) {
        targetRow = i + 2;
        break;
      }
    }

    var id = student.id || makeSubmissionId_(student.grade, student.classNum, student.studentNum).replace(/^sub-/, '');
    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, 5).setValues([[
        id, Number(student.grade) || 2, Number(student.classNum), Number(student.studentNum), name
      ]]);
      if (student.googleId) sheet.getRange(targetRow, 6).setValue(String(student.googleId).trim());
    } else {
      sheet.appendRow([
        id, Number(student.grade) || 2, Number(student.classNum), Number(student.studentNum),
        name, String(student.googleId || '').trim()
      ]);
      targetRow = sheet.getLastRow();
    }
    return { status: 'success', row: targetRow };
  } finally {
    lock.releaseLock();
  }
}

function deleteRosterStudent_(student) {
  student = student || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return { status: 'success', deleted: false };
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    for (var i = rows.length - 1; i >= 0; i--) {
      if (Number(rows[i][1]) === Number(student.grade || 2) &&
          Number(rows[i][2]) === Number(student.classNum) &&
          Number(rows[i][3]) === Number(student.studentNum)) {
        sheet.deleteRow(i + 2);
        return { status: 'success', deleted: true };
      }
    }
    return { status: 'success', deleted: false };
  } finally {
    lock.releaseLock();
  }
}

function normalizeName_(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function getSubmissionSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var named = ss.getSheetByName(SUBMISSIONS_SHEET_NAME);
  var sheets = ss.getSheets();
  var bestSheet = null;
  var bestScore = -1;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getName() === ROSTER_SHEET_NAME || sheet.getLastRow() === 0) continue;
    var width = Math.min(Math.max(sheet.getLastColumn(), 1), 20);
    var headers = sheet.getRange(1, 1, 1, width).getValues()[0]
      .map(function(value) { return String(value || '').trim(); });
    var isCanonical = headers.indexOf('ID') >= 0 && headers.indexOf('이름') >= 0;
    var isLegacy = headers.indexOf('최종수정시각') >= 0 && headers.indexOf('이름') >= 0;
    if (!isCanonical && !isLegacy) continue;

    var validRows = countValidSubmissionRows_(sheet, isLegacy);
    // 실제 학생 행이 많은 탭을 선택합니다. 같은 수라면 기존 14열 시트를 우선하여
    // 과거 코드가 만든 빈/시험용 Submissions 탭에 가려지는 일을 막습니다.
    var score = validRows * 1000 + (isLegacy ? 100 : 0) +
      (sheet.getName() === SUBMISSIONS_SHEET_NAME ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }

  return bestSheet || named || ss.insertSheet(SUBMISSIONS_SHEET_NAME);
}

function countValidSubmissionRows_(sheet, isLegacy) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var startColumn = isLegacy ? 2 : 3;
  var rows = sheet.getRange(2, startColumn, lastRow - 1, 3).getValues();
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i][0]) > 0 && Number(rows[i][1]) > 0 &&
        String(rows[i][2] || '').trim()) count++;
  }
  return count;
}

function getSubmissionObjects_() {
  var sheet = getSubmissionSheet_();
  if (sheet.getLastRow() < 2) return [];

  var width = Math.max(sheet.getLastColumn(), 20);
  var values = sheet.getRange(1, 1, sheet.getLastRow(), width).getValues();
  var headers = values[0].map(function(value) { return String(value || '').trim(); });
  var isLegacy = headers.indexOf('최종수정시각') >= 0;
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var item = isLegacy ? legacyRowToObject_(row) : canonicalRowToObject_(row);
    if (item && item.classNum && item.studentNum && item.name) results.push(item);
  }
  return results;
}

function canonicalRowToObject_(row) {
  var evaluation = parseEvaluation_(row[19], row[17], row[18]);
  return {
    id: row[0], grade: row[1], classNum: row[2], studentNum: row[3], name: row[4],
    domain: row[5], learningContent: row[6], keywords: row[7], musicStyle: row[8],
    promptStructure: row[9], promptSituation: row[10], promptCustom: row[11],
    aiLyrics: row[12], editedLyrics: row[13], sunoLink: row[14], status: row[15],
    submittedAt: row[16], score: row[17], feedback: row[18], evaluation: evaluation
  };
}

function legacyRowToObject_(row) {
  var classNum = row[1];
  var studentNum = row[2];
  var evaluation = parseEvaluation_(row[17], row[15], row[16]);
  var status = row[14] || inferStatus_(row[5], row[11], row[12], row[13]);
  return {
    id: makeSubmissionId_(2, classNum, studentNum),
    grade: 2,
    classNum: classNum,
    studentNum: studentNum,
    name: row[3],
    domain: row[4],
    learningContent: row[5],
    keywords: row[6],
    musicStyle: row[7],
    promptStructure: row[8],
    promptSituation: row[9],
    promptCustom: row[10],
    aiLyrics: row[11],
    editedLyrics: row[12],
    sunoLink: row[13],
    status: status,
    submittedAt: row[0],
    score: row[15],
    feedback: row[16],
    evaluation: evaluation
  };
}

function findStudentResponse_(query) {
  var all = getSubmissionObjects_();
  var targetId = normalizeId_(query.id);
  var targetGrade = Number(query.grade) || 2;
  var targetClass = Number(query.classNum);
  var targetNum = Number(query.studentNum);
  var targetName = String(query.name || '').trim();

  for (var i = 0; i < all.length; i++) {
    var item = all[i];
    if ((targetId && normalizeId_(item.id) === targetId) ||
        (Number(item.grade || 2) === targetGrade && Number(item.classNum) === targetClass &&
         Number(item.studentNum) === targetNum && String(item.name || '').trim() === targetName)) {
      return { status: 'success', found: true, data: item };
    }
  }
  return { status: 'success', found: false };
}

function saveSubmission_(data) {
  data = data || {};
  var grade = Number(data.grade) || 2;
  var classNum = Number(data.classNum);
  var studentNum = Number(data.studentNum);
  var name = String(data.name || '').trim();

  // 조회 요청이나 불완전한 객체가 빈 제출 행으로 기록되는 것을 원천 차단합니다.
  if (!classNum || !studentNum || !name) {
    return { status: 'error', message: '반, 번호, 이름이 모두 있어야 저장할 수 있습니다.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSubmissionSheet_();
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, CANONICAL_HEADERS.length).setValues([CANONICAL_HEADERS]);
    }

    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 20)).getValues()[0]
      .map(function(value) { return String(value || '').trim(); });
    var isLegacy = headers.indexOf('최종수정시각') >= 0;
    return isLegacy
      ? saveLegacySubmission_(sheet, data, grade, classNum, studentNum, name)
      : saveCanonicalSubmission_(sheet, data, grade, classNum, studentNum, name);
  } finally {
    lock.releaseLock();
  }
}

function saveCanonicalSubmission_(sheet, data, grade, classNum, studentNum, name) {
  var id = data.id || makeSubmissionId_(grade, classNum, studentNum);
  var evaluation = normalizeEvaluation_(data);
  var rowData = [
    id, grade, classNum, studentNum, name,
    value_(data.domain, data.step1 && data.step1.unit),
    value_(data.learningContent, data.step1 && data.step1.summary),
    keywordValue_(data.keywords, data.step1 && data.step1.keywords),
    value_(data.musicStyle, data.step2 && data.step2.genre),
    value_(data.promptStructure, data.step2 && data.step2.structurePrompt),
    value_(data.promptSituation, data.step2 && data.step2.situationPrompt),
    value_(data.promptCustom, data.step2 && data.step2.customPrompt),
    value_(data.aiLyrics, data.step2 && data.step2.generatedLyrics),
    value_(data.editedLyrics, data.step3 && data.step3.editedLyrics),
    value_(data.sunoLink, data.step4 && data.step4.sunoUrl),
    data.status || inferStatus_(data.learningContent, data.aiLyrics, data.editedLyrics, data.sunoLink),
    data.submittedAt || data.updatedAt || new Date(),
    evaluation ? evaluation.totalScore : value_(data.score, data.totalScore),
    evaluation ? evaluation.feedback : value_(data.feedback, ''),
    evaluation ? JSON.stringify(evaluation) : ''
  ];

  var targetRow = findCanonicalRow_(sheet, id, grade, classNum, studentNum, name);
  if (targetRow > 0) {
    var existing = sheet.getRange(targetRow, 1, 1, CANONICAL_HEADERS.length).getValues()[0];
    sheet.getRange(targetRow, 1, 1, CANONICAL_HEADERS.length).setValues([
      mergeRows_(existing, rowData, [0, 1, 2, 3, 4, 15, 16])
    ]);
  } else {
    sheet.appendRow(rowData);
    targetRow = sheet.getLastRow();
  }
  return { status: 'success', row: targetRow };
}

function saveLegacySubmission_(sheet, data, grade, classNum, studentNum, name) {
  var extraHeaders = ['상태', '교사점수', '피드백', '평가상세(JSON)'];
  sheet.getRange(1, 15, 1, extraHeaders.length).setValues([extraHeaders]);
  var evaluation = normalizeEvaluation_(data);
  var rowData = [
    data.submittedAt || data.updatedAt || new Date(),
    classNum, studentNum, name,
    value_(data.domain, data.step1 && data.step1.unit),
    value_(data.learningContent, data.step1 && data.step1.summary),
    keywordValue_(data.keywords, data.step1 && data.step1.keywords),
    value_(data.musicStyle, data.step2 && data.step2.genre),
    value_(data.promptStructure, data.step2 && data.step2.structurePrompt),
    value_(data.promptSituation, data.step2 && data.step2.situationPrompt),
    value_(data.promptCustom, data.step2 && data.step2.customPrompt),
    value_(data.aiLyrics, data.step2 && data.step2.generatedLyrics),
    value_(data.editedLyrics, data.step3 && data.step3.editedLyrics),
    value_(data.sunoLink, data.step4 && data.step4.sunoUrl),
    data.status || inferStatus_(data.learningContent, data.aiLyrics, data.editedLyrics, data.sunoLink),
    evaluation ? evaluation.totalScore : value_(data.score, data.totalScore),
    evaluation ? evaluation.feedback : value_(data.feedback, ''),
    evaluation ? JSON.stringify(evaluation) : ''
  ];

  var targetRow = findLegacyRow_(sheet, classNum, studentNum, name);
  if (targetRow > 0) {
    var existing = sheet.getRange(targetRow, 1, 1, rowData.length).getValues()[0];
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([
      mergeRows_(existing, rowData, [0, 1, 2, 3, 14])
    ]);
  } else {
    sheet.appendRow(rowData);
    targetRow = sheet.getLastRow();
  }
  return { status: 'success', row: targetRow };
}

function findCanonicalRow_(sheet, id, grade, classNum, studentNum, name) {
  if (sheet.getLastRow() < 2) return -1;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var targetId = normalizeId_(id);
  for (var i = 0; i < rows.length; i++) {
    if ((targetId && normalizeId_(rows[i][0]) === targetId) ||
        (Number(rows[i][1]) === grade && Number(rows[i][2]) === classNum &&
         Number(rows[i][3]) === studentNum && String(rows[i][4] || '').trim() === name)) {
      return i + 2;
    }
  }
  return -1;
}

function findLegacyRow_(sheet, classNum, studentNum, name) {
  if (sheet.getLastRow() < 2) return -1;
  var rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i][0]) === classNum && Number(rows[i][1]) === studentNum &&
        String(rows[i][2] || '').trim() === name) return i + 2;
  }
  return -1;
}

function mergeRows_(existing, incoming, alwaysReplaceIndexes) {
  var always = {};
  for (var i = 0; i < alwaysReplaceIndexes.length; i++) always[alwaysReplaceIndexes[i]] = true;
  var merged = existing.slice();
  for (var j = 0; j < incoming.length; j++) {
    if (always[j] || (incoming[j] !== '' && incoming[j] !== null && incoming[j] !== undefined)) {
      merged[j] = incoming[j];
    }
  }
  return merged;
}

function normalizeEvaluation_(data) {
  if (data.evaluation && typeof data.evaluation === 'object') return data.evaluation;
  if (data.evaluationJson) {
    try { return JSON.parse(data.evaluationJson); } catch (ignore) {}
  }
  if (data.score !== '' && data.score !== undefined || data.feedback) {
    return {
      scores: {}, totalScore: Number(data.score) || 0, maxScore: 100,
      feedback: data.feedback || '', evaluatedAt: data.evaluatedAt || new Date()
    };
  }
  return null;
}

function parseEvaluation_(jsonValue, score, feedback) {
  if (jsonValue) {
    try { return JSON.parse(String(jsonValue)); } catch (ignore) {}
  }
  if (score !== '' && score !== null && score !== undefined || feedback) {
    return {
      scores: {}, totalScore: Number(score) || 0, maxScore: 100,
      feedback: String(feedback || ''), evaluatedAt: ''
    };
  }
  return null;
}

function keywordValue_(primary, secondary) {
  var value = primary !== undefined && primary !== null ? primary : secondary;
  return Array.isArray(value) ? value.join(', ') : (value || '');
}

function value_(primary, secondary) {
  return primary !== undefined && primary !== null ? primary : (secondary || '');
}

function normalizeId_(value) {
  return String(value || '').replace(/^sub-/, '').trim();
}

function makeSubmissionId_(grade, classNum, studentNum) {
  var num = Number(studentNum) || 0;
  var formatted = num < 10 ? '0' + num : String(num);
  return 'sub-' + (Number(grade) || 2) + '-' + Number(classNum) + '-' + formatted;
}

function inferStatus_(learningContent, aiLyrics, editedLyrics, sunoLink) {
  if (sunoLink) return 'completed';
  if (editedLyrics) return 'step3';
  if (aiLyrics) return 'step2';
  if (learningContent) return 'step1';
  return 'not_started';
}
`;
