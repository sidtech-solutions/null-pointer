import { getPublicKey, hashes, sign } from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';

import { concat, sshString, toBase64, u32, utf8 } from './bytes';

hashes.sha512 = sha512;

const Type = 'ssh-ed25519';
const Magic = utf8('SSHSIG');
const HashAlgorithm = 'sha512';

export const SeedBytes = 32;

/**
 * Ed25519 key pair producing `ssh-keygen -Y sign` compatible signatures.
 *
 * @see https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig
 */
export class SshKey {
  readonly publicKey: Uint8Array;

  private constructor(private readonly seed: Uint8Array) {
    this.publicKey = getPublicKey(seed);
  }

  static fromSeed(seed: Uint8Array): SshKey {
    if (seed.length !== SeedBytes) {
      throw new Error('An Ed25519 seed is 32 bytes.');
    }

    return new SshKey(seed);
  }

  seedBytes(): Uint8Array {
    return this.seed;
  }

  publicKeyBlob(): Uint8Array {
    return concat(sshString(Type), sshString(this.publicKey));
  }

  openSsh(comment = 'devnull-mobile'): string {
    return `${Type} ${toBase64(this.publicKeyBlob())} ${comment}`.trimEnd();
  }

  /** Matches `ssh-keygen -lf`. */
  fingerprint(): string {
    return 'SHA256:' + toBase64(sha256(this.publicKeyBlob())).replace(/=+$/, '');
  }

  /** Returns the SSHSIG blob, base64 on one line. */
  sign(message: string, namespace: string): string {
    const signedData = concat(
      Magic,
      sshString(namespace),
      sshString(''),
      sshString(HashAlgorithm),
      sshString(sha512(utf8(message))),
    );

    const signature = concat(sshString(Type), sshString(sign(signedData, this.seed)));

    return toBase64(
      concat(
        Magic,
        u32(1),
        sshString(this.publicKeyBlob()),
        sshString(namespace),
        sshString(''),
        sshString(HashAlgorithm),
        sshString(signature),
      ),
    );
  }
}
