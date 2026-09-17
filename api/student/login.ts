import { requestGas, GasRequestError } from '../_lib/gas.js';
import { readRequestBody, rejectInvalidOrigin, requestIp, setPrivateJsonHeaders } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';
import { isSessionConfigured, normalizeStudentName, setStudentSession } from '../_lib/session.js';
import { requireStudentAccess } from '../_lib/settings.js';

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (rejectInvalidOrigin(req, res)) return;
  if (!isSessionConfigured()) {
    return res.status(503).json({ status: 'error', message: '학생 로그인 보안 설정이 아직 완료되지 않았습니다.' });
  }

  const rate = consumeRateLimit(`student-login:${requestIp(req)}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({ status: 'error', message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  }

  try {
    const access = await requireStudentAccess();
    if (!access.isOpen) {
      return res.status(403).json({
        status: 'error',
        code: 'STUDENT_ACCESS_CLOSED',
        message: access.message,
        access,
      });
    }

    const body = readRequestBody(req);
    const grade = Number(body.grade) || 2;
    const classNum = Number(body.classNum);
    const studentNum = Number(body.studentNum);
    const name = String(body.name || '').trim().slice(0, 100);
    if (!classNum || !studentNum || !name) {
      return res.status(400).json({ status: 'error', message: '학년, 반, 번호, 이름을 모두 입력해 주세요.' });
    }

    const result = await requestGas('verifyStudent', {
      method: 'GET',
      payload: { grade, classNum, studentNum, name },
    });
    const verified = result?.student;
    if (!result?.found || !verified || normalizeStudentName(verified.name) !== normalizeStudentName(name)) {
      return res.status(401).json({
        status: 'error',
        message: '입력한 정보와 학생 명단이 일치하지 않습니다.',
      });
    }

    const verifiedGrade = Number(verified.grade) || grade;
    const verifiedClass = Number(verified.classNum) || classNum;
    const verifiedNum = Number(verified.studentNum) || studentNum;
    const student = {
      // Keep one stable identity even when the Roster sheet's ID column is missing,
      // duplicated, or uses a legacy arbitrary value.
      id: `${verifiedGrade}-${verifiedClass}-${String(verifiedNum).padStart(2, '0')}`,
      grade: verifiedGrade,
      classNum: verifiedClass,
      studentNum: verifiedNum,
      name: String(verified.name || name),
    };
    setStudentSession(res, student);
    return res.status(200).json({ status: 'success', student });
  } catch (error: any) {
    const status = error instanceof GasRequestError ? error.status : 500;
    return res.status(status).json({
      status: 'error',
      message: error?.message || '학생 로그인 중 오류가 발생했습니다.',
    });
  }
}
