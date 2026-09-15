import { createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_COOKIE = 'science_song_admin_session';
const STUDENT_COOKIE = 'science_song_student_session';
const ADMIN_MAX_AGE_SECONDS = 8 * 60 * 60;
const STUDENT_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface AdminSession {
  role: 'admin';
  exp: number;
}

export interface StudentSession {
  role: 'student';
  id: string;
  grade: number;
  classNum: number;
  studentNum: number;
  name: string;
  exp: number;
}

function getSessionSecret(): string | null {
  const secret = String(process.env.SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function signSession(payload: AdminSession | StudentSession): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error('SESSION_SECRET_MISSING');
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

function verifySession<T extends AdminSession | StudentSession>(token: string | undefined): T | null {
  const secret = getSessionSecret();
  if (!secret || !token) return null;

  const [encoded, receivedSignature, extra] = token.split('.');
  if (!encoded || !receivedSignature || extra) return null;

  const expectedSignature = signature(encoded, secret);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(decode(encoded)) as T;
    if (!payload || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookies(req: any): Record<string, string> {
  const header = String(req?.headers?.cookie || '');
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function cookieOptions(maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function isSessionConfigured(): boolean {
  return Boolean(getSessionSecret());
}

export function getAdminSession(req: any): AdminSession | null {
  const session = verifySession<AdminSession>(readCookies(req)[ADMIN_COOKIE]);
  return session?.role === 'admin' ? session : null;
}

export function setAdminSession(res: any): void {
  const payload: AdminSession = {
    role: 'admin',
    exp: Date.now() + ADMIN_MAX_AGE_SECONDS * 1000,
  };
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(signSession(payload))}; ${cookieOptions(ADMIN_MAX_AGE_SECONDS)}`);
}

export function clearAdminSession(res: any): void {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; ${cookieOptions(0)}`);
}

export function getStudentSession(req: any): StudentSession | null {
  const session = verifySession<StudentSession>(readCookies(req)[STUDENT_COOKIE]);
  return session?.role === 'student' ? session : null;
}

export function setStudentSession(
  res: any,
  student: Omit<StudentSession, 'role' | 'exp'>,
): void {
  const payload: StudentSession = {
    role: 'student',
    ...student,
    exp: Date.now() + STUDENT_MAX_AGE_SECONDS * 1000,
  };
  res.setHeader('Set-Cookie', `${STUDENT_COOKIE}=${encodeURIComponent(signSession(payload))}; ${cookieOptions(STUDENT_MAX_AGE_SECONDS)}`);
}

export function clearStudentSession(res: any): void {
  res.setHeader('Set-Cookie', `${STUDENT_COOKIE}=; ${cookieOptions(0)}`);
}

export function normalizeStudentName(value: unknown): string {
  return String(value || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

export function isSameStudent(session: StudentSession, value: any): boolean {
  const candidate = value?.data && typeof value.data === 'object' ? value.data : value;
  return Number(candidate?.grade || 2) === session.grade &&
    Number(candidate?.classNum) === session.classNum &&
    Number(candidate?.studentNum) === session.studentNum &&
    normalizeStudentName(candidate?.name) === normalizeStudentName(session.name);
}
