# Technical decisions

## 001: Start browser-only
Decision: The initial prototype uses client-side heuristic processing and no backend.
Reason: It keeps setup simple and makes the privacy claim straightforward to verify.
Trade-off: The analysis is less capable than a modern LLM and must be labeled as a prototype.

## 002: React + TypeScript + Vite
Decision: Use React, TypeScript, and Vite.
Reason: Familiar, lightweight frontend stack with a fast local development workflow.
Reference: https://vite.dev/guide/
