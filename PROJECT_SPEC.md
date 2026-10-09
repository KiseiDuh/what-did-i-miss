# Project specification: What Did I Miss?

## Problem
People return to long chat conversations and struggle to find decisions, tasks, deadlines, unanswered questions, and urgent information.

## MVP users
Students, small teams, and people catching up on busy group chats.

## MVP input
A pasted plain-text conversation. Importing platform-specific chat exports is a later enhancement.

## MVP output
- Short overview
- Priority signals
- Action items and deadlines
- Decisions
- Questions or follow-ups to revisit

## Privacy requirement
The starter MVP processes text in the browser using deterministic local heuristics. It does not send text to a server or external model. The interface must not imply that this heuristic engine is a full language model.

## Acceptance criteria
- User can paste text and analyze it.
- Empty input produces a clear validation message.
- Summary and extracted signals are displayed.
- User can load a sample conversation.
- User can clear the input and results.
- Responsive layout works on mobile and desktop.
- Production build succeeds.

## Out of scope for v1
- Connecting to WhatsApp, Slack, Discord, email, or other accounts
- Cloud storage or user accounts
- External AI API calls
- Automatic notifications
- Guaranteed extraction accuracy
