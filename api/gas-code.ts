export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const gasCode = `/**
 * Google Apps Script Web App Code for Science Song Evaluation
 * 구글 시트에 이 코드를 붙여넣고 [웹 앱으로 배포] (액세스 권한: 모든 사용자) 하세요.
 */

function doGet(e) {
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getRoster') {
    var rosterSheet = sheet.getSheetByName('Roster') || sheet.insertSheet('Roster');
    var data = rosterSheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var subSheet = sheet.getSheetByName('Submissions') || sheet.insertSheet('Submissions');
  var subData = subSheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: subData }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'saveSubmission') {
      var subSheet = sheet.getSheetByName('Submissions') || sheet.insertSheet('Submissions');
      if (subSheet.getLastRow() === 0) {
        subSheet.appendRow(['ID', '학년', '반', '번호', '이름', '단원', '학습정리', '핵심단어', '장르', 'AI가사', '학생수정가사', 'Suno링크', '상태', '제출일시', '교사평가점수', '피드백']);
      }
      
      var data = contents.data;
      var finder = subSheet.getRange('A:A').createTextFinder(data.id).findAll();
      var rowData = [
        data.id, data.grade, data.classNum, data.studentNum, data.name,
        data.step1 ? data.step1.unit : '',
        data.step1 ? data.step1.summary : '',
        data.step1 ? (data.step1.keywords || []).join(', ') : '',
        data.step2 ? data.step2.genre : '',
        data.step2 ? data.step2.generatedLyrics : '',
        data.step3 ? data.step3.editedLyrics : '',
        data.step4 ? data.step4.sunoUrl : '',
        data.status,
        data.updatedAt,
        data.evaluation ? data.evaluation.totalScore : '',
        data.evaluation ? data.evaluation.feedback : ''
      ];
      
      if (finder.length > 0) {
        var row = finder[0].getRow();
        subSheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
      } else {
        subSheet.appendRow(rowData);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'saveRoster') {
      var rosterSheet = sheet.getSheetByName('Roster') || sheet.insertSheet('Roster');
      rosterSheet.clear();
      rosterSheet.appendRow(['ID', '학년', '반', '번호', '이름']);
      var list = contents.roster || [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        rosterSheet.appendRow([item.id, item.grade, item.classNum, item.studentNum, item.name]);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(gasCode);
}
