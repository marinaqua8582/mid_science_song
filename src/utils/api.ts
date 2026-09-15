import { AppSettings, StudentAccessStatus, StudentRosterItem } from '../types';

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

export async function fetchStudentAccessStatus(): Promise<StudentAccessStatus> {
  const response = await fetch('/api/settings/public', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await readJson(response);
  return data.access as StudentAccessStatus;
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
  const response = await fetch('/api/admin/session', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
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

export async function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  const response = await fetch('/api/settings/admin', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
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
