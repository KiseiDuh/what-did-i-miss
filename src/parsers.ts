import { type SourceMessage, normalizeText } from "./analyzer";

export interface ParseResult {
  success: boolean;
  text: string;
  messages: SourceMessage[];
  formatDetected: "txt" | "json" | "csv" | "custom" | "plain";
  metadata?: {
    fileName?: string;
    rowCount?: number;
    detectedHeaders?: string[];
    description?: string;
  };
  error?: string;
}

// Extensible registry for future judge-specific dataset formats
export type CustomParserAdapter = (content: string, fileName: string) => ParseResult | null;
const customAdapters = new Map<string, CustomParserAdapter>();

export function registerCustomParser(name: string, adapter: CustomParserAdapter): void {
  customAdapters.set(name, adapter);
}

/**
 * Parses plain text / .txt conversation lines into structured SourceMessages.
 */
export function parseTxt(content: string, fileName = "input.txt"): ParseResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "txt",
      error: "The text content is empty.",
    };
  }

  const lines = content.split(/\r?\n/);
  const messages: SourceMessage[] = [];
  let msgIdx = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const speakerMatch = rawLine.match(
      /^(?:\[(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*)?([A-Za-z0-9_.\s]{2,25})(?:\s*\((?:\d{1,2}:\d{2}(?:\s*[AP]M)?)\))?:\s*(.*)$/
    );

    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const body = speakerMatch[2].trim();
      messages.push({
        index: msgIdx++,
        lineNumber: i + 1,
        raw: rawLine,
        speaker,
        cleanContent: normalizeText(body || rawLine),
      });
    } else {
      messages.push({
        index: msgIdx++,
        lineNumber: i + 1,
        raw: rawLine,
        cleanContent: normalizeText(rawLine),
      });
    }
  }

  return {
    success: true,
    text: content,
    messages,
    formatDetected: "txt",
    metadata: {
      fileName,
      rowCount: messages.length,
      description: `Parsed ${messages.length} messages from plain text.`,
    },
  };
}

/**
 * Parses JSON conversation files supporting array of objects or wrapped object envelopes.
 */
export function parseJson(content: string, fileName = "input.json"): ParseResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "json",
      error: "JSON file is empty.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "json",
      error: `Invalid JSON syntax: ${message}`,
    };
  }

  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const candidateKeys = ["messages", "conversation", "chat", "data", "thread", "items", "records"];
    for (const key of candidateKeys) {
      if (Array.isArray(obj[key])) {
        items = obj[key] as unknown[];
        break;
      }
    }
  }

  if (items.length === 0) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "json",
      error: "Unrecognized JSON structure: Expected an array of messages or an object with a 'messages' array.",
    };
  }

  const messages: SourceMessage[] = [];
  const textLines: string[] = [];
  let msgIdx = 1;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item === "string") {
      const raw = item.trim();
      if (!raw) continue;
      textLines.push(raw);
      messages.push({
        index: msgIdx++,
        lineNumber: i + 1,
        raw,
        cleanContent: normalizeText(raw),
      });
      continue;
    }

    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      // Look for text field
      const textVal = rec.text ?? rec.message ?? rec.content ?? rec.body ?? rec.msg ?? rec.utterance;
      const textStr = typeof textVal === "string" ? textVal.trim() : "";
      if (!textStr) continue;

      // Look for speaker field
      const speakerVal = rec.sender ?? rec.speaker ?? rec.author ?? rec.user ?? rec.from ?? rec.name ?? rec.username;
      const speakerStr = typeof speakerVal === "string" ? speakerVal.trim() : undefined;

      // Look for timestamp
      const timeVal = rec.timestamp ?? rec.time ?? rec.date ?? rec.datetime ?? rec.created_at;
      const timeStr = typeof timeVal === "string" ? timeVal.trim() : undefined;

      const prefix = speakerStr ? `${speakerStr}: ` : "";
      const raw = `${prefix}${textStr}`;
      textLines.push(raw);

      messages.push({
        index: msgIdx++,
        lineNumber: i + 1,
        raw,
        speaker: speakerStr,
        timestamp: timeStr,
        cleanContent: normalizeText(textStr),
      });
    }
  }

  if (messages.length === 0) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "json",
      error: "JSON file contained no recognizable message texts.",
    };
  }

  return {
    success: true,
    text: textLines.join("\n"),
    messages,
    formatDetected: "json",
    metadata: {
      fileName,
      rowCount: messages.length,
      description: `Parsed ${messages.length} messages from JSON.`,
    },
  };
}

/**
 * Robust RFC 4180-compliant CSV parser handling embedded commas and newlines.
 */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * Parses CSV conversation files with headers or position-based fallback.
 */
export function parseCsv(content: string, fileName = "input.csv"): ParseResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "csv",
      error: "CSV file is empty.",
    };
  }

  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "csv",
      error: "CSV file contains no rows.",
    };
  }

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  let speakerCol = -1;
  let textCol = -1;
  let timeCol = -1;
  let hasHeader = false;

  // Identify column indices
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i];
    if (["sender", "author", "speaker", "user", "name", "from", "who"].includes(h)) {
      speakerCol = i;
      hasHeader = true;
    } else if (["message", "text", "content", "body", "msg", "utterance"].includes(h)) {
      textCol = i;
      hasHeader = true;
    } else if (["timestamp", "time", "date", "datetime"].includes(h)) {
      timeCol = i;
      hasHeader = true;
    }
  }

  // Fallback for headerless CSVs
  if (!hasHeader) {
    if (rows[0].length >= 2) {
      speakerCol = 0;
      textCol = 1;
      if (rows[0].length >= 3) timeCol = 2;
    } else {
      textCol = 0;
    }
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const messages: SourceMessage[] = [];
  const textLines: string[] = [];
  let msgIdx = 1;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const textStr = textCol >= 0 && row[textCol] ? row[textCol].trim() : "";
    if (!textStr) continue;

    const speakerStr = speakerCol >= 0 && row[speakerCol] ? row[speakerCol].trim() : undefined;
    const timeStr = timeCol >= 0 && row[timeCol] ? row[timeCol].trim() : undefined;

    const prefix = speakerStr ? `${speakerStr}: ` : "";
    const raw = `${prefix}${textStr}`;
    textLines.push(raw);

    messages.push({
      index: msgIdx++,
      lineNumber: (hasHeader ? 2 : 1) + i,
      raw,
      speaker: speakerStr,
      timestamp: timeStr,
      cleanContent: normalizeText(textStr),
    });
  }

  if (messages.length === 0) {
    return {
      success: false,
      text: "",
      messages: [],
      formatDetected: "csv",
      error: "CSV file contained no message text in the detected columns.",
    };
  }

  return {
    success: true,
    text: textLines.join("\n"),
    messages,
    formatDetected: "csv",
    metadata: {
      fileName,
      rowCount: messages.length,
      detectedHeaders: hasHeader ? rows[0] : undefined,
      description: `Parsed ${messages.length} messages from CSV (${hasHeader ? "with headers" : "position-based"}).`,
    },
  };
}

/**
 * Automatically detects file format based on filename and content, delegating to appropriate parser.
 */
export function parseContentAuto(content: string, fileName = "conversation.txt"): ParseResult {
  const lowerName = fileName.toLowerCase();
  const trimmed = content.trim();

  // 1. Check custom adapters first (for judge competition datasets)
  for (const [, adapter] of customAdapters) {
    const customResult = adapter(content, fileName);
    if (customResult) return customResult;
  }

  // 2. Explicit JSON/CSV extensions
  if (lowerName.endsWith(".json")) {
    return parseJson(content, fileName);
  }
  if (lowerName.endsWith(".csv")) {
    return parseCsv(content, fileName);
  }

  // 3. Content sniffing (detect JSON or CSV even when pasted or generic filename)
  if (trimmed.startsWith("[") || (trimmed.startsWith("{") && (trimmed.includes('"messages"') || trimmed.includes('"sender"') || trimmed.includes('"text"')))) {
    const jsonAttempt = parseJson(content, fileName);
    if (jsonAttempt.success) return jsonAttempt;
  }

  // Sniff CSV: check for common header line or comma separated rows
  const firstLine = trimmed.split(/\r?\n/)[0] || "";
  if (firstLine.includes(",") && (firstLine.includes("sender") || firstLine.includes("message") || firstLine.includes("text") || firstLine.includes("author"))) {
    const csvAttempt = parseCsv(content, fileName);
    if (csvAttempt.success) return csvAttempt;
  }

  // 4. Default to plain text
  return parseTxt(content, fileName);
}
