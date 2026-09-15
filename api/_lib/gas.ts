const REQUEST_TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 3;

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

function isAllowedGasResponseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com');
  } catch {
    return false;
  }
}

async function fetchGasResponse(
  input: string | URL,
  init: RequestInit,
): Promise<Response> {
  let url = String(input);
  let requestInit: RequestInit = { ...init, redirect: 'manual' };

  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    const response = await fetch(url, requestInit);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) throw new GasRequestError('Google Apps Script 응답 주소를 확인할 수 없습니다.');
    const nextUrl = new URL(location, url).toString();
    if (!isAllowedGasResponseUrl(nextUrl)) {
      throw new GasRequestError('Google Apps Script가 허용되지 않은 주소로 응답했습니다.');
    }
    url = nextUrl;

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && requestInit.method === 'POST')) {
      requestInit = { method: 'GET', signal: init.signal, redirect: 'manual' };
    }
  }
  throw new GasRequestError('Google Apps Script 응답 이동 횟수를 초과했습니다.');
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
      response = await fetchGasResponse(url, { method: 'GET', signal: controller.signal });
    } else {
      response = await fetchGasResponse(gasUrl, {
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
      let responseHost = 'unknown';
      let responsePath = 'unknown';
      try {
        const responseUrl = new URL(response.url);
        responseHost = responseUrl.hostname;
        responsePath = responseUrl.pathname;
      } catch {
        // Keep safe fallback values. Never log the query string because it can contain the secret.
      }
      console.error('Invalid GAS response metadata:', {
        status: response.status,
        contentType: response.headers.get('content-type') || 'unknown',
        responseHost,
        responsePath,
        bodyLength: responseText.length,
      });
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
