import { isAdminPasswordConfigured, verifyAdminPassword } from '../_lib/password';
import { isSessionConfigured, setAdminSession } from '../_lib/session';
import { readRequestBody, rejectInvalidOrigin, requestIp, setPrivateJsonHeaders } from '../_lib/http';
import { consumeRateLimit } from '../_lib/rate-limit';

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (rejectInvalidOrigin(req, res)) return;

  if (!isAdminPasswordConfigured() || !isSessionConfigured()) {
    return res.status(503).json({
      status: 'error',
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      message: '관리자 보안 설정이 아직 완료되지 않았습니다. Vercel 환경 변수를 확인해 주세요.',
    });
  }

  const rate = consumeRateLimit(`admin-login:${requestIp(req)}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      status: 'error',
      message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    });
  }

  const body = readRequestBody(req);
  if (!verifyAdminPassword(body.password)) {
    return res.status(401).json({ status: 'error', message: '비밀번호가 일치하지 않습니다.' });
  }

  setAdminSession(res);
  return res.status(200).json({ status: 'success', authenticated: true });
}
