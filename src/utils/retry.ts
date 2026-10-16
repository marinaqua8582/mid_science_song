export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function retryDelay(value: string | null, attempt: number): number {
  const seconds = value === null ? NaN : Number(value);
  const headerMs = Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(value || '') - Date.now());
  // Add independent full jitter AFTER Retry-After, so its floor cannot synchronize clients.
  return Math.max(0, Number.isFinite(headerMs) ? headerMs : 0) + 100 + Math.random() * (500 * 2 ** attempt);
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
