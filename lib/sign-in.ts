import { sha256 } from '@noble/hashes/sha2.js';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { base64Url, utf8 } from './bytes';
import { api, ApiError } from './client';
import { randomBytes } from './random';
import type { SshKey } from './ssh-key';
import type { User } from './types';

// OAuth authorization code flow with PKCE. Verifier and state are fresh per attempt and live only in memory.
export const RedirectUri = 'devnull://auth/callback';

export class SignInAttempt {
  private constructor(
    private readonly verifier: string,
    readonly state: string,
  ) {}

  static start(): SignInAttempt {
    return new SignInAttempt(base64Url(randomBytes(32)), base64Url(randomBytes(16)));
  }

  codeVerifier(): string {
    return this.verifier;
  }

  challenge(): string {
    return base64Url(sha256(utf8(this.verifier)));
  }

  answers(state: string | undefined): boolean {
    return typeof state === 'string' && state !== '' && state === this.state;
  }

  authorizeUrl(baseUrl: string, fingerprint: string, deviceName: string): string {
    const query = new URLSearchParams({
      fingerprint,
      device_name: deviceName,
      code_challenge: this.challenge(),
      code_challenge_method: 'S256',
      state: this.state,
      redirect_uri: RedirectUri,
    });

    return `${baseUrl.replace(/\/+$/, '')}/mobile/authorize?${query.toString()}`;
  }
}

export type SignInOutcome = { type: 'signed-in'; user: User } | { type: 'cancelled' } | { type: 'error'; message: string };

/** Shown in the server's device list, so it names the phone model. */
export function deviceName(): string {
  const model = Device.modelName?.trim();

  return `devnull on ${model ? model : 'a phone'}`;
}

/** `acceptedTerms` says the person ticked the box for the terms and privacy policy the screen linked to. */
export async function signInWithGitHub(key: SshKey, baseUrl: string, acceptedTerms: boolean): Promise<SignInOutcome> {
  const attempt = SignInAttempt.start();

  const result = await WebBrowser.openAuthSessionAsync(attempt.authorizeUrl(baseUrl, key.fingerprint(), deviceName()), RedirectUri, {
    preferEphemeralSession: false,
  });

  if (result.type !== 'success') {
    return { type: 'cancelled' };
  }

  const query = Linking.parse(result.url).queryParams ?? {};
  const read = (name: string): string | undefined => (typeof query[name] === 'string' ? (query[name] as string) : undefined);

  if (!attempt.answers(read('state'))) {
    return { type: 'error', message: "fatal: that sign-in didn't start on this phone, so it was ignored." };
  }

  const error = read('error');

  if (error === 'access_denied') {
    return { type: 'cancelled' };
  }

  if (error) {
    return { type: 'error', message: read('error_description') ?? `fatal: dev-null.sh could not sign you in (${error}).` };
  }

  const code = read('code');

  if (!code) {
    return { type: 'error', message: 'fatal: dev-null.sh sent no code back.' };
  }

  try {
    const me = await api.redeemSignIn(code, attempt.codeVerifier());

    // The links went to the live pages, so what was ticked is the version in force. If recording it fails the sign-in
    // still stands and the tabs ask again.
    if (acceptedTerms && !me.terms_accepted && me.terms_version) {
      await api.acceptTerms(me.terms_version).catch(() => undefined);
    }

    return { type: 'signed-in', user: me.user };
  } catch (exception) {
    return { type: 'error', message: exception instanceof ApiError ? exception.firstError() : String(exception) };
  }
}
