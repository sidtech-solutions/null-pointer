import type { SshKey } from './ssh-key';

/**
 * The signed message is timestamp, nonce, uppercase method, request target
 * (path plus query, exactly as sent) and raw body, joined by "\n".
 */
export const Namespace = 'devnull-api';

export type SignatureHeaders = {
  'X-Devnull-Timestamp': string;
  'X-Devnull-Nonce': string;
  'X-SSH-Signature': string;
};

export function signedMessage(timestamp: string, nonce: string, method: string, target: string, body: string): string {
  return [timestamp, nonce, method.toUpperCase(), target, body].join('\n');
}

export function signatureHeaders(
  key: SshKey,
  method: string,
  target: string,
  body: string,
  timestamp: number,
  nonce: string,
): SignatureHeaders {
  return {
    'X-Devnull-Timestamp': String(timestamp),
    'X-Devnull-Nonce': nonce,
    'X-SSH-Signature': key.sign(signedMessage(String(timestamp), nonce, method, target, body), Namespace),
  };
}
