# What Did I Miss?

**Turn long conversations into a clear, source-backed briefing.**

What Did I Miss? is a lightweight conversation catch-up app that helps people find the details worth following up on: action candidates, explicit deadlines, decisions, open questions, and important updates.

Instead of scrolling through an entire thread, paste a conversation or upload a supported file, run the analysis, and review the findings alongside their source context.

> **Project status:** Deployed web app; compatibility with any external evaluation dataset must be verified against that dataset when it becomes available.

## Contents

- [Why it exists](#why-it-exists)
- [Features](#features)
- [How it works](#how-it-works)
- [Supported input](#supported-input)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Quality checks](#quality-checks)
- [Privacy and limitations](#privacy-and-limitations)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Why it exists

Important details often get buried in busy group chats, project threads, and meeting conversations. What Did I Miss? is designed to make catch-up faster by surfacing useful signals while keeping the original messages available for verification.

The goal is not to replace the conversation or pretend to understand more than the input supports. Findings should be traceable to the messages that produced them.

## Features

- **Conversation input:** paste conversation text into the main input area.
- **File import:** upload supported TXT, JSON, or CSV files.
- **Structured briefing:** review surfaced action candidates, deadlines, decisions, and open questions.
- **Source context:** inspect original message excerpts to verify a finding.
- **Task controls:** mark findings complete or dismiss them where supported by the current interface.
- **Input feedback:** view analysis, empty-input, and error states.
- **Responsive interface:** a dark, focused workspace designed for quick scanning.

The exact findings depend on the content and structure of the supplied conversation. The app should not invent missing dates, owners, decisions, or messages.

## How it works

1. **Provide a conversation** by pasting text or uploading a supported file.
2. **Parse the input** into messages using the applicable parser.
3. **Analyse the messages** for relevant signals.
4. **Review the briefing** and follow each finding back to its source context.

The current project uses a React + TypeScript + Vite frontend. Analysis and parsing behavior are implemented in the project code; this README does not claim that a remote AI service or backend is required.

## Supported input

The interface offers TXT, JSON, and CSV upload options. Supported structures can vary by parser, so check **Formats & Guide** in the app for the expected format.

For best results:
- Keep messages separated clearly.
- Preserve sender names and timestamps when available.
- Use consistent fields in structured JSON or CSV files.
- Review the parsed message count before relying on the results.
- Treat ambiguous language as ambiguous, and verify important findings against the source.

The judges' dataset has not been available for validation at the time this README was written. Compatibility with a specific external dataset should not be claimed until it has been tested.

## Getting started

### Requirements

- Node.js and npm
- Git (optional, for cloning and version control)

### Install

Clone the repository and enter the project directory:

```bash
git clone https://github.com/KiseiDuh/what-did-i-miss.git
cd what-did-i-miss
npm install
```

### Run locally

Start the development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

### Production build

Create a production build:

```bash
npm run build
```

Vite writes the production output to `dist/`.

### Run tests

```bash
npm test
```

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Run the TypeScript build and create production assets |
| `npm test` | Run the Vitest test suite |

## Quality checks

Before submitting changes, run:

```bash
npm test
npm run build
```

Test with a range of real inputs:
- a normal conversation with several messages;
- a conversation with explicit action items and deadlines;
- a conversation with questions but no clear action items;
- empty input;
- malformed or unsupported files;
- conversations containing negation or ambiguous wording.

Verify that counts match the parsed input, results update when the input changes, and every displayed finding can be traced to source text.

## Privacy and limitations

Conversation text can contain sensitive information. Only upload material you are permitted to use, and avoid sharing secrets, credentials, or personal information unnecessarily.

Do not assume that a “private” label alone proves privacy. Before making a privacy claim, inspect the current implementation and verify whether any conversation data is sent to an external service, stored, logged, or persisted. This README does not make an independently audited security claim.

The analysis is a helper, not an infallible record of the conversation. Review findings against the source messages, especially before acting on a deadline or commitment. No parser can guarantee compatibility with every export format.

## Project structure

Key files and directories in the repository include:

```text
.
├── src/
│   ├── App.tsx          # Main application interface
│   └── analyzer.ts      # Conversation analysis logic
├── tests/               # Parser, analyzer, and UI tests
├── index.html
├── package.json
├── vite.config.ts
└── README.md
```

The repository may contain additional source files, parsers, configuration, and documentation beyond this abbreviated overview.

## Deployment

The project is deployed through Vercel from the GitHub repository.

For a new deployment:
1. Push the verified changes to the connected branch.
2. Check the Vercel build log.
3. Confirm the deployment status is **Ready**.
4. Test the live URL, including file upload, analysis, empty input, and error handling.

A successful local build does not by itself prove that the live deployment or every supported input format works correctly.

## Contributing

1. Create a branch for your change.
2. Keep parsing, analysis, and presentation concerns separated.
3. Add or update tests for behavior changes.
4. Run `npm test` and `npm run build`.
5. Describe any remaining limitations clearly.

---

Built as **What Did I Miss?**, a conversation catch-up project focused on useful signals and verifiable source context.
