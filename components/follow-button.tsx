import { Button } from '@/components/button';
import { useFollow } from '@/lib/use-follow';

export function FollowButton({ username, isFollowing, size = 'sm' }: { username: string; isFollowing: boolean; size?: 'sm' | 'md' }) {
  const follow = useFollow();

  return (
    <Button
      title={isFollowing ? 'Unfollow' : 'Follow'}
      variant={isFollowing ? 'outline' : 'primary'}
      size={size}
      busy={follow.isPending && follow.variables?.username === username}
      onPress={() => follow.mutate({ username, isFollowing })}
      accessibilityHint={isFollowing ? `Unfollows @${username}` : undefined}
    />
  );
}
