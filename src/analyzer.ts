export type FindingCategory = "urgent" | "action" | "decision" | "question";
export type PriorityLevel = "high" | "medium" | "low";

export interface ExtractedDeadline {
  /** Verbatim deadline phrase extracted from the message */
  raw: string;
  /** Relative urgency tier */
  urgency: PriorityLevel;
}

export interface SourceMessage {
  /** 1-based index in the parsed message sequence */
  index: number;
  /** 1-based line number in original input */
  lineNumber: number;
  /** Exact raw line text */
  raw: string;
  /** Identified speaker name if present */
  speaker?: string;
  /** Extracted timestamp if present */
  timestamp?: string;
  /** Cleaned content with speaker/timestamp prefixes stripped and quotes normalized */
  cleanContent: string;
}

export interface Finding {
  /** Deterministic unique finding identifier */
  id: string;
  /** Cleaned finding text or specific clause */
  text: string;
  /** Primary category for display and filtering */
  category: FindingCategory;
  /** Explanation for why this was flagged */
  reason: string;
  /** Full source message reference */
  sourceMessage: SourceMessage;
  /** Verbatim extracted deadline if present (never fabricated) */
  deadline?: ExtractedDeadline;
  /** Priority signal level */
  priority?: PriorityLevel;
  /** Target actor or assignee if identified */
  assignee?: string;
  /** Secondary category signals */
  secondaryCategories?: FindingCategory[];
}

export interface ConversationParticipant {
  name: string;
  messageCount: number;
}

export interface AnalysisMetrics {
  totalLines: number;
  messageCount: number;
  participantCount: number;
  urgentCount: number;
  actionCount: number;
  decisionCount: number;
  questionCount: number;
}

export interface Analysis {
  /** Synthesized multi-sentence executive briefing */
  summary: string;
  /** Total valid messages analyzed */
  messageCount: number;
  /** List of participants identified in conversation */
  participants: ConversationParticipant[];
  /** Structured findings */
  findings: Finding[];
  /** Breakdown metrics */
  metrics: AnalysisMetrics;
}

/**
 * Normalizes typographical apostrophes and quotation marks to straight ASCII characters.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

// Non-speaker prefixes that might precede a colon
const nonSpeakerLabels = new Set([
  "decision",
  "decided",
  "note",
  "todo",
  "to-do",
  "urgent",
  "action",
  "action item",
  "update",
  "status",
  "summary",
  "fyi",
  "ps",
  "p.s.",
  "re",
  "fw",
  "q",
  "a",
  "question",
  "answer",
  "alert",
]);

/**
 * Parses raw text into structured SourceMessage objects.
 */
export function parseMessages(text: string): SourceMessage[] {
  const lines = text.split(/\r?\n/);
  const messages: SourceMessage[] = [];
  let messageIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for standard speaker format:
    // e.g. "Maya: We agreed..." or "[10:15 AM] Maya: We agreed..." or "Maya (10:15): We agreed..."
    const speakerMatch = trimmed.match(
      /^(?:\[(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*)?([A-Za-z0-9_.\s]{2,25})(?:\s*\((?:\d{1,2}:\d{2}(?:\s*[AP]M)?)\))?:\s*(.*)$/
    );

    if (speakerMatch) {
      const potentialSpeaker = speakerMatch[1].trim();
      const content = speakerMatch[2].trim();

      if (!nonSpeakerLabels.has(potentialSpeaker.toLowerCase())) {
        messages.push({
          index: messageIndex++,
          lineNumber: i + 1,
          raw: trimmed,
          speaker: potentialSpeaker,
          cleanContent: normalizeText(content || trimmed),
        });
        continue;
      }
    }

    // Line without a recognized speaker prefix
    messages.push({
      index: messageIndex++,
      lineNumber: i + 1,
      raw: trimmed,
      cleanContent: normalizeText(trimmed),
    });
  }

  return messages;
}

/**
 * Extracts explicit deadlines without hallucinating or inventing missing information.
 * Distinguishes explicit deadlines from mere mentions of times/dates.
 */
export function extractDeadline(text: string, isActionContext = false): ExtractedDeadline | undefined {
  const normalized = normalizeText(text);

  // 1. Explicit deadline prepositions: "by 6 PM today", "due by Friday", "before the demo", "until 5 PM", etc.
  const explicitPrepositionMatch = normalized.match(
    /\b(?:by|before|due(?:\s+(?:by|on|at))?|prior to|ahead of|until|no later than|deadline(?:\s+is)?)\s+((?:today(?:\s+(?:at|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))?|tonight|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|end of day|eod|end of week|eow|\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)(?:\s+today)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember))\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,\s*\d{4})?|the\s+(?:demo|meeting|presentation|release|launch|call|deadline|sync|review)))\b/i
  );

  if (explicitPrepositionMatch) {
    const raw = explicitPrepositionMatch[0].trim();
    const isHighUrgency = /\b(today|tonight|asap|immediately|eod|end of day)\b/i.test(raw);
    return {
      raw,
      urgency: isHighUrgency ? "high" : "medium",
    };
  }

  // 2. Relative timing words ONLY when anchored in an explicit actionable task context (e.g. "I will finish tonight")
  if (isActionContext) {
    const actionTimingMatch = normalized.match(/\b(tonight|by tonight|due tomorrow|tomorrow|asap|immediately)\b/i);
    if (actionTimingMatch) {
      const raw = actionTimingMatch[0].trim();
      const isHigh = /\b(asap|immediately|tonight)\b/i.test(raw);
      return {
        raw,
        urgency: isHigh ? "high" : "medium",
      };
    }
  }

  // Casual mentions of dates/times without deadline markers (e.g., "Meeting at 3 PM", "Lunch tomorrow?") return undefined
  return undefined;
}

// Negation regexes
const urgencyNegationRegex = /\b(?:not|no|isn't|is not|aren't|are not|hardly)\s+(?:urgent|critical|a priority|time sensitive|a blocker|in a rush)\b|\bno rush\b|\blow priority\b/i;

const actionNegationRegex = /\b(?:no need to|don't need to|do not need to|not necessary to|won't need to)\s+[a-z]+|\b(?:don't|do not|never|stop)\s+(?:send|submit|review|prepare|finish|complete|schedule|book|update|deploy|fix|test|share|draft|follow up|create|upload|email|call|ping)\b|\b(?:i won't|i will not|we won't|we will not)\s+[a-z]+/i;

const indecisionRegex = /\b(?:haven't|have not|hasn't|has not|didn't|did not|not yet|yet to|undecided)\s+(?:decided|agreed|settled|confirmed)\b|\b(?:no decision|not a decision|still discussing)\b/i;

// Decision patterns
const decisionExplicitRegex = /^(?:decision|decided|final plan|agreed|confirmed):\s*(.*)$/i;
const decisionPhraseRegex = /\b(we agreed|we decided|team agreed|team decided|decided to|agreed to|we'll go with|we will go with|let's go with|let's use|we'll use|we will use|final decision is|confirmed that|settled on|decided not to|agreed not to|confirmed not to|settled on not)\b/i;

// Action patterns
const firstPersonCommitmentRegex = /\b(i will|i'll|i can|i plan to|we will|we'll)\s+([a-z]+)\b/i;
const actionDirectiveRegex = /\b(please|kindly|remember to|don't forget to|do not forget to|make sure to|be sure to|ensure that|action item:?|todo:?|to-do:?)\b/i;
const needToRegex = /\b(?:we|you|someone|team)?\s*(?:need to|needs to|have to|has to)\s+([a-z]+)\b/i;

// Imperative bare verbs at clause start
const imperativeStartRegex = /^(?:please\s+|kindly\s+)?(send|submit|review|prepare|finish|complete|schedule|book|update|deploy|fix|test|share|draft|follow up(?:\s+with)?|check|verify|create|implement|write|upload|email|ping|reach out to)\b/i;

// Actionable requests in questions: e.g. "Can you send the report by 5 PM?"
const actionableQuestionRegex = /\b(?:can you|could you|would you|will you)\s+(?:please\s+|kindly\s+)?(send|submit|review|prepare|finish|complete|schedule|book|update|deploy|fix|test|share|draft|follow up(?:\s+with)?|check|verify|create|implement|write|upload|email|ping|reach out to)\b/i;

// Contextual urgency
const contextualUrgencyRegex = /^(?:urgent|asap|critical|blocker|emergency):|\b(?:urgent|asap|critical|blocker|emergency)\b(?:\s+[a-z]+)?[!]+|\b(?:critical\s+blocker|critical\s+issue|production\s+down|service\s+down|outage)\b|\b(?:this is|it's|it is)\s+(?:urgent|critical|a blocker|time sensitive|high priority)\b|\b(?:need(?:\s+this)?|handle(?:\s+this)?)\s+(?:asap|urgently|immediately)\b/i;

// Question patterns
const questionEndRegex = /\?\s*(?:[^\w\s]*)$/;
const interrogativeStartRegex = /^(?:can\s+(?:someone|anyone|you|we)|could\s+(?:someone|anyone|you|we)|should\s+we|shall\s+we|do\s+we|does\s+anyone|is\s+there|are\s+there|what\s+(?:is|are|should)|when\s+(?:is|are|will|can)|where\s+(?:is|are)|who\s+(?:is|can|will)|how\s+(?:should|do|can|will)|have\s+we|has\s+anyone)\b/i;

/**
 * Splits a compound message into clause candidates.
 */
function splitClauses(text: string): string[] {
  const parts = text.split(/(?:;|\.\s+|\n|,\s+(?:and|so|also)\s+)/i);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Evaluates a single message and returns all justified Findings (allowing multiple findings per message).
 */
export function evaluateMessage(msg: SourceMessage): Finding[] {
  const content = msg.cleanContent;
  const findings: Finding[] = [];

  // Check urgency negation
  const isUrgencyNegated = urgencyNegationRegex.test(content);

  // Check contextual urgency
  const hasPureUrgency = !isUrgencyNegated && contextualUrgencyRegex.test(content);

  // Clauses to inspect for distinct intents (decision, action, question)
  const clauses = splitClauses(content);
  const clausesToTest = clauses.length > 1 ? clauses : [content];

  let hasEmittedDecision = false;
  let hasEmittedAction = false;
  let hasEmittedQuestion = false;

  for (let cIdx = 0; cIdx < clausesToTest.length; cIdx++) {
    const clause = clausesToTest[cIdx];
    const isQuestionClause = questionEndRegex.test(clause) || interrogativeStartRegex.test(clause);
    const hasQuestionAboutDecision = isQuestionClause && /\b(?:decided|decision|agree|agreed)\b/i.test(clause);

    // 1. DECISION DETECTION
    const isIndecision = indecisionRegex.test(clause);
    const explicitDecisionMatch = clause.match(decisionExplicitRegex);
    const hasDecisionPhrase = decisionPhraseRegex.test(clause);
    const isDecision = (Boolean(explicitDecisionMatch) || hasDecisionPhrase) && !isIndecision && !hasQuestionAboutDecision;

    if (isDecision && !hasEmittedDecision) {
      let reason = "Records an agreed outcome or direction";
      if (explicitDecisionMatch) {
        reason = "Explicit decision recorded in conversation";
      } else if (msg.speaker) {
        reason = `Decision noted by ${msg.speaker}`;
      }

      findings.push({
        id: findings.length === 0 ? `finding-${msg.index}-decision` : `finding-${msg.index}-decision-${findings.length + 1}`,
        text: clausesToTest.length > 1 ? clause : msg.raw,
        category: "decision",
        reason,
        sourceMessage: msg,
        priority: "medium",
      });
      hasEmittedDecision = true;
      continue;
    }

    // 2. ACTION DETECTION
    const isPositiveReminder = /\b(?:don't forget to|do not forget to)\b/i.test(clause);
    const isActionNegated = actionNegationRegex.test(clause) && !isPositiveReminder;

    const hasFirstPersonCommitment = !isActionNegated && firstPersonCommitmentRegex.test(clause);
    const hasActionDirective = !isActionNegated && actionDirectiveRegex.test(clause);
    const hasNeedTo = !isActionNegated && needToRegex.test(clause);
    const hasImperativeStart = !isActionNegated && imperativeStartRegex.test(clause);
    const hasActionableQuestion = !isActionNegated && actionableQuestionRegex.test(clause);

    const isActionCandidate =
      hasFirstPersonCommitment ||
      hasActionDirective ||
      hasNeedTo ||
      hasImperativeStart ||
      hasActionableQuestion;

    if (isActionCandidate && !hasEmittedAction) {
      const deadline = extractDeadline(clause, true) || extractDeadline(content, true);

      let assignee: string | undefined = undefined;
      if (hasFirstPersonCommitment && msg.speaker) {
        assignee = msg.speaker;
      }

      let reason = "Action item or task commitment";
      if (assignee && deadline) {
        reason = `Task commitment by ${assignee} (${deadline.raw})`;
      } else if (assignee) {
        reason = `Task commitment by ${assignee}`;
      } else if (msg.speaker && deadline) {
        reason = `Action item requested by ${msg.speaker} (${deadline.raw})`;
      } else if (hasActionableQuestion) {
        reason = deadline ? `Action request (${deadline.raw})` : "Action request awaiting completion";
      } else if (hasImperativeStart) {
        reason = deadline ? `Imperative task (${deadline.raw})` : "Direct action task";
      } else if (deadline) {
        reason = `Action item with deadline (${deadline.raw})`;
      }

      const isHighPriority = deadline?.urgency === "high" || hasPureUrgency;

      findings.push({
        id: findings.length === 0 ? `finding-${msg.index}-action` : `finding-${msg.index}-action-${findings.length + 1}`,
        text: clausesToTest.length > 1 ? clause : msg.raw,
        category: "action",
        reason,
        sourceMessage: msg,
        deadline,
        priority: isHighPriority ? "high" : "medium",
        assignee,
        secondaryCategories: isHighPriority ? ["urgent"] : undefined,
      });
      hasEmittedAction = true;
      continue;
    }

    // 3. QUESTION DETECTION (non-actionable inquiries)
    if (isQuestionClause && !hasEmittedQuestion && !hasActionableQuestion) {
      // Check if it's a casual greeting/social invite like "Lunch tomorrow?"
      const isCasualSocial = /^(?:lunch|dinner|coffee|drinks|breakfast)\b/i.test(clause) ||
        /^(?:how are you|how's it going|what's up|how is everyone)\b/i.test(clause);

      if (!isCasualSocial) {
        let reason = "Question requiring an answer or follow-up";
        if (msg.speaker) {
          reason = `Open question from ${msg.speaker}`;
        }

        findings.push({
          id: findings.length === 0 ? `finding-${msg.index}-question` : `finding-${msg.index}-question-${findings.length + 1}`,
          text: clausesToTest.length > 1 ? clause : msg.raw,
          category: "question",
          reason,
          sourceMessage: msg,
          priority: "low",
        });
        hasEmittedQuestion = true;
      }
    }
  }

  // 4. STANDALONE URGENCY (only if no action/decision was extracted, but context is genuinely urgent)
  if (findings.length === 0 && hasPureUrgency) {
    const deadline = extractDeadline(content, false);
    findings.push({
      id: `finding-${msg.index}-urgent`,
      text: msg.raw,
      category: "urgent",
      reason: deadline ? `Urgent alert with deadline (${deadline.raw})` : "Contains urgent or critical priority language",
      sourceMessage: msg,
      deadline,
      priority: "high",
    });
  }

  return findings;
}

/**
 * Synthesizes a coherent, human-readable summary briefing based strictly on extracted facts.
 */
function generateBriefingSummary(
  messages: SourceMessage[],
  participants: ConversationParticipant[],
  findings: Finding[]
): string {
  if (messages.length === 0) {
    return "Add a conversation to generate a briefing.";
  }

  const parts: string[] = [];

  // 1. Participant context
  if (participants.length === 1) {
    parts.push(`Notes from ${participants[0].name} across ${messages.length} message${messages.length === 1 ? "" : "s"}.`);
  } else if (participants.length === 2) {
    parts.push(
      `Conversation between ${participants[0].name} and ${participants[1].name} across ${messages.length} messages.`
    );
  } else if (participants.length > 2) {
    const names = participants.map((p) => p.name);
    const last = names.pop();
    parts.push(`Conversation between ${names.join(", ")}, and ${last} across ${messages.length} messages.`);
  } else {
    parts.push(`Discussion across ${messages.length} message${messages.length === 1 ? "" : "s"}.`);
  }

  // 2. Findings synthesis
  const actions = findings.filter((f) => f.category === "action");
  const decisions = findings.filter((f) => f.category === "decision");
  const questions = findings.filter((f) => f.category === "question");
  const urgent = findings.filter((f) => f.category === "urgent" || f.priority === "high");

  if (findings.length === 0) {
    parts.push("No explicit deadlines, decisions, or action items were identified.");
    return parts.join(" ");
  }

  const takeawayParts: string[] = [];

  if (decisions.length > 0) {
    takeawayParts.push(`${decisions.length} decision${decisions.length === 1 ? "" : "s"} recorded`);
  }

  if (actions.length > 0) {
    const withDeadlines = actions.filter((a) => a.deadline);
    if (withDeadlines.length > 0) {
      takeawayParts.push(
        `${actions.length} action item${actions.length === 1 ? "" : "s"} identified (${withDeadlines.length} with explicit deadline${withDeadlines.length === 1 ? "" : "s"})`
      );
    } else {
      takeawayParts.push(`${actions.length} action item${actions.length === 1 ? "" : "s"} identified`);
    }
  }

  if (questions.length > 0) {
    takeawayParts.push(`${questions.length} open question${questions.length === 1 ? "" : "s"} awaiting follow-up`);
  }

  if (urgent.length > 0 && decisions.length === 0 && actions.length === 0) {
    takeawayParts.push(`${urgent.length} priority signal${urgent.length === 1 ? "" : "s"} flagged for attention`);
  }

  if (takeawayParts.length > 0) {
    parts.push(`Key takeaways: ${takeawayParts.join(", ")}.`);
  }

  return parts.join(" ");
}

/**
 * Main analysis entrypoint: parses conversation text or pre-parsed messages and generates structured findings and metrics.
 */
export function analyzeConversation(input: string | SourceMessage[]): Analysis {
  const messages = typeof input === "string" ? parseMessages(input) : input;
  const rawText = typeof input === "string" ? input : messages.map((m) => m.raw).join("\n");
  const findings: Finding[] = [];

  // Track participants
  const participantMap = new Map<string, number>();
  for (const msg of messages) {
    if (msg.speaker) {
      participantMap.set(msg.speaker, (participantMap.get(msg.speaker) ?? 0) + 1);
    }
  }

  const participants: ConversationParticipant[] = Array.from(participantMap.entries())
    .map(([name, messageCount]) => ({ name, messageCount }))
    .sort((a, b) => b.messageCount - a.messageCount);

  // Evaluate messages for findings
  for (const msg of messages) {
    const msgFindings = evaluateMessage(msg);
    findings.push(...msgFindings);
  }

  // Compute metrics
  const categoryCounts: Record<FindingCategory, number> = {
    urgent: 0,
    action: 0,
    decision: 0,
    question: 0,
  };

  for (const f of findings) {
    categoryCounts[f.category]++;
  }

  // Also account for high-priority actions in urgent count for dashboard awareness
  const urgentCount = findings.filter((f) => f.category === "urgent" || f.priority === "high").length;

  const metrics: AnalysisMetrics = {
    totalLines: rawText ? rawText.split(/\r?\n/).length : 0,
    messageCount: messages.length,
    participantCount: participants.length,
    urgentCount,
    actionCount: categoryCounts.action,
    decisionCount: categoryCounts.decision,
    questionCount: categoryCounts.question,
  };

  const summary = generateBriefingSummary(messages, participants, findings);

  return {
    summary,
    messageCount: messages.length,
    participants,
    findings,
    metrics,
  };
}