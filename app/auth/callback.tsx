import { Redirect } from 'expo-router';

// Target of the devnull://auth/callback redirect. The auth session already
// consumed the URL, so this route only needs to exist for the router.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
