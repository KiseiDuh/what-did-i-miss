export type Finding = {
  id: string;
  text: string;
  category: "urgent" | "action" | "decision" | "question";
  reason: string;
};

export type Analysis = {
  summary: string;
  messageCount: number;
  findings: Finding[];
};

const urgencyWords = /\b(urgent|asap|immediately|today|deadline|due by|by tonight|critical|tomorrow)\b/i;
const actionWords = /\b(please|todo|to-do|need to|needs to|action item|i will|we should|can you|remember to|don't forget|follow up|send|submit|finish|complete|prepare|review|book|schedule)\b/i;
const decisionWords = /\b(decided|decision|agreed|we will go with|final plan|confirmed|let's use|we'll use)\b/i;
const questionWords = /\?\s*$/;

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function makeId(line: string, index: number): string {
  return `${index}-${line.slice(0, 24).replace(/\W/g, "")}`;
}

export function analyzeConversation(text: string): Analysis {
  const lines = splitLines(text);
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    if (urgencyWords.test(line)) {
      findings.push({
        id: makeId(line, index),
        text: line,
        category: "urgent",
        reason: "Contains urgency or deadline language",
      });
    } else if (decisionWords.test(line)) {
      findings.push({
        id: makeId(line, index),
        text: line,
        category: "decision",
        reason: "May record a decision or agreement",
      });
    } else if (actionWords.test(line)) {
      findings.push({
        id: makeId(line, index),
        text: line,
        category: "action",
        reason: "May contain a task or follow-up",
      });
    } else if (questionWords.test(line)) {
      findings.push({
        id: makeId(line, index),
        text: line,
        category: "question",
        reason: "Could require an answer",
      });
    }
  });

  const preview = lines.slice(0, 3).join(" ");
  const summary = lines.length === 0
    ? "Add a conversation to generate a briefing."
    : `${lines.length} non-empty line${lines.length === 1 ? "" : "s"} analyzed. ${preview}${lines.length > 3 ? "…" : ""}`;

  return { summary, messageCount: lines.length, findings };
}