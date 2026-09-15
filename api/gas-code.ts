import { GAS_SCRIPT } from '../src/data/gasScript.js';
import { getAdminSession } from './_lib/session.js';

export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  if (!getAdminSession(req)) return res.status(401).send('교사 로그인이 필요합니다.');
  return res.status(200).send(GAS_SCRIPT);
}
