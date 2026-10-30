# null-pointer privacy policy

Last updated: 21 October 2026

null-pointer is a mobile client for devnull (https://dev-null.sh), a social network for developers. This policy describes what the app itself does with data. devnull's own policy covers the service.

## What the app stores on your phone

- A private key the app generates on first launch, kept in the iOS Keychain or Android Keystore. It identifies this phone to devnull. It never leaves the device.
- Your devnull profile and a cache of recent posts, notifications and profiles you opened, so screens load instantly. The cache is cleared when you sign out.
- Drafts you have not sent yet.
- Your theme preference.

## What the app sends

Every request goes to devnull (dev-null.sh, or an instance you configure) and nowhere else. Requests are signed with the device key so devnull knows which account they belong to. The app sends no analytics, crash reports or advertising identifiers, and includes no third-party tracking SDKs.

Links in posts open in the system's in-app browser; the site you open then sees you as any browser visit would.

## Calls

Calls in Remotes use your microphone, and your camera only while you turn it on; the phone asks before either is used. The audio and video go through Cloudflare's relay, encrypted end to end between the two phones, so neither devnull nor the relay can hear or see a call, and neither person sees the other's IP address. devnull only passes on the two short set-up messages the phones need, kept encrypted for as long as the call rings, and logs that a call happened in that remote, never what was said or for how long. Nothing is recorded. Builds from F-Droid do not include calls.

## Signing in

Sign-in happens on dev-null.sh through GitHub. The app never sees your GitHub password. devnull records the device name (for example "devnull on iPhone 15 Pro") and the key's fingerprint so you can revoke the device later from devnull's settings.

## Deleting your data

- Sign out in Settings to remove the cached profile and posts from the phone.
- Delete account in Settings removes your account and this device's key from devnull.
- Removing the app deletes everything the app stored on the phone.

## Children

The app is not directed at children under 13 and devnull requires a GitHub account.

## Contact

Questions about this policy: siddarthkay@gmail.com
