import { GAS_SCRIPT } from '../src/data/gasScript';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(GAS_SCRIPT);
}
