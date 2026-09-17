import { GasRequestError, requestGas } from '../_lib/gas.js';
import { setPrivateJsonHeaders } from '../_lib/http.js';
import {
  DEFAULT_APP_SETTINGS, evaluateStudentAccess, normalizeSettings, readPublicSettings,
} from '../_lib/settings.js';

function publicRosterRows(value: any): any[] {
  const rows = Array.isArray(value?.data) ? value.data : [];
  return rows.map((item: any) => ({
    id: String(item?.id || ''),
    grade: Number(item?.grade) || 2,
    classNum: Number(item?.classNum) || 0,
    studentNum: Number(item?.studentNum) || 0,
  })).filter((item: any) => item.classNum > 0 && item.studentNum > 0);
}

function settingsFromGas(value: any) {
  const initialized = value?.found === true && value?.settings && typeof value.settings === 'object';
  return normalizeSettings(initialized ? value.settings : DEFAULT_APP_SETTINGS);
}

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    let settings;
    let rosterResponse;
    try {
      const combined = await requestGas('getStudentBootstrap', { method: 'GET' });
      settings = settingsFromGas(combined?.settings);
      rosterResponse = { data: combined?.roster };
    } catch (error: any) {
      // Stay compatible until the optimized Apps Script version is published.
      const canUseLegacyFallback = error instanceof GasRequestError &&
        error.status === 400 && /Invalid read action/i.test(error.message);
      if (!canUseLegacyFallback) throw error;
      const [settingsResult, rosterResult] = await Promise.all([
        readPublicSettings(),
        requestGas('getPublicRoster', { method: 'GET' }),
      ]);
      settings = settingsResult.settings;
      rosterResponse = rosterResult;
    }

    // This response contains no personal or secret data. A short shared cache
    // prevents every classroom device from cold-starting Apps Script, while
    // server-side login/save checks continue to use live settings.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=300');
    return res.status(200).json({
      status: 'success',
      access: evaluateStudentAccess(settings),
      roster: publicRosterRows(rosterResponse),
    });
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
