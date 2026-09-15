import { randomBytes } from 'node:crypto';

const gasSecret = randomBytes(32).toString('base64url');
const sessionSecret = randomBytes(48).toString('base64url');

process.stdout.write('아래 값은 외부에 공유하거나 GitHub에 올리지 마세요.\n\n');
process.stdout.write(`GAS_API_SECRET=${gasSecret}\n`);
process.stdout.write(`SESSION_SECRET=${sessionSecret}\n`);
