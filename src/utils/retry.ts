export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function retryDelay(value: string | null, attempt: number): number {
  const seconds = value === null ? NaN : Number(value);
  const headerMs = Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(value || '') - Date.now());
  return Math.max(Number.isFinite(headerMs) ? headerMs : 0, 500 * 2 ** attempt + Math.random() * 300);
}

// A stable body (including requestId) is reused across all attempts.
export async function fetchWithRetry(url: string, init: RequestInit, statuses: number[]): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (attempt >= 2 || !statuses.includes(response.status)) return response;
    const delay = retryDelay(response.headers.get('Retry-After'), attempt);
    // Do not hold a browser request open for a long quota reset period.
    if (delay > 15_000) return response;
    await response.text();
    await pause(delay);
  }
}
