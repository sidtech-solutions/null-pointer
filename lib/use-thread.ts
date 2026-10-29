import { focusManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAccount } from './account';
import { api, ApiError, type RemoteTarget } from './client';
import { type Attachment, readForUpload, removeFile } from './images';
import { hasReacted, isMine, targetKey, withOwnReaction } from './remotes';
import { bumpRemotesUnread, patchInbox } from './remotes-cache';
import type { Message, MessageReply, Thread } from './types';
import type { VoiceDraft } from './voice-notes';

/** A message on its way: shown at the end of the thread until the server hands it back. */
export type PendingMessage = {
  client_id: string;
  body: string;
  images: Attachment[];
  voice: VoiceDraft | null;
  reply_to: MessageReply | null;
  created_at: string;
  status: 'staged' | 'rejected';
  error: string | null;
};

const ActivePoll = 1_500;
const IdlePoll = 4_000;
const ActiveWindow = 60_000;
const TypingPing = 3_000;
const LinkCardPoll = 3_000;
const LinkCardTries = 10;

export function threadQueryKey(target: RemoteTarget): readonly ['remote-thread', string] {
  return ['remote-thread', targetKey(target)];
}

function byId(messages: Message[]): Message[] {
  return [...messages].sort((left, right) => left.id - right.id);
}

/**
 * One conversation, polled while `active`: quickly while it is lively, slower
 * once quiet, never while the app is in the background. Messages the user sends
 * sit in `pending` until a poll or the send itself brings them back.
 */
export function useThread(target: RemoteTarget, active: boolean) {
  const queryClient = useQueryClient();
  const account = useAccount();
  const me = account.user;
  const key = targetKey(target);
  const queryKey = useMemo(() => threadQueryKey(target), [target]);
  const targetRef = useRef(target);
  targetRef.current = target;

  const query = useQuery({
    queryKey,
    queryFn: () => api.thread(targetRef.current),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: account.status === 'signed-in',
  });

  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const lastActivity = useRef(0);
  const lastTyping = useRef(0);
  const reactionsInFlight = useRef(new Set<number>());

  const patch = useCallback((change: (thread: Thread) => Thread) => queryClient.setQueryData<Thread>(queryKey, (thread) => (thread ? change(thread) : thread)), [queryClient, queryKey]);

  // A poll brings the messages after the last one shown and the reactions that changed since the last version.
  const absorb = useCallback(
    (fresh: Thread) => {
      patch((current) => {
        const changed = new Map(fresh.reaction_changes.filter((change) => !reactionsInFlight.current.has(change.id)).map((change) => [change.id, change.reactions]));
        const known = new Set(current.messages.map((message) => message.id));
        const kept = current.messages.map((message) => (changed.has(message.id) ? { ...message, reactions: changed.get(message.id) } : message));

        // A poll that found the org's pins unchanged says null; the ones already shown stay.
        const pinned = current.kind === 'org' && fresh.kind === 'org' ? { pinned: fresh.pinned ?? current.pinned } : {};

        return {
          ...current,
          ...fresh,
          ...pinned,
          messages: byId([...kept, ...fresh.messages.filter((message) => !known.has(message.id))]),
          has_older: current.has_older,
          reaction_changes: [],
          reactions_version: Math.max(current.reactions_version, fresh.reactions_version),
          read_through_id: Math.max(current.read_through_id, fresh.read_through_id),
        } as Thread;
      });

      if (fresh.messages.length > 0) {
        setPending((list) => list.filter((message) => !fresh.messages.some((delivered) => delivered.client_id === message.client_id)));
        lastActivity.current = Date.now();
      }

      if (fresh.kind === 'org' ? fresh.typing.length > 0 : fresh.partner_typing) {
        lastActivity.current = Date.now();
      }
    },
    [patch],
  );

  const loaded = query.data !== undefined;

  useEffect(() => {
    if (!active || !loaded) {
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) {
        return;
      }

      if (focusManager.isFocused()) {
        const current = queryClient.getQueryData<Thread>(queryKey);

        try {
          const fresh = await api.thread(targetRef.current, { after: current?.messages.at(-1)?.id ?? 0, reactionsAfter: current?.reactions_version ?? 0 });

          if (!stopped) {
            absorb(fresh);
          }
        } catch {
          // Keep the conversation as it is until the next poll.
        }
      }

      if (!stopped) {
        timer = setTimeout(tick, Date.now() - lastActivity.current < ActiveWindow ? ActivePoll : IdlePoll);
      }
    };

    tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, loaded, queryKey, queryClient, absorb]);

  // A link card the server is still fetching is asked for again, a few times, as the web does.
  const pendingCards = useRef(new Map<number, number>());

  useEffect(() => {
    if (!active) {
      return;
    }

    const waiting = (query.data?.messages ?? []).filter((message) => message.link_preview?.is_pending === true && (pendingCards.current.get(message.id) ?? 0) < LinkCardTries);

    if (waiting.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      for (const message of waiting) {
        pendingCards.current.set(message.id, (pendingCards.current.get(message.id) ?? 0) + 1);

        try {
          const card = await api.messageLinkPreview(message.id);

          patch((thread) => ({ ...thread, messages: thread.messages.map((candidate) => (candidate.id === message.id ? { ...candidate, link_preview: card } : candidate)) }));
        } catch {
          // The next poll of the thread may bring it; otherwise the message keeps its link as text.
        }
      }
    }, LinkCardPoll);

    return () => clearTimeout(timer);
  }, [active, query.data, patch]);

  const deliver = useCallback(
    async (message: PendingMessage) => {
      try {
        const uploads = await Promise.all(
          message.images.map(async (image) => {
            const { bytes, sha256 } = await readForUpload(image.uri);

            return { name: image.name, type: image.type, bytes, sha256 };
          }),
        );
        const voice = message.voice ? { upload: { name: 'voice-note.wav', type: 'audio/wav', ...(await readForUpload(message.voice.uri)) }, waveform: message.voice.waveform } : null;
        const created = await api.sendMessage(targetRef.current, {
          clientId: message.client_id,
          body: message.body,
          replyToId: message.reply_to?.id ?? null,
          images: uploads,
          descriptions: message.images.map((image) => image.description),
          voice,
        });

        if (message.voice) {
          removeFile(message.voice.uri);
        }

        const before = queryClient.getQueryData<Thread>(queryKey)?.messages.at(-1)?.id ?? 0;

        patch((current) => (current.messages.some((existing) => existing.id === created.id) ? current : { ...current, messages: byId([...current.messages, created]) }));
        setPending((list) => list.filter((candidate) => candidate.client_id !== message.client_id));
        lastActivity.current = Date.now();
        queryClient.invalidateQueries({ queryKey: ['remotes'] });

        // A message from the other side that landed just before this one has a lower id than it,
        // which the next poll (after the newest id) would skip; ask once from where the thread was.
        if (created.id > before + 1) {
          api.thread(targetRef.current, { after: before, reactionsAfter: queryClient.getQueryData<Thread>(queryKey)?.reactions_version ?? 0 })
            .then(absorb)
            .catch(() => {});
        }
      } catch (error) {
        const reason = error instanceof ApiError ? error.firstError() : 'fatal: could not push the message.';
        setPending((list) => list.map((candidate) => (candidate.client_id === message.client_id ? { ...candidate, status: 'rejected', error: reason } : candidate)));
      }
    },
    [patch, queryClient, queryKey, absorb],
  );

  const send = useCallback(
    (body: string, images: Attachment[], replyTo: MessageReply | null, voice: VoiceDraft | null = null) => {
      const message: PendingMessage = { client_id: randomUUID(), body, images, voice, reply_to: replyTo, created_at: new Date().toISOString(), status: 'staged', error: null };

      lastTyping.current = 0;
      setPending((list) => [...list, message]);
      deliver(message);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      setPending((list) => {
        const message = list.find((candidate) => candidate.client_id === clientId);

        if (message) {
          deliver({ ...message, status: 'staged', error: null });
        }

        return list.map((candidate) => (candidate.client_id === clientId ? { ...candidate, status: 'staged', error: null } : candidate));
      });
    },
    [deliver],
  );

  const discard = useCallback(
    (clientId: string) =>
      setPending((list) => {
        const dropped = list.find((candidate) => candidate.client_id === clientId);

        if (dropped?.voice) {
          removeFile(dropped.voice.uri);
        }

        return list.filter((candidate) => candidate.client_id !== clientId);
      }),
    [],
  );

  const loadOlder = useCallback(async () => {
    const current = queryClient.getQueryData<Thread>(queryKey);
    const first = current?.messages[0]?.id;

    if (!current?.has_older || first === undefined || loadingOlder) {
      return;
    }

    setLoadingOlder(true);

    try {
      const fresh = await api.thread(targetRef.current, { before: first });

      patch((thread) => {
        const known = new Set(thread.messages.map((message) => message.id));

        return { ...thread, messages: byId([...fresh.messages.filter((message) => !known.has(message.id)), ...thread.messages]), has_older: fresh.has_older };
      });
    } catch {
      // The spinner goes away; scrolling up again tries once more.
    } finally {
      setLoadingOlder(false);
    }
  }, [queryClient, queryKey, patch, loadingOlder]);

  /** Adds the user's reaction, or takes it back, straight away; answers with why the server refused, if it did. */
  const react = useCallback(
    async (message: Message, emoji: string): Promise<string | null> => {
      if (!me) {
        return null;
      }

      const on = !hasReacted(message.reactions, me, emoji);
      const before = message.reactions ?? [];
      const setReactions = (reactions: typeof before) => patch((thread) => ({ ...thread, messages: thread.messages.map((candidate) => (candidate.id === message.id ? { ...candidate, reactions } : candidate)) }));

      reactionsInFlight.current.add(message.id);
      setReactions(withOwnReaction(before, me, emoji, on));

      try {
        setReactions(await api.react(message.id, emoji, on));

        return null;
      } catch (error) {
        setReactions(before);

        return error instanceof ApiError ? error.firstError() : 'fatal: could not react.';
      } finally {
        reactionsInFlight.current.delete(message.id);
      }
    },
    [me, patch],
  );

  /** Pulls through the latest message, once, and clears the conversation's badge. */
  const markRead = useCallback(() => {
    const current = queryClient.getQueryData<Thread>(queryKey);
    const latest = current?.messages.at(-1)?.id ?? 0;

    if (!current || latest <= current.read_through_id) {
      return;
    }

    const ahead = current.messages.filter((message) => message.id > current.read_through_id && !message.event && !isMine(message, me)).length;

    patch((thread) => ({ ...thread, read_through_id: latest }));
    patchInbox(queryClient, key, (row) => (row.ahead === 0 ? row : { ...row, ahead: 0 }));
    bumpRemotesUnread(queryClient, -ahead);
    api.markRemoteRead(targetRef.current, latest).catch(() => {});
  }, [queryClient, queryKey, key, patch, me]);

  /** Says the user is typing, at most every few seconds. */
  const ping = useCallback(() => {
    const now = Date.now();

    if (now - lastTyping.current < TypingPing) {
      return;
    }

    lastTyping.current = now;
    api.remoteTyping(targetRef.current).catch(() => {});
  }, []);

  /** A message the server just made for this thread (a ping, say) goes in as if a poll had brought it. */
  const absorbMessage = useCallback(
    (message: Message) => {
      patch((current) => (current.messages.some((existing) => existing.id === message.id) ? current : { ...current, messages: byId([...current.messages, message]) }));
      lastActivity.current = Date.now();
    },
    [patch],
  );

  return { thread: query.data, isPending: query.isPending, error: query.error, refetch: query.refetch, patch, pending, send, retry, discard, loadOlder, loadingOlder, react, markRead, ping, absorbMessage };
}

export type ThreadHandle = ReturnType<typeof useThread>;
