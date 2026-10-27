# App Review access

App Review signs in with the demo GitHub account, and GitHub answers with a
device verification code sent to that account's email. Reviewers never see the
email, so the sign-in stalls there. Review builds carry a second way in: a
device key that dev-null.sh has already approved for the demo account, unlocked
by a passphrase from the review notes. No GitHub, no browser.

The path only exists when both `EXPO_PUBLIC_REVIEW_SEED` and
`EXPO_PUBLIC_REVIEW_PASSPHRASE` are set at bundle time. Builds without them
(F-Droid, local dev) have no long-press, no field, nothing to find.

## One-time setup

1. Generate a seed and pick a passphrase:

   ```sh
   openssl rand -base64 32
   ```

2. Put both in the env the build reads (`.env` locally, the fastlane or CI
   environment for store builds):

   ```sh
   EXPO_PUBLIC_REVIEW_SEED=<base64 seed>
   EXPO_PUBLIC_REVIEW_PASSPHRASE=<passphrase>
   ```

3. Approve the key on dev-null.sh for the demo account. Run the app with those
   vars on a simulator, long-press the logo on the welcome screen, enter the
   passphrase, tap **Sign in as App Review**. It fails with "does not accept
   the review key yet", which is expected: the phone now holds the review key.
   Tap **Sign in with GitHub**, sign in as the demo account (you paste the
   GitHub device code yourself), approve the phone. That registers the review
   key on the demo account.

4. Reinstall or sign out and try the long-press path again. It should land on
   the timeline without GitHub. Every build made with the same seed now works
   on any device.

## Review notes

> The app signs in through GitHub, which emails a device verification code to
> the demo account that App Review cannot receive. Use the reviewer path
> instead:
>
> 1. On the welcome screen, press and hold the null-pointer logo for about two
>    seconds.
> 2. Type the passphrase `<passphrase>` and tap "Sign in as App Review".
>
> This signs in as the demo account @null-pointer-auto without GitHub.

## After approval

The seed is in the binary, so treat it as public: anyone who extracts it can
act as the demo account. Keep the account empty and following nobody real.
Once the build is approved, revoke the device on dev-null.sh (Settings, devices)
and rotate the seed before the next review build, or ship the next build
without the two vars to drop the path entirely.
