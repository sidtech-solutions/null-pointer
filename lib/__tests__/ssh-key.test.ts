/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ImagesNamespace, Namespace, signedMessage } from '../signer';
import { SshKey } from '../ssh-key';

function freshKey(): SshKey {
  return SshKey.fromSeed(new Uint8Array(randomBytes(32)));
}

function armour(signature: string): string {
  return `-----BEGIN SSH SIGNATURE-----\n${signature.match(/.{1,70}/g)!.join('\n')}\n-----END SSH SIGNATURE-----\n`;
}

test('signs like ssh-keygen -Y sign, so devnull can verify it', () => {
  const key = freshKey();
  const message = signedMessage('1700000000', 'abc123', 'post', '/api/v1/commits?cursor=x', '{"body":"hello /dev/null"}');
  const dir = mkdtempSync(join(tmpdir(), 'null-pointer-'));

  writeFileSync(join(dir, 'allowed_signers'), `devnull-mobile ${key.openSsh()}\n`);
  writeFileSync(join(dir, 'message.sig'), armour(key.sign(message, Namespace)));

  const output = execFileSync(
    'ssh-keygen',
    ['-Y', 'verify', '-f', join(dir, 'allowed_signers'), '-I', 'devnull-mobile', '-n', Namespace, '-s', join(dir, 'message.sig')],
    { input: message },
  ).toString();

  expect(output).toContain(`Good "${Namespace}" signature`);
});

test('a signature over another message fails to verify', () => {
  const key = freshKey();
  const dir = mkdtempSync(join(tmpdir(), 'null-pointer-'));

  writeFileSync(join(dir, 'allowed_signers'), `devnull-mobile ${key.openSsh()}\n`);
  writeFileSync(join(dir, 'message.sig'), armour(key.sign('one', Namespace)));

  expect(() =>
    execFileSync(
      'ssh-keygen',
      ['-Y', 'verify', '-f', join(dir, 'allowed_signers'), '-I', 'devnull-mobile', '-n', Namespace, '-s', join(dir, 'message.sig')],
      { input: 'two', stdio: ['pipe', 'pipe', 'pipe'] },
    ),
  ).toThrow();
});

test('prints the fingerprint ssh-keygen -lf prints', () => {
  const key = freshKey();
  const dir = mkdtempSync(join(tmpdir(), 'null-pointer-'));
  const file = join(dir, 'key.pub');

  writeFileSync(file, `${key.openSsh()}\n`);

  expect(execFileSync('ssh-keygen', ['-lf', file]).toString()).toContain(key.fingerprint());
});

test('rebuilds the same key from its seed', () => {
  const seed = new Uint8Array(randomBytes(32));

  expect(SshKey.fromSeed(seed).openSsh()).toBe(SshKey.fromSeed(seed).openSsh());
  expect(() => SshKey.fromSeed(new Uint8Array(16))).toThrow('An Ed25519 seed is 32 bytes.');
});

test('joins the signed message with newlines and an uppercase method', () => {
  expect(signedMessage('1', 'n', 'get', '/api/v1/me', '')).toBe('1\nn\nGET\n/api/v1/me\n');
});

test('a request with images carries the image hashes before the body and its own namespace', () => {
  const hashes = ['a'.repeat(64), 'b'.repeat(64)];

  expect(signedMessage('1', 'n', 'post', '/api/v1/commits', '{"body":"x"}', hashes)).toBe(`1\nn\nPOST\n/api/v1/commits\n${hashes.join(',')}\n{"body":"x"}`);

  const key = freshKey();
  const message = signedMessage('1700000000', 'abc123', 'POST', '/api/v1/commits', '{"body":"Shipped!"}', hashes);
  const dir = mkdtempSync(join(tmpdir(), 'null-pointer-'));

  writeFileSync(join(dir, 'allowed_signers'), `devnull-mobile ${key.openSsh()}\n`);
  writeFileSync(join(dir, 'message.sig'), armour(key.sign(message, ImagesNamespace)));

  const output = execFileSync(
    'ssh-keygen',
    ['-Y', 'verify', '-f', join(dir, 'allowed_signers'), '-I', 'devnull-mobile', '-n', ImagesNamespace, '-s', join(dir, 'message.sig')],
    { input: message },
  ).toString();

  expect(output).toContain(`Good "${ImagesNamespace}" signature`);
});
