# App Review access

App Review signs in with the demo GitHub account, and GitHub answers with a
device verification code sent to that account's email. Reviewers never see the
email, so the sign-in stalls there. Reviewers also do not read instructions
first: they type the username and password from the App Store Connect form into
whatever fields the app shows. So review builds show a username and password
form on the welcome screen. The demo account's handle with the review
passphrase as its password swaps in a device key that dev-null.sh has already
approved for that account. No GitHub, no browser, no code.

The form only exists when both `EXPO_PUBLIC_REVIEW_SEED` and
`EXPO_PUBLIC_REVIEW_PASSPHRASE` are set at bundle time. Builds without them
(F-Droid, local dev) have no form, nothing to find. `EXPO_PUBLIC_REVIEW_HANDLE`
names the demo account and defaults to `null-pointer-auto`.

## One-time setup

1. Generate a seed and pick a passphrase:

   ```sh
   openssl rand -base64 32
   ```

2. Put both in the env the build reads. Locally that is `.env`:

   ```sh
   EXPO_PUBLIC_REVIEW_SEED=<base64 seed>
   EXPO_PUBLIC_REVIEW_PASSPHRASE=<passphrase>
   ```

   For store builds they are GitHub Actions secrets of the same names, read
   only by the signed iOS archive step in `.github/workflows/build.yml`. The
   Android APK is built without them so it stays identical to F-Droid's.

   ```sh
   printf '%s' '<base64 seed>' | gh secret set EXPO_PUBLIC_REVIEW_SEED
   printf '%s' '<passphrase>' | gh secret set EXPO_PUBLIC_REVIEW_PASSPHRASE
   ```

3. Approve the key on dev-null.sh for the demo account. Run the app with those
   vars on a simulator, type the demo account's handle and the passphrase into
   the form, tap **Sign in**. It fails with "does not accept the review key
   yet", which is expected: the phone now holds the review key. Tick the terms
   box, tap **Sign in with GitHub**, sign in as the demo account (you paste the
   GitHub device code yourself if GitHub asks), approve the phone. That
   registers the review key on the demo account. The account must be at least
   seven days old with a verified email, or dev-null.sh refuses the sign-up.

4. Sign out and use the form again. It should land on the timeline without
   GitHub. Every build made with the same seed now works on any device.

## App Store Connect

In App Information, Sign-in required: username `null-pointer-auto`, password
`<passphrase>`. Review notes:

> Sign in with the username and password above in the "Reviewing the app?"
> form at the bottom of the welcome screen. The "Sign in with GitHub" button
> is for everyone else: it opens GitHub, which emails a verification code to
> the demo account that you would not receive.

## After approval

The seed is in the binary, so treat it as public: anyone who extracts it can
act as the demo account. Keep the account empty and following nobody real.
Once the build is approved, revoke the device on dev-null.sh (Settings, devices)
and rotate the seed before the next review build, or ship the next build
without the two vars to drop the form entirely.
