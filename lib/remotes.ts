import type { RemoteTarget } from './client';
import type { ConversationSummary, Message, MessageReaction, PushAccess, ReactionUsage, User } from './types';

export type { RemoteTarget };

/** The route parameter for a conversation: `@handle` for a person, the id for an org. */
export function targetParam(target: RemoteTarget): string {
  return target.kind === 'direct' ? `@${target.handle}` : target.id;
}

export function targetFromParam(param: string): RemoteTarget {
  return param.startsWith('@') ? { kind: 'direct', handle: param.slice(1) } : { kind: 'org', id: param };
}

export function targetKey(target: RemoteTarget): string {
  return target.kind === 'direct' ? `@${target.handle.toLowerCase()}` : `org:${target.id}`;
}

export function targetOf(conversation: ConversationSummary): RemoteTarget {
  return conversation.kind === 'org' || conversation.partner === null ? { kind: 'org', id: conversation.id } : { kind: 'direct', handle: conversation.partner.handle };
}

export function summaryKey(conversation: ConversationSummary): string {
  return targetKey(targetOf(conversation));
}

function same(a: User | string | number | null | undefined, b: User | string | number | null | undefined): boolean {
  const idOf = (value: typeof a) => (value !== null && typeof value === 'object' ? value.id : value);

  return idOf(a) !== undefined && idOf(a) !== null && String(idOf(a)) === String(idOf(b));
}

export function isMine(message: Pick<Message, 'user_id'>, me: User | null | undefined): boolean {
  return me !== null && me !== undefined && same(message.user_id, me);
}

/** An org without a name goes by the people in it, leaving the reader out. */
export function orgTitle(name: string | null, members: { user: User }[] | null | undefined, me: User | null | undefined): string {
  if (name && name.trim() !== '') {
    return name;
  }

  const others = (members ?? []).map((member) => member.user).filter((user) => !same(user, me));
  const names = others.slice(0, 3).map((user) => user.name || `@${user.handle}`);

  if (others.length === 0) {
    return 'Org';
  }

  return others.length > 3 ? `${names.join(', ')} +${others.length - 3}` : names.join(', ');
}

export function conversationTitle(conversation: ConversationSummary, me: User | null | undefined): string {
  if (conversation.kind === 'direct' && conversation.partner) {
    return conversation.partner.name || `@${conversation.partner.handle}`;
  }

  return orgTitle(conversation.name, conversation.members, me);
}

function handleOf(person: User | null | undefined, me: User | null | undefined): string {
  if (!person) {
    return 'someone';
  }

  return same(person, me) ? 'you' : `@${person.handle}`;
}

/** What a logged org change says, from the reader's point of view. */
export function eventText(message: Message, me: User | null | undefined): string {
  const actor = handleOf(message.user, me);
  const subject = handleOf(message.subject, me);

  switch (message.event) {
    case 'created':
      return message.body ? `${actor} created ${message.body}` : `${actor} created the org`;
    case 'added':
      return `${actor} added ${subject}`;
    case 'removed':
      return `${actor} removed ${subject}`;
    case 'left':
      return `${actor} left`;
    case 'renamed':
      return message.body ? `${actor} renamed the org to ${message.body}` : `${actor} cleared the org's name`;
    case 'promoted':
      return `${actor} made ${subject} a maintainer`;
    case 'demoted':
      return `${actor} made ${subject} a contributor`;
    case 'inherited':
      return `${actor} inherited maintainer`;
    case 'ping':
      if (isMine(message, me)) {
        return 'you sent a ping';
      }

      // Direct threads leave the author out: there, it can only be the partner.
      return message.user ? `${actor} sent a ping` : 'you got a ping';
    // Calls leave log lines as pings do: that one happened, never what was said.
    case 'call_started':
      return `${callActor(message, me)} started a call`;
    case 'call_answered':
      return `${callActor(message, me)} answered the call`;
    case 'call_cancelled':
      return `${callActor(message, me)} cancelled the call`;
    case 'call_declined':
      return `${callActor(message, me)} declined the call`;
    case 'call_missed':
      return `${callActor(message, me)} missed the call`;
    case 'call_failed':
      return `${callActor(message, me)} couldn't answer the call`;
    default:
      return message.body;
  }
}

/** Who a call line is about: "you" for the reader, else the handle; in a direct thread an authorless line is the partner's. */
function callActor(message: Message, me: User | null | undefined): string {
  if (isMine(message, me)) {
    return 'you';
  }

  return message.user ? handleOf(message.user, me) : 'they';
}

/** Whether a conversation is quiet right now: muted until a moment still ahead, or for good. */
export function isMuted(mutedUntil: string | null | undefined, now: number = Date.now()): boolean {
  if (!mutedUntil) {
    return false;
  }

  const until = Date.parse(mutedUntil);

  return Number.isNaN(until) || until > now;
}

export const MuteChoices: { duration: 'hour' | 'tomorrow' | 'week' | 'forever'; label: string }[] = [
  { duration: 'hour', label: 'For an hour' },
  { duration: 'tomorrow', label: 'Until tomorrow' },
  { duration: 'week', label: 'For a week' },
  { duration: 'forever', label: 'Until I turn it back on' },
];

/** One line for a message without showing it: its text, or what it carried instead. */
export function messageGist(message: Pick<Message, 'body' | 'images'> & { images_count?: number; has_voice?: boolean }): string {
  if (message.body.trim() !== '') {
    return message.body.replace(/\s+/g, ' ').trim();
  }

  const images = message.images?.length ?? message.images_count ?? 0;

  if (images > 0) {
    return images === 1 ? 'Image' : `${images} images`;
  }

  return message.has_voice === false ? '' : 'Voice note';
}

/** The inbox row's second line: who wrote the last message, and what. */
export function previewText(conversation: ConversationSummary, me: User | null | undefined): string {
  const last = conversation.last_message;

  if (!last) {
    return '';
  }

  if (last.event) {
    return eventText(last, me);
  }

  const gist = messageGist(last);

  if (isMine(last, me)) {
    return `You: ${gist}`;
  }

  if (conversation.kind === 'org' && last.user) {
    return `@${last.user.handle}: ${gist}`;
  }

  return gist;
}

export function typingText(usernames: string[]): string | null {
  if (usernames.length === 0) {
    return null;
  }

  if (usernames.length === 1) {
    return `@${usernames[0]} is typing…`;
  }

  if (usernames.length === 2) {
    return `@${usernames[0]} and @${usernames[1]} are typing…`;
  }

  return `${usernames.length} people are typing…`;
}

/** Why the composer is closed, in the server's words. */
export function accessNotice(access: PushAccess, username: string): string | null {
  switch (access) {
    case 'request':
      return `@${username} wants to push to you. Merge the request to reply, or drop it and they won't know.`;
    case 'waiting':
      return `@${username} hasn't merged your request yet. Your message waits until they do.`;
    case 'restricted':
      return `@${username} doesn't follow you, so you can't push to them yet.`;
    case 'closed':
      return `@${username} isn't taking remotes.`;
    default:
      return null;
  }
}

export const DefaultQuickReactions = ['😂', '✅', '❤️'];

const ExtraQuickReactions = ['👍', '🔥', '👀', '🎉', '😮', '😢'];

/** Six emoji one tap away: the web's three slots, won by use, then the usual suspects. */
export function quickReactions(usage: ReactionUsage[]): string[] {
  const uses = new Map(usage.map(({ emoji, count }) => [emoji, count]));
  const usesOf = (emoji: string) => uses.get(emoji) ?? 0;
  const slots = [...DefaultQuickReactions];

  for (const { emoji, count } of [...usage].sort((left, right) => right.count - left.count)) {
    if (slots.includes(emoji)) {
      continue;
    }

    const weakest = slots.reduce((weakestIndex, slot, index) => (usesOf(slot) <= usesOf(slots[weakestIndex]) ? index : weakestIndex), 0);

    if (count >= usesOf(slots[weakest]) + 3) {
      slots[weakest] = emoji;
    }
  }

  for (const emoji of ExtraQuickReactions) {
    if (slots.length >= 6) {
      break;
    }

    if (!slots.includes(emoji)) {
      slots.push(emoji);
    }
  }

  return slots;
}

export type ReactionChip = { emoji: string; count: number; mine: boolean };

/** One chip per emoji, in the order each was first left. */
export function reactionChips(reactions: MessageReaction[] | undefined, me: User | null | undefined): ReactionChip[] {
  const chips: ReactionChip[] = [];

  for (const reaction of reactions ?? []) {
    const chip = chips.find((candidate) => candidate.emoji === reaction.emoji);
    const mine = same(reaction.user_id, me);

    if (chip) {
      chip.count += 1;
      chip.mine = chip.mine || mine;
    } else {
      chips.push({ emoji: reaction.emoji, count: 1, mine });
    }
  }

  return chips;
}

export function hasReacted(reactions: MessageReaction[] | undefined, me: User | null | undefined, emoji: string): boolean {
  return (reactions ?? []).some((reaction) => reaction.emoji === emoji && same(reaction.user_id, me));
}

/** The reactions after the user adds one, or takes theirs back, before the server answers. */
export function withOwnReaction(reactions: MessageReaction[] | undefined, me: User, emoji: string, on: boolean): MessageReaction[] {
  const rest = (reactions ?? []).filter((reaction) => !(reaction.emoji === emoji && same(reaction.user_id, me)));

  return on ? [...rest, { user_id: String(me.id), emoji }] : rest;
}
