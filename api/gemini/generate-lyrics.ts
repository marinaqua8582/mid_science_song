import { GoogleGenAI } from "@google/genai";
import { readRequestBody, rejectInvalidOrigin, setPrivateJsonHeaders } from "../_lib/http";
import { consumeRateLimit } from "../_lib/rate-limit";
import { getStudentSession } from "../_lib/session";
import { requireStudentAccess } from "../_lib/settings";

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (rejectInvalidOrigin(req, res)) return;

  const student = getStudentSession(req);
  if (!student) {
    return res.status(401).json({ error: "학생 로그인이 필요합니다." });
  }

  try {
    const access = await requireStudentAccess();
    if (!access.isOpen) {
      return res.status(403).json({
        error: access.message,
        code: "STUDENT_ACCESS_CLOSED",
        access,
      });
    }

    const rate = consumeRateLimit(`gemini:${student.id}`, 10, 30 * 60 * 1000);
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      return res.status(429).json({ error: "가사 생성 횟수가 많습니다. 잠시 후 다시 시도해 주세요." });
    }

    const body = readRequestBody(req);
    const {
      unit,
      summary,
      keywords,
      genre,
      structurePrompt,
      situationPrompt,
      customPrompt,
    } = body;

    if (!unit || !summary) {
      return res.status(400).json({ error: "과학 단원과 학습 내용을 입력해주세요." });
    }

    if (String(summary).length > 12_000 || String(customPrompt || '').length > 4_000) {
      return res.status(400).json({ error: "입력 내용이 너무 깁니다. 내용을 줄인 후 다시 시도해 주세요." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 또는 서버 환경 변수에 GEMINI_API_KEY를 등록해주세요.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

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

    return res.status(200).json({ lyrics });
  } catch (error: any) {
    console.error("Gemini API generation error:", error);
    return res.status(500).json({
      error: error?.message || "Gemini API 가사 생성 중 오류가 발생했습니다.",
    });
  }
}
