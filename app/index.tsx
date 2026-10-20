import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAccount } from '@/lib/account';

export default function Launch() {
  const { status } = useAccount();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return <Redirect href={status === 'signed-in' ? '/(tabs)' : '/onboarding'} />;
}
