import { gasConfigurationStatus } from './_lib/gas.js';
import { isAdminPasswordConfigured } from './_lib/password.js';
import { isSessionConfigured } from './_lib/session.js';
import { setPrivateJsonHeaders } from './_lib/http.js';

export default function handler(req: any, res: any) {
  setPrivateJsonHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }
  const gas = gasConfigurationStatus();
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    configured: {
      gas: gas.configured,
      adminPassword: isAdminPasswordConfigured(),
      session: isSessionConfigured(),
    },
  });
}
