import { describe, it, expect } from "vitest";
import {
  parseTxt,
  parseJson,
  parseCsv,
  parseContentAuto,
  registerCustomParser,
  type ParseResult,
} from "../src/parsers";

describe("Modular Parsers - TXT, JSON, CSV & Extensibility", () => {
  describe("1. Plain Text Parsing (.txt)", () => {
    it("parses standard and timestamped lines", () => {
      const text = `Maya: We agreed to use React.
[10:15 AM] Rohan: I will finish the draft tonight.
Simple unformatted note`;

      const result = parseTxt(text, "notes.txt");
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].speaker).toBe("Maya");
      expect(result.messages[0].cleanContent).toBe("We agreed to use React.");
      expect(result.messages[1].speaker).toBe("Rohan");
      expect(result.messages[1].cleanContent).toBe("I will finish the draft tonight.");
      expect(result.messages[2].speaker).toBeUndefined();
    });

    it("returns error on empty text", () => {
      const result = parseTxt("   \n\n  ");
      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });
  });

  describe("2. JSON Parsing (.json)", () => {
    it("parses array of message objects", () => {
      const json = JSON.stringify([
        { sender: "Maya", text: "We agreed to use React." },
        { sender: "Rohan", text: "I will prepare the draft tonight." }
      ]);

      const result = parseJson(json, "chat.json");
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].speaker).toBe("Maya");
      expect(result.messages[0].cleanContent).toBe("We agreed to use React.");
      expect(result.messages[1].speaker).toBe("Rohan");
    });

    it("parses wrapped message envelope and alternative keys", () => {
      const json = JSON.stringify({
        conversation_id: "conv-123",
        messages: [
          { author: "Alice", content: "Can you send the report by 5 PM?", timestamp: "2024-05-01T10:00:00Z" },
          { author: "Bob", body: "I will send it right away." }
        ]
      });

      const result = parseJson(json);
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].speaker).toBe("Alice");
      expect(result.messages[0].timestamp).toBe("2024-05-01T10:00:00Z");
      expect(result.messages[1].speaker).toBe("Bob");
    });

    it("parses array of strings in JSON", () => {
      const json = JSON.stringify(["Alice: Hello", "Bob: Hi there"]);
      const result = parseJson(json);
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
    });

    it("returns clear syntax error on malformed JSON", () => {
      const invalidJson = "{ sender: Maya, ";
      const result = parseJson(invalidJson);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON syntax");
    });

    it("returns error on unrecognized JSON structures", () => {
      const invalidObj = JSON.stringify({ version: "1.0", status: "ok" });
      const result = parseJson(invalidObj);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unrecognized JSON structure");
    });
  });

  describe("3. CSV Parsing (.csv)", () => {
    it("parses CSV with standard headers", () => {
      const csv = `sender,message,timestamp
Maya,We agreed to use React.,10:00
Rohan,I will prepare the draft tonight.,10:05`;

      const result = parseCsv(csv, "chat.csv");
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].speaker).toBe("Maya");
      expect(result.messages[0].cleanContent).toBe("We agreed to use React.");
      expect(result.messages[1].speaker).toBe("Rohan");
    });

    it("handles RFC 4180 quotes with embedded commas and newlines", () => {
      const csv = `author,text
Maya,"We agreed, after discussion, to use React."
Rohan,"I will finish the draft.\nHere is line 2."`;

      const result = parseCsv(csv);
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].cleanContent).toBe("We agreed, after discussion, to use React.");
      expect(result.messages[1].cleanContent).toContain("Here is line 2.");
    });

    it("parses headerless CSV using position-based fallback", () => {
      const csv = `Maya,Let's build the prototype.
Rohan,Sounds good.`;

      const result = parseCsv(csv);
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].speaker).toBe("Maya");
      expect(result.messages[0].cleanContent).toBe("Let's build the prototype.");
    });

    it("returns error on empty CSV", () => {
      const result = parseCsv("  ");
      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });
  });

  describe("4. Custom Parser Extensibility (For Judge Datasets)", () => {
    it("supports registering custom format adapters", () => {
      // Suppose judges provide custom format: "ID|||SPEAKER|||TEXT"
      const customAdapter = (content: string, fileName: string): ParseResult | null => {
        if (!fileName.endsWith(".custom") && !content.includes("|||")) return null;
        const lines = content.split(/\r?\n/).filter(Boolean);
        const messages = lines.map((line, idx) => {
          const parts = line.split("|||");
          return {
            index: idx + 1,
            lineNumber: idx + 1,
            raw: line,
            speaker: parts[1]?.trim(),
            cleanContent: parts[2]?.trim() || line,
          };
        });

        return {
          success: true,
          text: messages.map((m) => `${m.speaker}: ${m.cleanContent}`).join("\n"),
          messages,
          formatDetected: "custom",
          metadata: { rowCount: messages.length, description: "Custom judge dataset adapter" },
        };
      };

      registerCustomParser("judgeCustom", customAdapter);

      const customInput = `1|||Judge|||We decided to award top marks.
2|||Evaluator|||I will submit the scores today.`;

      const result = parseContentAuto(customInput, "dataset.custom");
      expect(result.success).toBe(true);
      expect(result.formatDetected).toBe("custom");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].speaker).toBe("Judge");
      expect(result.messages[1].speaker).toBe("Evaluator");
    });
  });

  describe("5. Auto Detection", () => {
    it("auto-detects JSON by extension and sniffing", () => {
      const res = parseContentAuto(JSON.stringify([{ sender: "Alice", text: "Hello" }]));
      expect(res.formatDetected).toBe("json");
      expect(res.success).toBe(true);
    });

    it("auto-detects CSV by extension and headers", () => {
      const res = parseContentAuto(`sender,message\nAlice,Hello`, "file.csv");
      expect(res.formatDetected).toBe("csv");
      expect(res.success).toBe(true);
    });
  });
});

