import { GasRequestError } from '../_lib/gas';
import { readRequestBody, rejectInvalidOrigin, setPrivateJsonHeaders } from '../_lib/http';
import { getAdminSession } from '../_lib/session';
import { readSettings, writeSettings } from '../_lib/settings';

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (!getAdminSession(req)) {
    return res.status(401).json({ status: 'error', message: '교사 로그인이 필요합니다.' });
  }

  try {
    if (req.method === 'GET') {
      const result = await readSettings(true);
      return res.status(200).json({ status: 'success', ...result });
    }

    if (rejectInvalidOrigin(req, res)) return;
    const body = readRequestBody(req);
    const settings = await writeSettings(body.settings);
    return res.status(200).json({ status: 'success', settings, initialized: true });
  } catch (error: any) {
    const status = error instanceof GasRequestError ? error.status : 400;
    return res.status(status).json({
      status: 'error',
      message: error?.message || '설정을 저장하지 못했습니다.',
    });
  }
}
