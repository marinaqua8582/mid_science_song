const REQUEST_TIMEOUT_MS = 15_000;

export class GasRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'GasRequestError';
    this.status = status;
  }
}

function getGasUrl(): string {
  return String(
    process.env.GAS_WEB_APP_URL ||
    process.env.GAS_URL ||
    '',
  ).trim();
}

function getGasSecret(): string {
  return String(process.env.GAS_API_SECRET || '').trim();
}

function isAllowedGasUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'script.google.com' &&
      /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function gasConfigurationStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!isAllowedGasUrl(getGasUrl())) missing.push('GAS_WEB_APP_URL');
  if (getGasSecret().length < 24) missing.push('GAS_API_SECRET');
  return { configured: missing.length === 0, missing };
}

export async function requestGas(
  action: string,
  options: { method?: 'GET' | 'POST'; payload?: Record<string, any> } = {},
): Promise<any> {
  const gasUrl = getGasUrl();
  const secret = getGasSecret();
  const status = gasConfigurationStatus();
  if (!status.configured) {
    throw new GasRequestError(`서버 연동 설정이 필요합니다: ${status.missing.join(', ')}`, 503);
  }

  const method = options.method || 'POST';
  const payload = options.payload || {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    if (method === 'GET') {
      const url = new URL(gasUrl);
      url.searchParams.set('action', action);
      url.searchParams.set('secret', secret);
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null || typeof value === 'object') return;
        url.searchParams.set(key, String(value));
      });
      response = await fetch(url, { method: 'GET', signal: controller.signal });
    } else {
      response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, action, secret }),
        signal: controller.signal,
      });
    }

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new GasRequestError('Google Apps Script가 올바른 JSON 응답을 보내지 않았습니다.');
    }

    if (!response.ok || data?.status === 'error') {
      throw new GasRequestError(
        data?.message || `Google Apps Script 요청에 실패했습니다. (${response.status})`,
        response.ok ? 400 : 502,
      );
    }
    return data;
  } catch (error: any) {
    if (error instanceof GasRequestError) throw error;
    if (error?.name === 'AbortError') {
      throw new GasRequestError('Google Apps Script 응답 시간이 초과되었습니다.', 504);
    }
    throw new GasRequestError(error?.message || 'Google Sheets 연동 중 오류가 발생했습니다.');
  } finally {
    clearTimeout(timeout);
  }
}
