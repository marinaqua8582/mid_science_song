import { AppSettings, StudentAccessStatus, StudentRosterItem } from '../types';

const ACCESS_STATUS_CACHE_KEY = 'science_song_student_access_status';
const ACCESS_STATUS_CACHE_MS = 5 * 60 * 1000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function readJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError('서버에서 올바른 응답을 받지 못했습니다.', response.status || 500);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || '요청을 처리하지 못했습니다.',
      response.status,
      data?.code,
    );
  }
  return data;
}

// AbortController also supports older classroom mobile browsers.
async function readEndpoint(
  url: string,
  cache: RequestCache = 'no-store',
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET', credentials: 'same-origin', cache, signal: controller.signal,
    });
    // Consume the body within the timeout, including a stalled response body.
    const body = await response.text();
    return new Response(body, { status: response.status, headers: response.headers });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError('서버 응답이 늦어지고 있습니다. 잠시 후 다시 불러와 주세요.', 504);
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export interface StudentBootstrapResponse {
  access: StudentAccessStatus;
  roster: StudentRosterItem[];
}

export async function fetchStudentBootstrap(): Promise<StudentBootstrapResponse> {
  try {
    const response = await readEndpoint('/api/settings/public', 'default');
    const data = await readJson(response);
    const access = data.access as StudentAccessStatus;
    const roster = Array.isArray(data.roster) ? data.roster as StudentRosterItem[] : [];
    localStorage.setItem(ACCESS_STATUS_CACHE_KEY, JSON.stringify({ access, roster, cachedAt: Date.now() }));
    return { access, roster };
  } catch (error) {
    try {
      const raw = localStorage.getItem(ACCESS_STATUS_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : null;
      if (cached?.access && Number(cached.cachedAt) + ACCESS_STATUS_CACHE_MS > Date.now()) {
        return {
          access: cached.access as StudentAccessStatus,
          roster: Array.isArray(cached.roster) ? cached.roster as StudentRosterItem[] : [],
        };
      }
    } catch {
      // Ignore an invalid browser cache and surface the original server error.
    }
    throw error;
  }
}

export async function loginStudent(
  student: Pick<StudentRosterItem, 'grade' | 'classNum' | 'studentNum' | 'name'>,
): Promise<StudentRosterItem> {
  const response = await fetch('/api/student/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student),
  });
  const data = await readJson(response);
  return data.student as StudentRosterItem;
}

export async function logoutStudent(): Promise<void> {
  await fetch('/api/student/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => undefined);
}

export async function getAdminSession(): Promise<boolean> {
  const response = await readEndpoint('/api/admin/session');
  if (response.status === 401) return false;
  const data = await readJson(response);
  return data.authenticated === true;
}

export async function loginAdmin(password: string): Promise<void> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await readJson(response);
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  await readJson(response);
}

export interface AdminSettingsResponse {
  settings: AppSettings;
  initialized: boolean;
}

export interface AdminDashboardResponse extends AdminSettingsResponse {
  roster: any[];
  submissions: any[];
}

export async function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  const response = await readEndpoint('/api/admin/dashboard', 'no-store', 40_000);
  return readJson(response);
}

export async function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  const response = await readEndpoint('/api/settings/admin');
  return readJson(response);
}

export async function saveAdminSettings(settings: AppSettings): Promise<AppSettings> {
  const response = await fetch('/api/settings/admin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  const data = await readJson(response);
  return data.settings as AppSettings;
}
