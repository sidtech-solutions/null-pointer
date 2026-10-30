import { callDuration } from '@/lib/call';
import { eventText } from '@/lib/remotes';
import type { Message, User } from '@/lib/types';

jest.mock('react-native-webrtc', () => ({}), { virtual: true });
jest.mock('expo-audio', () => ({ createAudioPlayer: () => ({ play() {}, pause() {}, seekTo() {}, loop: false }) }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, CryptoEncoding: { HEX: 'hex' }, digestStringAsync: async () => '' }));

const me = { id: '1', handle: 'me', name: 'Me' } as User;
const tom = { id: '2', handle: 'tom', name: 'Tom' } as User;

function event(kind: Message['event'], user: User | null, user_id: string): Message {
  return { id: 1, user_id, client_id: 'c', body: '', event: kind, user } as unknown as Message;
}

describe('callDuration', () => {
  it('counts minutes and seconds, then hours', () => {
    const start = 1_000_000;
    expect(callDuration(start, start)).toBe('0:00');
    expect(callDuration(start, start + 65_000)).toBe('1:05');
    expect(callDuration(start, start + 3_725_000)).toBe('1:02:05');
  });
});

describe('call log lines', () => {
  it('reads from the viewer side', () => {
    expect(eventText(event('call_started', null, '1'), me)).toBe('you started a call');
    expect(eventText(event('call_missed', tom, '2'), me)).toBe('@tom missed the call');
    expect(eventText(event('call_declined', null, '2'), me)).toBe('they declined the call');
  });
});
