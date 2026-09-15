export function setPrivateJsonHeaders(res: any): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
}

export function readRequestBody(req: any): any {
  if (!req?.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function requestIp(req: any): string {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || 'unknown');
}

export function hasValidOrigin(req: any): boolean {
  const origin = String(req?.headers?.origin || '').trim();
  if (!origin) return true;

  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req?.headers?.host || '').trim();
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function rejectInvalidOrigin(req: any, res: any): boolean {
  if (hasValidOrigin(req)) return false;
  res.status(403).json({ status: 'error', message: '허용되지 않은 요청 출처입니다.' });
  return true;
}
