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
      
      // 검색: ID 또는 학년/반/번호/이름 기준 최신 행 찾기 (동일 학생 행 중복 생성 방지)
      var allRows = subSheet.getDataRange().getValues();
      var targetRow = -1;
      var dataIdClean = String(data.id || '').replace(/^sub-/, '');
      
      for (var r = 1; r < allRows.length; r++) {
        var rowId = String(allRows[r][0] || '').replace(/^sub-/, '');
        var g = Number(allRows[r][1]);
        var c = Number(allRows[r][2]);
        var n = Number(allRows[r][3]);
        var name = String(allRows[r][4] || '');
        
        if ((rowId && rowId === dataIdClean) || 
            (g === Number(data.grade) && c === Number(data.classNum) && n === Number(data.studentNum) && name === String(data.name))) {
          targetRow = r + 1;
          break;
        }
      }
      
      if (targetRow > 0) {
        subSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
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
    res.type("text/plain").send(gasCode);
  });

  // GAS Proxy Endpoint to bypass browser CORS constraints when syncing to Google Apps Script
  app.post("/api/sync-gas", async (req, res) => {
    try {
      const { gasUrl, payload } = req.body;
      if (!gasUrl) {
        return res.status(400).json({ error: "gasUrl이 필요합니다." });
      }

      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: typeof payload === "string" ? payload : JSON.stringify(payload),
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
      console.error("GAS proxy sync error:", error);
      return res.status(500).json({
        error: error?.message || "GAS 동기화 중 오류가 발생했습니다.",
      });
    }
  });

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
