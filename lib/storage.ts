import { createMMKV } from 'react-native-mmkv';

// MMKV: synchronous, memory-mapped. Used for the query cache and drafts.
export const storage = createMMKV({ id: 'devnull' });
