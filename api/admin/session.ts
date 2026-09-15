import { getAdminSession, isSessionConfigured } from '../_lib/session.js';
import { setPrivateJsonHeaders } from '../_lib/http.js';

export default function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (!isSessionConfigured()) {
    return res.status(503).json({
      status: 'error',
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      message: '관리자 보안 설정이 아직 완료되지 않았습니다.',
    });
  }

  const session = getAdminSession(req);
  if (!session) {
    return res.status(401).json({ status: 'error', authenticated: false });
  }
  return res.status(200).json({ status: 'success', authenticated: true });
}
