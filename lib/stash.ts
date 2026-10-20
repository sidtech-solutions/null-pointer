import AsyncStorage from '@react-native-async-storage/async-storage';

// Unsent drafts, keyed per user: the composer draft, one quote per commit, one reply per commit.
function key(userId: string | number | undefined, name: string): string {
  return `devnull.stash.${userId ?? 'guest'}.${name}`;
}

export async function getStash(userId: string | number | undefined, name: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(key(userId, name))) ?? '';
  } catch {
    return '';
  }
}

export async function putStash(userId: string | number | undefined, name: string, text: string): Promise<void> {
  try {
    if (text.trim() === '') {
      await AsyncStorage.removeItem(key(userId, name));
    } else {
      await AsyncStorage.setItem(key(userId, name), text);
    }
  } catch {
    // A draft that cannot be written is dropped.
  }
}

export async function dropStash(userId: string | number | undefined, name: string): Promise<void> {
  await putStash(userId, name, '');
}
