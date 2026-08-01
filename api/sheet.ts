const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbwnhnAzyN6HP__bXd0N_KzTY-GZOZ8ayqO6BD0i_iaMJPuxUGNsFDKys7c38VFleeJnDg/exec';

const READ_ACTIONS = new Set([
  'ping',
  'getRoster',
  'getSubmissions',
  'getData',
  'getStudentData',
  'getSubmission',
]);

function isAllowedGasUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'script.google.com' &&
      /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const gasUrl =
      process.env.GAS_URL ||
      process.env.NEXT_PUBLIC_GAS_URL ||
      process.env.VITE_GAS_URL ||
      body.gasUrl ||
      DEFAULT_GAS_URL;

    if (!isAllowedGasUrl(gasUrl)) {
      return res.status(400).json({ status: 'error', message: '올바르지 않은 Google Apps Script URL입니다.' });
    }

    const action = String(body.action || '');
    if (!action) {
      return res.status(400).json({ status: 'error', message: 'action이 필요합니다.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let upstream: Response;

    try {
      if (READ_ACTIONS.has(action)) {
        // 조회는 반드시 GET으로 전달하여 잘못된 Apps Script가 빈 제출 행을 만드는 일을 막습니다.
        const url = new URL(gasUrl);
        Object.entries(body).forEach(([key, value]) => {
          if (key === 'gasUrl' || value === undefined || value === null || typeof value === 'object') return;
          url.searchParams.set(key, String(value));
        });
        url.searchParams.set('action', action);
        upstream = await fetch(url, { method: 'GET', signal: controller.signal });
      } else {
        const { gasUrl: _ignored, ...payload } = body;
        upstream = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        status: 'error',
        message: 'Google Apps Script가 JSON 형식으로 응답하지 않았습니다. 새 Apps Script 버전을 배포해 주세요.',
      });
    }

    return res.status(upstream.ok ? 200 : 502).json(data);
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'Google Apps Script 응답 시간이 초과되었습니다.'
      : (error?.message || 'Google Sheets 연동 중 오류가 발생했습니다.');
    return res.status(500).json({ status: 'error', message });
  }
}
