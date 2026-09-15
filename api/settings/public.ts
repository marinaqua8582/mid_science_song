import { GasRequestError } from '../_lib/gas';
import { setPrivateJsonHeaders } from '../_lib/http';
import { evaluateStudentAccess, readSettings } from '../_lib/settings';

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { settings } = await readSettings();
    return res.status(200).json({ status: 'success', access: evaluateStudentAccess(settings) });
  } catch (error: any) {
    const status = error instanceof GasRequestError ? error.status : 500;
    return res.status(status).json({
      status: 'error',
      code: 'ACCESS_STATUS_UNAVAILABLE',
      message: '학생 접속 가능 시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
}
