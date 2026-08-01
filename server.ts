import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // CORS Middleware
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize Gemini Client with User-Agent header as required
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. AI Studio 환경 변수를 확인해주세요.");
    }
    return new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gemini API Lyrics Generation Endpoint
  app.post("/api/gemini/generate-lyrics", async (req, res) => {
    try {
      const {
        unit,
        summary,
        keywords,
        genre,
        structurePrompt,
        situationPrompt,
        customPrompt,
      } = req.body;

      if (!unit || !summary) {
        return res.status(400).json({ error: "과학 단원과 학습 내용을 입력해주세요." });
      }

      const ai = getGeminiClient();

      // System instruction as strictly required:
      // "학생이 입력한 학습 내용, 핵심 단어, 프롬프트를 바탕으로 가사를 작성하라. 만약 학생의 입력 내용에 과학적 오류, 잘못된 개념, 오탈자가 포함되어 있더라도 절대로 이를 바르게 수정하거나 교정하지 말고, 학생이 입력한 잘못된 지식 그대로 가사에 반영하여 작성하라."
      const systemInstruction = `너는 중학교 과학 수행평가 가사 작사 AI이다. 
학생이 입력한 학습 내용, 핵심 단어, 프롬프트를 바탕으로 노래 제목과 노래 가사를 함께 작성하라.

[엄격 규칙]: 만약 학생의 입력 내용에 과학적 오류, 잘못된 개념, 오탈자가 포함되어 있더라도 절대로 이를 바르게 수정하거나 교정하지 말고, 학생이 입력한 잘못된 지식 그대로 가사에 반영하여 작성하라.

[필수 구조 및 작성 형식]:
1. 맨 첫 줄: 반드시 [제목: 노래 제목] 형식으로 과학 내용 및 주제에 어울리는 창의적인 노래 제목을 작성하라. (예: [제목: 소화기관 완전 정복])
2. 가사 구조: 제목 다음 줄부터 반드시 아래 순서대로 단락을 구성하여 한국어로 운율감을 살려 작성하라.
   - [Verse 1]
   - [Chorus]
   - [Verse 2]
   - [Chorus]
   - [Outro]
절대로 다른 단락 순서를 사용하거나 임의로 다른 단락([Bridge] 등)을 추가하지 말고, 반드시 [Verse 1] - [Chorus] - [Verse 2] - [Chorus] - [Outro] 5개 단락 구조를 정확히 지켜서 가사를 작성하라.`;

      // Prompt string explicitly excluding student personal info (class, number, name)
      const userPrompt = `
[선택한 과학 단원]: ${unit}
[학생 작성 학습 정리 내용]: ${summary}
[학생 입력 핵심 단어]: ${Array.isArray(keywords) ? keywords.join(", ") : keywords}
[선택한 음악 스타일]: ${genre || "K-Pop"}
[가사 구조 설계]: ${structurePrompt || "[Verse 1] - [Chorus] - [Verse 2] - [Chorus] - [Outro]"}
[상황 설정]: ${situationPrompt || "과학 시간에 재미있게 노래 부르는 상황"}
[추가 요구사항]: ${customPrompt || "핵심 단어를 자연스럽게 녹여내기"}

위 정보를 바탕으로 [제목: 노래 제목] 및 [Verse 1] - [Chorus] - [Verse 2] - [Chorus] - [Outro] 구조의 완성도 높은 노래 가사를 작성해 줘.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.8,
        },
      });

      const lyrics = response.text || "가사 생성 결과가 없습니다.";

      return res.json({ lyrics });
    } catch (error: any) {
      console.error("Gemini API generation error:", error);
      return res.status(500).json({
        error: error?.message || "Gemini API 가사 생성 중 오류가 발생했습니다.",
      });
    }
  });

  // Google Apps Script template code download/view endpoint
  app.get("/api/gas-code", (_req, res) => {
    const gasCode = `/**
 * Google Apps Script Web App Code for Science Song Evaluation
 * 구글 시트에 이 코드를 붙여넣고 [웹 앱으로 배포] (액세스 권한: 모든 사용자) 하세요.
 */

function doGet(e) {
  var action = e.parameter ? e.parameter.action : '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getRoster') {
    var rosterSheet = sheet.getSheetByName('Roster') || 
                      sheet.getSheetByName('명단') || 
                      sheet.getSheetByName('학생명단') || 
                      sheet.getSheets()[0];
    var data = rosterSheet ? rosterSheet.getDataRange().getValues() : [];
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
    var action = contents.action || 'saveSubmission';
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'getRoster') {
      var rosterSheet = sheet.getSheetByName('Roster') || sheet.insertSheet('Roster');
      var rosterData = rosterSheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: rosterData }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getStudentData' || action === 'getSubmission') {
      var subSheet = sheet.getSheetByName('Submissions') || sheet.insertSheet('Submissions');
      var allRows = subSheet.getDataRange().getValues();
      var pData = contents.data || contents;
      var targetGrade = Number(pData.grade || contents.grade || 0);
      var targetClass = Number(pData.classNum !== undefined ? pData.classNum : contents.classNum);
      var targetNum = Number(pData.studentNum !== undefined ? pData.studentNum : contents.studentNum);
      var targetName = String(pData.name || contents.name || '').trim();
      var targetId = String(pData.id || contents.id || '').replace(/^sub-/, '');

      var foundRow = null;
      for (var r = 1; r < allRows.length; r++) {
        var rowIdClean = String(allRows[r][0] || '').replace(/^sub-/, '');
        var g = Number(allRows[r][1]);
        var c = Number(allRows[r][2]);
        var n = Number(allRows[r][3]);
        var nm = String(allRows[r][4] || '').trim();

        if ((targetId && rowIdClean && rowIdClean === targetId) ||
            (g === targetGrade && c === targetClass && n === targetNum && nm === targetName)) {
          foundRow = allRows[r];
          break;
        }
      }

      if (foundRow) {
        var studentData = {
          id: foundRow[0],
          grade: foundRow[1],
          classNum: foundRow[2],
          studentNum: foundRow[3],
          name: foundRow[4],
          domain: foundRow[5],
          learningContent: foundRow[6],
          keywords: foundRow[7],
          musicStyle: foundRow[8],
          promptStructure: foundRow[9],
          promptSituation: foundRow[10],
          promptCustom: foundRow[11],
          aiLyrics: foundRow[12],
          editedLyrics: foundRow[13],
          sunoLink: foundRow[14],
          status: foundRow[15],
          submittedAt: foundRow[16],
          score: foundRow[17],
          feedback: foundRow[18]
        };
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', found: true, data: studentData }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', found: false }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === 'saveSubmission') {
      var subSheet = sheet.getSheetByName('Submissions') || sheet.insertSheet('Submissions');
      if (subSheet.getLastRow() === 0) {
        subSheet.appendRow([
          'ID', '학년', '반', '번호', '이름', 
          '단원(domain)', '학습정리(learningContent)', '핵심단어(keywords)', 
          '음악스타일(musicStyle)', '구조프롬프트(promptStructure)', '상황프롬프트(promptSituation)', '추가프롬프트(promptCustom)',
          'AI가사(aiLyrics)', '학생수정가사(editedLyrics)', 'Suno링크(sunoLink)', 
          '상태(status)', '제출시각(submittedAt)', '교사점수', '피드백'
        ]);
      }
      
      var data = contents.data || contents;
      
      var id = data.id || ('sub-' + (data.grade || 2) + '-' + (data.classNum || '') + '-' + (data.studentNum || ''));
      var grade = data.grade || 2;
      var classNum = data.classNum !== undefined && data.classNum !== null ? data.classNum : '';
      var studentNum = data.studentNum !== undefined && data.studentNum !== null ? data.studentNum : '';
      var name = data.name || '';
      var domain = data.domain || (data.step1 ? data.step1.unit : '') || '';
      var learningContent = data.learningContent || (data.step1 ? data.step1.summary : '') || '';
      var keywords = Array.isArray(data.keywords) ? data.keywords.join(', ') : (data.keywords || (data.step1 && Array.isArray(data.step1.keywords) ? data.step1.keywords.join(', ') : ''));
      var musicStyle = data.musicStyle || (data.step2 ? data.step2.genre : '') || '';
      var promptStructure = data.promptStructure || (data.step2 ? data.step2.structurePrompt : '') || '';
      var promptSituation = data.promptSituation || (data.step2 ? data.step2.situationPrompt : '') || '';
      var promptCustom = data.promptCustom || (data.step2 ? data.step2.customPrompt : '') || '';
      var aiLyrics = data.aiLyrics || (data.step2 ? data.step2.generatedLyrics : '') || '';
      var editedLyrics = data.editedLyrics || (data.step3 ? data.step3.editedLyrics : '') || '';
      var sunoLink = data.sunoLink || (data.step4 ? data.step4.sunoUrl : '') || '';
      var status = data.status || 'completed';
      var submittedAt = data.submittedAt || data.finalSubmittedAt || data.updatedAt || (data.step4 ? data.step4.finalSubmittedAt : '') || new Date().toLocaleString('ko-KR');
      var score = data.evaluation ? data.evaluation.totalScore : (data.totalScore || '');
      var feedback = data.evaluation ? data.evaluation.feedback : (data.feedback || '');

      var rowData = [
        id, grade, classNum, studentNum, name,
        domain, learningContent, keywords,
        musicStyle, promptStructure, promptSituation, promptCustom,
        aiLyrics, editedLyrics, sunoLink,
        status, submittedAt, score, feedback
      ];
      
      // 검색: ID 또는 학년/반/번호/이름 기준 최신 행 찾기 (동일 학생 행 덮어쓰기 업데이트)
      var allRows = subSheet.getDataRange().getValues();
      var targetRow = -1;
      var idClean = String(id).replace(/^sub-/, '');
      
      for (var r = 1; r < allRows.length; r++) {
        var rowIdClean = String(allRows[r][0] || '').replace(/^sub-/, '');
        var g = Number(allRows[r][1]);
        var c = Number(allRows[r][2]);
        var n = Number(allRows[r][3]);
        var nm = String(allRows[r][4] || '');
        
        if ((rowIdClean && rowIdClean === idClean) || 
            (g === Number(grade) && c === Number(classNum) && n === Number(studentNum) && nm === String(name))) {
          targetRow = r + 1;
          break;
        }
      }
      
      if (targetRow > 0) {
        subSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        subSheet.appendRow(rowData);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', row: targetRow > 0 ? targetRow : subSheet.getLastRow() }))
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
    res.type("text/plain").send(gasCode);
  });

  const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwnhnAzyN6HP__bXd0N_KzTY-GZOZ8ayqO6BD0i_iaMJPuxUGNsFDKys7c38VFleeJnDg/exec";

  // Sheet API handler for /api/sheet and /api/sync-gas
  const handleSheetSync = async (req: express.Request, res: express.Response) => {
    try {
      const bodyData = (req.method === 'GET' ? req.query : req.body) || {};
      const gasUrl = process.env.NEXT_PUBLIC_GAS_URL || process.env.GAS_URL || process.env.VITE_GAS_URL || bodyData.gasUrl || DEFAULT_GAS_URL;

      if (!gasUrl) {
        return res.status(400).json({ error: "GAS_URL이 제공되지 않았습니다." });
      }

      const action = bodyData.action || "saveSubmission";

      // For getRoster, perform GET request to gasUrl first
      if (action === "getRoster") {
        try {
          const getUrl = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}action=getRoster`;
          const getResponse = await fetch(getUrl, { method: "GET" });
          if (getResponse.ok) {
            const text = await getResponse.text();
            let resData;
            try {
              resData = JSON.parse(text);
            } catch {
              resData = { status: "success", raw: text };
            }
            if (resData && (resData.status === "success" || Array.isArray(resData.data) || Array.isArray(resData))) {
              return res.json(resData);
            }
          }
        } catch (getErr) {
          console.warn("GAS getRoster GET fallback attempt:", getErr);
        }
      }

      // Format full JSON payload preserving all form keys
      const payload = {
        action: action,
        ...bodyData,
        data: bodyData,
      };

      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let resData;
      try {
        resData = JSON.parse(text);
      } catch {
        resData = { status: "success", raw: text };
      }

      return res.json(resData);
    } catch (error: any) {
      console.error("Sheet Sync API error:", error);
      return res.status(500).json({
        error: error?.message || "구글 시트 전송 중 오류가 발생했습니다.",
      });
    }
  };

  app.get("/api/sheet", handleSheetSync);
  app.get("/api/sync-gas", handleSheetSync);
  app.post("/api/sheet", handleSheetSync);
  app.post("/api/sync-gas", handleSheetSync);

  // Fallback 404 handler for unmatched API routes
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "요청하신 API 엔드포인트를 찾을 수 없습니다." });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Science Song Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
