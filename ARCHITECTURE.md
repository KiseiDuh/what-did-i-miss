# Architecture

## Stack
- React + TypeScript
- Vite development/build tooling
- Lucide React icons
- Browser-only state; no backend in the starter MVP

## Data flow
Conversation text -> local heuristic analyzer -> summary, priority signals, action candidates -> UI.

## Privacy
All analysis in this starter runs in the browser. No API keys or external inference calls are used. If adding a remote model later, add a consent step, explain what text leaves the device, and keep credentials on a server rather than shipping secrets to the browser.

## Planned future architecture
1. Local parser and explicit user review.
2. Optional local model inference, evaluated for download size, device compatibility, and quality.
3. Optional remote provider behind a server-side API only if the user opts in.
4. Tests for extraction quality and privacy behavior.
