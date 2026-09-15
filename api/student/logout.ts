import { clearStudentSession } from '../_lib/session';
import { rejectInvalidOrigin, setPrivateJsonHeaders } from '../_lib/http';

export default function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  if (rejectInvalidOrigin(req, res)) return;
  clearStudentSession(res);
  return res.status(200).json({ status: 'success' });
}
