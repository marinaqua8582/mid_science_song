import { gasConfigurationStatus } from './_lib/gas';
import { isAdminPasswordConfigured } from './_lib/password';
import { isSessionConfigured } from './_lib/session';
import { setPrivateJsonHeaders } from './_lib/http';

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
