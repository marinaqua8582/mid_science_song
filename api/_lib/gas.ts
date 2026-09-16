const REQUEST_TIMEOUT_MS = 15_000;
const READ_BUDGET_MS = 25_000;
const pendingReads = new Map<string, Promise<any>>();

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

async function fetchGasResponse(
  input: string | URL,
  init: RequestInit,
): Promise<Response> {
  // Apps Script ContentService responses are served through a temporary
  // googleusercontent URL. Let the Fetch implementation carry the redirect
  // state so the one-time response URL is consumed in the same request flow.
  return fetch(input, { ...init, redirect: 'follow', cache: 'no-store' });
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
  if (options.method !== 'GET') return requestGasOnce(action, options);
  const key = JSON.stringify([getGasUrl(), action, options.payload || {}]);
  const existing = pendingReads.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const deadline = Date.now() + READ_BUDGET_MS;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new GasRequestError('Google Apps Script 응답 시간이 초과되었습니다.', 504);
      try {
        return await requestGasOnce(action, options, Math.min(REQUEST_TIMEOUT_MS, remaining));
      } catch (error) {
        if (!(error instanceof GasRequestError) || ![502, 504].includes(error.status) || attempt === 2) throw error;
      }
    }
  })();
  pendingReads.set(key, pending);
  try { return await pending; }
  finally { if (pendingReads.get(key) === pending) pendingReads.delete(key); }
}

async function requestGasOnce(
  action: string,
  options: { method?: 'GET' | 'POST'; payload?: Record<string, any> },
  timeoutMs = REQUEST_TIMEOUT_MS,
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    if (method === 'GET') {
      const url = new URL(gasUrl);
      // Apps Script redirects to a short-lived googleusercontent response URL.
      // A unique request key prevents an intermediary from reusing an expired
      // redirect for repeated reads such as settings and roster refreshes.
      url.searchParams.set('_request', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
