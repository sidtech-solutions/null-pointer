import type { ReactNode } from 'react';

import { type CodePaste, CodeSuggestion, LanguageSheet, useCodePaste } from '@/components/code-tools';
import { IssueSuggestion } from '@/components/issue-suggestion';
import { MentionSuggestions } from '@/components/mention-suggestions';
import { type Draft, useDraftCaret, useDraftText } from '@/lib/draft';
import { insertIssue, insertMention, issueReferenceBeforeCaret, type MentionContext, mentionBeforeCaret, useIssueSuggestion, useMentionSuggestions } from '@/lib/mentions';

/**
 * Everything that watches the draft as it is typed: the @mention and #issue
 * suggestions, the pasted-code strip and its language sheet. Reading the
 * draft here, not in the screen, keeps a keystroke from re-rendering the
 * screen. The footer renders through `children` so its paste button can reach
 * the clipboard tool.
 */
export function DraftTools({ draft, context, hidden = false, children }: { draft: Draft; context?: MentionContext; /** While a preview shows, the strips stay away. */ hidden?: boolean; children: (paste: CodePaste) => ReactNode }) {
  const text = useDraftText(draft);
  const caret = useDraftCaret(draft);
  const mention = mentionBeforeCaret(text, caret);
  const suggestions = useMentionSuggestions(mention, context);
  const issueToken = mention ? null : issueReferenceBeforeCaret(text, caret);
  const issue = useIssueSuggestion(issueToken);
  // Pasted code is offered a fence; the clipboard can be pasted straight in as one.
  const paste = useCodePaste(text, caret, (next, at) => draft.write(next, at));

  return (
    <>
      {!hidden && <CodeSuggestion paste={paste} />}
      {!hidden && (
        <MentionSuggestions
          users={suggestions}
          onPick={(user) => {
            if (mention) {
              const next = insertMention(text, mention, user.handle);
              draft.write(next.text, next.caret);
            }
          }}
        />
      )}
      {!hidden && (
        <IssueSuggestion
          issue={issue}
          onPick={(picked) => {
            if (issueToken) {
              const next = insertIssue(text, issueToken, picked.number);
              draft.write(next.text, next.caret);
            }
          }}
        />
      )}
      {children(paste)}
      <LanguageSheet paste={paste} />
    </>
  );
}
