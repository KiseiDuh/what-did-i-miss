# What Did I Miss?

A privacy-first AI micro-app prototype that helps users catch up on long conversations.

## Current status

This repository contains a working frontend MVP with **local heuristic analysis**. It does not yet use a large language model. That is intentional: the prototype lets you build and test the workflow without exposing private conversation text to an external service.

## Features

- Paste a chat transcript
- Generate a short overview
- Surface possible urgent messages
- Extract action-like statements, dates, decisions, and open questions
- Load sample data
- Clear the workspace
- Responsive layout

> This is a prototype, not a guaranteed task extractor. Always verify the extracted information against the original conversation.

## Requirements

- Node.js 20.19+ or 22.12+ recommended for current Vite versions
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

## Build

```bash
npm run build
npm run preview
```

## Project structure

```text
what-did-i-miss/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── analyzer.ts
│   └── styles.css
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── TASKS.md
├── DECISIONS.md
└── AGENTS.md
```

## Privacy

The current analyzer runs locally in the browser and makes no network calls for conversation analysis. Standard development dependencies are downloaded by npm during setup. Do not paste sensitive real-world conversations into prototypes unless you are comfortable with your local environment and data handling.

## Next milestones

1. Add tests for the local analyzer.
2. Evaluate a browser-local NLP model. Transformers.js supports running compatible models in-browser, but model size, browser support, download behavior, and quality need to be evaluated before choosing one.
3. If adding a remote AI provider, make it opt-in and disclose that the conversation text is sent to that provider. Keep provider API keys on a server.
4. Add GitHub Actions for build checks and create issues for each feature.

## AI-assisted development workflow

- ChatGPT: refine product scope and create implementation prompts.
- Gemini: research libraries and verify current documentation.
- Antigravity or Copilot: implement one task at a time.
- Claude: independently review code and test cases.
- GitHub: issues, feature branches, pull requests, and project history.
