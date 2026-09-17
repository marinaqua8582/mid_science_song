import { GasRequestError, requestGas } from '../_lib/gas.js';
import { setPrivateJsonHeaders } from '../_lib/http.js';
import { getAdminSession } from '../_lib/session.js';
import { DEFAULT_APP_SETTINGS, normalizeSettings, readSettings } from '../_lib/settings.js';

function settingsFromGas(value: any): { settings: typeof DEFAULT_APP_SETTINGS; initialized: boolean } {
  const initialized = value?.found === true && value?.settings && typeof value.settings === 'object';
  return {
    settings: normalizeSettings(initialized ? value.settings : DEFAULT_APP_SETTINGS),
    initialized,
  };
}

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (!getAdminSession(req)) {
    return res.status(401).json({ status: 'error', message: '교사 로그인이 필요합니다.' });
  }

  try {
    try {
      const combined = await requestGas('getAdminDashboardData', { method: 'GET' });
      const parsedSettings = settingsFromGas(combined?.settings);
      return res.status(200).json({
        status: 'success',
        ...parsedSettings,
        roster: Array.isArray(combined?.roster) ? combined.roster : [],
        submissions: Array.isArray(combined?.submissions) ? combined.submissions : [],
      });
    } catch (error: any) {
      // Keep the Vercel deployment compatible with the previous Apps Script
      // version until the teacher publishes the optimized script.
      const canUseLegacyFallback = error instanceof GasRequestError &&
        error.status === 400 && /Invalid read action/i.test(error.message);
      if (!canUseLegacyFallback) throw error;
    }

    const [settingsResult, rosterResult, submissionsResult] = await Promise.all([
      readSettings(true),
      requestGas('getRoster', { method: 'GET' }),
      requestGas('getSubmissions', { method: 'GET' }),
    ]);
    return res.status(200).json({
      status: 'success',
      ...settingsResult,
      roster: Array.isArray(rosterResult?.data) ? rosterResult.data : [],
      submissions: Array.isArray(submissionsResult?.data) ? submissionsResult.data : [],
    });
  } catch (error: any) {
    const status = error instanceof GasRequestError ? error.status : 500;
    return res.status(status).json({
      status: 'error',
      message: error?.message || '교사 자료를 불러오지 못했습니다.',
    });
  }
}
