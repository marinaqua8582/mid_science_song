import { GasRequestError, requestGas } from './_lib/gas.js';
import { readRequestBody, rejectInvalidOrigin, setPrivateJsonHeaders } from './_lib/http.js';
import { getAdminSession, getStudentSession } from './_lib/session.js';
import { requireStudentAccess } from './_lib/settings.js';

const ADMIN_READ_ACTIONS = new Set(['getRoster', 'getSubmissions', 'getData']);
const ADMIN_WRITE_ACTIONS = new Set(['saveRoster', 'upsertRosterStudent', 'deleteRosterStudent']);
const STUDENT_READ_ACTIONS = new Set(['getStudentData', 'getSubmission', 'getStudentGoogleId']);
const STUDENT_WRITE_ACTIONS = new Set(['saveSubmission', 'saveStudentData']);

function publicRosterRows(value: any): any[] {
  const rows = Array.isArray(value?.data) ? value.data : [];
  if (rows.length === 0) return [];

  if (!Array.isArray(rows[0])) {
    return rows.map((item: any) => ({
      id: String(item?.id || ''),
      grade: Number(item?.grade) || 2,
      classNum: Number(item?.classNum) || 0,
      studentNum: Number(item?.studentNum) || 0,
    })).filter((item: any) => item.classNum > 0 && item.studentNum > 0);
  }

  const first = rows[0].map((cell: unknown) => String(cell || '').trim());
  const hasHeader = first.includes('학년') || first.includes('반') || first.includes('번호');
  const idIndex = hasHeader ? first.findIndex((cell: string) => cell.toLowerCase() === 'id') : 0;
  const gradeIndex = hasHeader ? first.findIndex((cell: string) => cell.includes('학년')) : 1;
  const classIndex = hasHeader ? first.findIndex((cell: string) => cell === '반') : 2;
  const numIndex = hasHeader ? first.findIndex((cell: string) => cell.includes('번호')) : 3;
  return rows.slice(hasHeader ? 1 : 0).map((row: any[]) => ({
    id: String(row[idIndex] || ''),
    grade: Number(row[gradeIndex]) || 2,
    classNum: Number(row[classIndex]) || 0,
    studentNum: Number(row[numIndex]) || 0,
  })).filter((item: any) => item.classNum > 0 && item.studentNum > 0);
}

function requestStudentPayload(session: any): Record<string, any> {
  return {
    id: `sub-${session.id}`,
    grade: session.grade,
    classNum: session.classNum,
    studentNum: session.studentNum,
    name: session.name,
  };
}

function studentSubmissionPayload(body: any, session: any): Record<string, any> {
  const source = body?.data && typeof body.data === 'object' ? body.data : body;
  const safe = { ...source, ...requestStudentPayload(session) };

  // 학생 요청으로 교사 점수나 피드백을 변경할 수 없도록 평가 필드를 제거합니다.
  delete safe.action;
  delete safe.gasUrl;
  delete safe.secret;
  delete safe.evaluation;
  delete safe.evaluationJson;
  delete safe.score;
  delete safe.totalScore;
  delete safe.feedback;
  return safe;
}

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (rejectInvalidOrigin(req, res)) return;

  const body = readRequestBody(req);
  const action = String(body.action || '').trim();
  if (!action) {
    return res.status(400).json({ status: 'error', message: 'action이 필요합니다.' });
  }

  try {
    if (action === 'ping') {
      const data = await requestGas('ping', { method: 'GET' });
      return res.status(200).json(data);
    }

    if (action === 'getPublicRoster') {
      const data = await requestGas('getPublicRoster', { method: 'GET' });
      return res.status(200).json({ status: 'success', data: publicRosterRows(data) });
    }

    const admin = getAdminSession(req);
    if (ADMIN_READ_ACTIONS.has(action)) {
      if (!admin) return res.status(401).json({ status: 'error', message: '교사 로그인이 필요합니다.' });
      const data = await requestGas(action, { method: 'GET' });
      return res.status(200).json(data);
    }

    if (ADMIN_WRITE_ACTIONS.has(action)) {
      if (!admin) return res.status(401).json({ status: 'error', message: '교사 로그인이 필요합니다.' });
      const payload = action === 'saveRoster'
        ? { roster: Array.isArray(body.roster) ? body.roster : [] }
        : { student: body.student || body.data || {} };
      const data = await requestGas(action, { method: 'POST', payload });
      return res.status(200).json(data);
    }

    if (STUDENT_READ_ACTIONS.has(action)) {
      if (admin) {
        const source = body?.data && typeof body.data === 'object' ? body.data : body;
        const data = await requestGas(action, { method: 'GET', payload: source });
        return res.status(200).json(data);
      }

      const student = getStudentSession(req);
      if (!student) return res.status(401).json({ status: 'error', message: '학생 로그인이 필요합니다.' });
      const data = await requestGas(action, { method: 'GET', payload: requestStudentPayload(student) });
      return res.status(200).json(data);
    }

    if (STUDENT_WRITE_ACTIONS.has(action)) {
      if (admin) {
        const source = body?.data && typeof body.data === 'object' ? body.data : body;
        const data = await requestGas(action, { method: 'POST', payload: { data: source } });
        return res.status(200).json(data);
      }

      const student = getStudentSession(req);
      if (!student) return res.status(401).json({ status: 'error', message: '학생 로그인이 필요합니다.' });
      const access = await requireStudentAccess();
      if (!access.isOpen) {
        return res.status(403).json({
          status: 'error',
          code: 'STUDENT_ACCESS_CLOSED',
          message: access.message,
          access,
        });
      }
      const data = await requestGas(action, {
        method: 'POST',
        payload: { data: studentSubmissionPayload(body, student) },
      });
      return res.status(200).json(data);
    }

    return res.status(400).json({ status: 'error', message: '허용되지 않은 action입니다.' });
  } catch (error: any) {
    const status = error instanceof GasRequestError ? error.status : 500;
    return res.status(status).json({
      status: 'error',
      message: error?.message || 'Google Sheets 연동 중 오류가 발생했습니다.',
    });
  }
}
