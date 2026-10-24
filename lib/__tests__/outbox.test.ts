jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();

  return { createMMKV: () => ({ getString: (key: string) => store.get(key), set: (key: string, value: string) => store.set(key, value), remove: (key: string) => store.delete(key) }) };
});
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: { document: {} } }));
jest.mock('@/components/composer', () => ({ toUploads: async () => ({ uploads: [], descriptions: [] }) }));
jest.mock('../client', () => ({
  api: { createCommit: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }

    firstError() {
      return this.message;
    }
  },
}));

import { api, ApiError } from '../client';
import { enqueue, isOffline, outbox, push, remove, retry } from '../outbox';

const queryClient = { invalidateQueries: jest.fn(), setQueryData: jest.fn(), setQueriesData: jest.fn() } as never;

describe('outbox', () => {
  beforeEach(() => {
    outbox().forEach((item) => remove(item.id));
    (api.createCommit as jest.Mock).mockReset();
  });

  it('tells a lost connection from a refusal', () => {
    expect(isOffline(new (ApiError as never as new (m: string, s: number) => Error)('fatal: could not connect', 0))).toBe(true);
    expect(isOffline(new (ApiError as never as new (m: string, s: number) => Error)('Too long', 422))).toBe(false);
  });

  it('keeps a draft, pushes it in order, and stops at a lost connection', async () => {
    await enqueue({ body: 'first', images: [] });
    await enqueue({ body: 'second', images: [] });
    (api.createCommit as jest.Mock).mockResolvedValueOnce({ id: 'a', body: 'first' }).mockRejectedValueOnce(new (ApiError as never as new (m: string, s: number) => Error)('fatal: could not connect', 0));

    expect(await push(queryClient)).toBe(1);
    expect(outbox().map((item) => item.body)).toEqual(['second']);
    expect(outbox()[0].error).toBeNull();
    expect(outbox()[0].attempts).toBe(1);
  });

  it('keeps a refused commit aside with its reason until retried', async () => {
    await enqueue({ body: 'too long', images: [] });
    await enqueue({ body: 'fine', images: [] });
    (api.createCommit as jest.Mock).mockRejectedValueOnce(new (ApiError as never as new (m: string, s: number) => Error)('The body may not be greater than 4000 characters.', 422)).mockResolvedValueOnce({ id: 'b', body: 'fine' });

    expect(await push(queryClient)).toBe(1);
    expect(outbox().map((item) => [item.body, item.error])).toEqual([['too long', 'The body may not be greater than 4000 characters.']]);

    retry(outbox()[0].id);
    expect(outbox()[0].error).toBeNull();
  });
});
