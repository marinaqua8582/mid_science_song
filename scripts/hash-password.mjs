import { randomBytes, scryptSync } from 'node:crypto';

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('이 명령은 PowerShell 또는 터미널에서 직접 실행해 주세요.'));
      return;
    }

    let value = '';
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    };

    const onData = (key) => {
      if (key === '\u0003') {
        cleanup();
        process.stdout.write('\n');
        reject(new Error('취소되었습니다.'));
        return;
      }
      if (key === '\r' || key === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (key === '\u0008' || key === '\u007f') {
        value = value.slice(0, -1);
        return;
      }
      if (/^[\x20-\x7E가-힣]+$/.test(key)) value += key;
    };

    process.stdin.on('data', onData);
  });
}

try {
  const password = await readHidden('새 교사 비밀번호 입력(화면에 표시되지 않음): ');
  const confirmation = await readHidden('새 교사 비밀번호 다시 입력: ');
  if (password.length < 8) throw new Error('비밀번호는 8자 이상으로 설정해 주세요.');
  if (password !== confirmation) throw new Error('두 비밀번호가 일치하지 않습니다.');

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  process.stdout.write('\nVercel의 ADMIN_PASSWORD_HASH 값에 아래 한 줄을 저장하세요.\n\n');
  process.stdout.write(`scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
