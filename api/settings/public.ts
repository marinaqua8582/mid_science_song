import { GasRequestError } from '../_lib/gas.js';
import { setPrivateJsonHeaders } from '../_lib/http.js';
import { evaluateStudentAccess, readPublicSettings } from '../_lib/settings.js';

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { settings } = await readPublicSettings();
    // This response contains no personal or secret data. A short shared cache
    // prevents every classroom device from cold-starting Apps Script, while
    // server-side login/save checks continue to use live settings.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=300');
    return res.status(200).json({ status: 'success', access: evaluateStudentAccess(settings) });
  } catch (error: any) {
    console.error('Public settings error:', error?.name || 'Error', error?.message || 'Unknown error');
    const status = error instanceof GasRequestError ? error.status : 500;
    return res.status(status).json({
      status: 'error',
      code: 'ACCESS_STATUS_UNAVAILABLE',
      message: '학생 접속 가능 시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
}
