import { clearAdminSession } from '../_lib/session.js';
import { rejectInvalidOrigin, setPrivateJsonHeaders } from '../_lib/http.js';

export default function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (rejectInvalidOrigin(req, res)) return;
  clearAdminSession(res);
  return res.status(200).json({ status: 'success' });
}
