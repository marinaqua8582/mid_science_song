import { GasRequestError, requestGas } from '../_lib/gas.js';
import { setPrivateJsonHeaders } from '../_lib/http.js';

function publicRosterRows(value: any): any[] {
  const rows = Array.isArray(value?.data) ? value.data : [];
  if (rows.length === 0) return [];

  if (!Array.isArray(rows[0])) {
    return rows.map((item: any) => ({
      id: String(item?.id || ''),
      grade: Number(item?.grade) || 2,
      classNum: Number(item?.classNum) || 0,
      studentNum: Number(item?.studentNum) || 0,
    })).filter((item: any) => item.classNum > 0 && item.studentNum > 0);
  }

  const first = rows[0].map((cell: unknown) => String(cell || '').trim());
  const hasHeader = first.includes('학년') || first.includes('반') || first.includes('번호');
  const idIndex = hasHeader ? first.findIndex((cell: string) => cell.toLowerCase() === 'id') : 0;
  const gradeIndex = hasHeader ? first.findIndex((cell: string) => cell.includes('학년')) : 1;
  const classIndex = hasHeader ? first.findIndex((cell: string) => cell === '반') : 2;
  const numIndex = hasHeader ? first.findIndex((cell: string) => cell.includes('번호')) : 3;
  return rows.slice(hasHeader ? 1 : 0).map((row: any[]) => ({
    id: String(row[idIndex] || ''),
    grade: Number(row[gradeIndex]) || 2,
    classNum: Number(row[classIndex]) || 0,
    studentNum: Number(row[numIndex]) || 0,
  })).filter((item: any) => item.classNum > 0 && item.studentNum > 0);
}

export default async function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const data = await requestGas('getPublicRoster', { method: 'GET' });
    // This response intentionally excludes student names and Google IDs.
    // A shared cache avoids one Apps Script cold start per classroom device.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).json({ status: 'success', data: publicRosterRows(data) });
  } catch (error: any) {
    const status = error instanceof GasRequestError ? error.status : 500;
    return res.status(status).json({
      status: 'error',
      message: error?.message || '학생 명단을 불러오지 못했습니다.',
    });
  }
}
