/**
 * Shared types for the What Did I Miss? conversation analysis engine.
 * These are re-exported from analyzer.ts for backward compatibility.
 */

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

