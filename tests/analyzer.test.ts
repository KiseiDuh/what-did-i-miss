import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeConversation, extractDeadline, normalizeText } from "../src/analyzer";

describe("Conversation Analyzer - Milestone 1 with Verified Review Fixes", () => {
  describe("1. Normal Inputs", () => {
    const sampleConversation = `Maya: We agreed to use React and TypeScript for the prototype.
Rohan: I will prepare the first dashboard draft tonight.
Maya: The demo is tomorrow, so please send the slides by 6 PM today.
Aarav: Can someone confirm whether the sample data is ready?
Rohan: Decision: we'll keep the first version local-only and won't connect external APIs.
Maya: Don't forget to review the mobile layout before the demo.
Aarav: Should we add CSV import after the first demo?`;

    it("parses participants correctly", () => {
      const result = analyzeConversation(sampleConversation);
      expect(result.participants).toHaveLength(3);
      expect(result.participants.map((p) => p.name)).toEqual(["Maya", "Rohan", "Aarav"]);
      expect(result.messageCount).toBe(7);
    });

    it("identifies decisions reliably", () => {
      const result = analyzeConversation(sampleConversation);
      const decisions = result.findings.filter((f) => f.category === "decision");
      expect(decisions.length).toBe(2);
      expect(decisions[0].text).toContain("We agreed to use React and TypeScript");
      expect(decisions[1].text).toContain("Decision: we'll keep the first version local-only");
    });

    it("identifies action items and attaches deadlines", () => {
      const result = analyzeConversation(sampleConversation);
      const actions = result.findings.filter((f) => f.category === "action");
      expect(actions.length).toBe(3);

      const rohanAction = actions.find((a) => a.text.includes("first dashboard draft"));
      expect(rohanAction).toBeDefined();
      expect(rohanAction?.assignee).toBe("Rohan");
      expect(rohanAction?.deadline?.raw).toBe("tonight");
      expect(rohanAction?.priority).toBe("high");

      const mayaSlideAction = actions.find((a) => a.text.includes("send the slides"));
      expect(mayaSlideAction).toBeDefined();
      expect(mayaSlideAction?.deadline?.raw).toContain("by 6 PM today");
      expect(mayaSlideAction?.priority).toBe("high");

      const mobileReviewAction = actions.find((a) => a.text.includes("mobile layout"));
      expect(mobileReviewAction).toBeDefined();
      expect(mobileReviewAction?.deadline?.raw).toBe("before the demo");
    });

    it("identifies open questions needing answers", () => {
      const result = analyzeConversation(sampleConversation);
      const questions = result.findings.filter((f) => f.category === "question");
      expect(questions.length).toBe(2);
      expect(questions[0].text).toContain("Can someone confirm whether the sample data is ready?");
      expect(questions[1].text).toContain("Should we add CSV import after the first demo?");
    });

    it("synthesizes an informative briefing summary without echoing raw chat", () => {
      const result = analyzeConversation(sampleConversation);
      expect(result.summary).toContain("Conversation between Maya, Rohan, and Aarav");
      expect(result.summary).toContain("2 decisions recorded");
      expect(result.summary).toContain("3 action items identified");
      expect(result.summary).toContain("2 open questions awaiting follow-up");
    });
  });

  describe("2. Empty & Whitespace Inputs", () => {
    it("handles empty string gracefully", () => {
      const result = analyzeConversation("");
      expect(result.messageCount).toBe(0);
      expect(result.findings).toHaveLength(0);
      expect(result.participants).toHaveLength(0);
      expect(result.summary).toBe("Add a conversation to generate a briefing.");
    });

    it("handles whitespace and newline-only input gracefully", () => {
      const result = analyzeConversation("   \n\n\t  \r\n   ");
      expect(result.messageCount).toBe(0);
      expect(result.findings).toHaveLength(0);
      expect(result.summary).toBe("Add a conversation to generate a briefing.");
    });
  });

  describe("3. Priority 1: Correctness and Trust (False Urgency, Negation, Casual Questions)", () => {
    it("prevents false urgency from standalone words like 'tonight', 'critical', or 'urgent'", () => {
      const chat1 = "Alex: Movies tonight?";
      const res1 = analyzeConversation(chat1);
      expect(res1.findings.filter((f) => f.category === "urgent")).toHaveLength(0);
      expect(res1.findings.filter((f) => f.category === "action")).toHaveLength(0);

      const chat2 = "Jordan: We should encourage critical thinking.";
      const res2 = analyzeConversation(chat2);
      expect(res2.findings.filter((f) => f.category === "urgent")).toHaveLength(0);

      const chat3 = "Taylor: Is this urgent?";
      const res3 = analyzeConversation(chat3);
      expect(res3.findings.filter((f) => f.category === "urgent")).toHaveLength(0);
      const questions = res3.findings.filter((f) => f.category === "question");
      expect(questions).toHaveLength(1);
    });

    it("detects genuine contextual urgency", () => {
      const urgentChat = "System: Critical blocker! Database service is down.";
      const res = analyzeConversation(urgentChat);
      const urgent = res.findings.filter((f) => f.category === "urgent");
      expect(urgent.length).toBeGreaterThan(0);
    });

    it("handles urgency negation such as 'This is not urgent' and 'No rush'", () => {
      const chat = `Maya: This is not urgent, take your time.
Rohan: No rush on this task.`;
      const res = analyzeConversation(chat);
      const urgent = res.findings.filter((f) => f.category === "urgent");
      expect(urgent).toHaveLength(0);
    });

    it("handles action negation such as 'No need to send the invoice' and 'Don't send the slides'", () => {
      const chat = `Rohan: No need to send the invoice today.
Maya: Don't send the slides yet.`;
      const res = analyzeConversation(chat);
      const actions = res.findings.filter((f) => f.category === "action");
      expect(actions).toHaveLength(0);
    });

    it("does not classify casual questions such as 'Lunch tomorrow?' as tasks with deadlines", () => {
      const chat = "Sam: Lunch tomorrow?";
      const res = analyzeConversation(chat);
      const actions = res.findings.filter((f) => f.category === "action");
      expect(actions).toHaveLength(0);
      for (const finding of res.findings) {
        expect(finding.deadline).toBeUndefined();
      }
    });

    it("distinguishes an explicit deadline from a mere mention of a time or date", () => {
      expect(extractDeadline("Meeting at 3 PM.")).toBeUndefined();
      expect(extractDeadline("Lunch tomorrow?")).toBeUndefined();
      expect(extractDeadline("Release on Friday.")).toBeUndefined();

      const dl1 = extractDeadline("Send report by 3 PM.");
      expect(dl1).toBeDefined();
      expect(dl1?.raw).toBe("by 3 PM");

      const dl2 = extractDeadline("Submit draft by Friday.");
      expect(dl2).toBeDefined();
      expect(dl2?.raw).toBe("by Friday");

      const dl3 = extractDeadline("The homework is due on Monday.");
      expect(dl3).toBeDefined();
      expect(dl3?.raw).toBe("due on Monday");
    });

    it("preserves legitimate positive reminders like 'Don't forget to review'", () => {
      const chat = "Maya: Don't forget to review the mobile layout before the demo.";
      const res = analyzeConversation(chat);
      const actions = res.findings.filter((f) => f.category === "action");
      expect(actions).toHaveLength(1);
      expect(actions[0].text).toContain("Don't forget to review");
      expect(actions[0].deadline?.raw).toBe("before the demo");
    });

    it("preserves legitimate negative decisions like 'decided not to use' while rejecting indecision", () => {
      const chatDecision = "Rohan: We decided not to use external APIs.";
      const resDecision = analyzeConversation(chatDecision);
      const decisions = resDecision.findings.filter((f) => f.category === "decision");
      expect(decisions).toHaveLength(1);
      expect(decisions[0].text).toContain("decided not to use external APIs");

      const chatIndecision = "Rohan: We haven't decided yet.";
      const resIndecision = analyzeConversation(chatIndecision);
      expect(resIndecision.findings.filter((f) => f.category === "decision")).toHaveLength(0);
    });
  });

  describe("4. Priority 2: Action Extraction (Curly Apostrophes, Bare Imperatives, Requests as Questions, Multiple Findings)", () => {
    it("normalizes curly apostrophes before matching contractions", () => {
      expect(normalizeText("I’ll prepare the draft")).toBe("I'll prepare the draft");
      expect(normalizeText("don’t forget")).toBe("don't forget");
      expect(normalizeText("we’ll use React")).toBe("we'll use React");

      const chat = `Rohan: I’ll prepare the first draft tonight.
Maya: Don’t forget to check the mobile view.
Team: We’ll use Vite for building.`;
      const res = analyzeConversation(chat);

      const actions = res.findings.filter((f) => f.category === "action");
      expect(actions.length).toBe(2);

      const decisions = res.findings.filter((f) => f.category === "decision");
      expect(decisions.length).toBe(1);
    });

    it("restores useful imperative-action patterns like 'Send me the slides by 5 PM' and 'Follow up with the vendor'", () => {
      const chat = `Maya: Send me the slides by 5 PM.
Rohan: Follow up with the vendor regarding pricing.`;
      const res = analyzeConversation(chat);
      const actions = res.findings.filter((f) => f.category === "action");
      expect(actions.length).toBe(2);

      const sendAction = actions.find((a) => a.text.includes("Send me the slides"));
      expect(sendAction).toBeDefined();
      expect(sendAction?.deadline?.raw).toBe("by 5 PM");

      const vendorAction = actions.find((a) => a.text.includes("Follow up with the vendor"));
      expect(vendorAction).toBeDefined();
    });

    it("detects actionable requests phrased as questions like 'Can you send the report by 5 PM?'", () => {
      const chat = "Alex: Can you send the report by 5 PM?";
      const res = analyzeConversation(chat);
      const actions = res.findings.filter((f) => f.category === "action");
      expect(actions.length).toBe(1);
      expect(actions[0].deadline?.raw).toBe("by 5 PM");
    });

    it("allows a single message to produce multiple distinct findings (e.g. decision + action)", () => {
      const chat = "Maya: We agreed to use React, and I will prepare the first dashboard draft tonight.";
      const res = analyzeConversation(chat);

      const decisions = res.findings.filter((f) => f.category === "decision");
      const actions = res.findings.filter((f) => f.category === "action");

      expect(decisions.length).toBe(1);
      expect(decisions[0].text).toContain("We agreed to use React");

      expect(actions.length).toBe(1);
      expect(actions[0].text).toContain("I will prepare the first dashboard draft tonight");
      expect(actions[0].deadline?.raw).toBe("tonight");
    });

    it("extracts multiple findings from a message with decision and imperative action", () => {
      const chat = "Rohan: Decision: local-only for v1. Please send the schema by 5 PM.";
      const res = analyzeConversation(chat);

      const decisions = res.findings.filter((f) => f.category === "decision");
      const actions = res.findings.filter((f) => f.category === "action");

      expect(decisions.length).toBe(1);
      expect(actions.length).toBe(1);
      expect(actions[0].deadline?.raw).toBe("by 5 PM");
    });
  });

  describe("5. Conversations With No Actionable Content", () => {
    const casualChat = `Alice: Hey everyone!
Bob: Hi Alice, how are you doing?
Alice: Doing well! Hope you have a great weekend.
Bob: Thanks, you too!`;

    it("returns no action items or decisions for purely social banter", () => {
      const result = analyzeConversation(casualChat);
      const actions = result.findings.filter((f) => f.category === "action");
      const decisions = result.findings.filter((f) => f.category === "decision");
      const urgent = result.findings.filter((f) => f.category === "urgent");

      expect(actions).toHaveLength(0);
      expect(decisions).toHaveLength(0);
      expect(urgent).toHaveLength(0);
    });

    it("generates a graceful summary acknowledging the absence of actionable signals", () => {
      const text = `Alice: Hello there!
Bob: Good morning!`;
      const result = analyzeConversation(text);
      expect(result.summary).toContain("No explicit deadlines, decisions, or action items were identified.");
    });
  });

  describe("6. Source Message Retention & Auditability", () => {
    it("preserves exact line numbers and raw content on findings", () => {
      const conversation = `Maya: We agreed on the design.\n\nRohan: I will prepare the presentation tonight.`;
      const result = analyzeConversation(conversation);
      expect(result.findings.length).toBeGreaterThan(0);

      const rohanFinding = result.findings.find((f) => f.text.includes("presentation"));
      expect(rohanFinding).toBeDefined();
      expect(rohanFinding?.sourceMessage).toBeDefined();
      expect(rohanFinding?.sourceMessage.speaker).toBe("Rohan");
      expect(rohanFinding?.sourceMessage.raw).toBe("Rohan: I will prepare the presentation tonight.");
      expect(rohanFinding?.sourceMessage.lineNumber).toBe(3);
    });
  });

  describe("7. Privacy Regression Verification", () => {
    let originalFetch: typeof globalThis.fetch;
    let originalXHR: typeof globalThis.XMLHttpRequest;
    let originalWebSocket: typeof globalThis.WebSocket;
    let originalSendBeacon: typeof navigator.sendBeacon | undefined;

    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    const wsSpy = vi.fn();
    const beaconSpy = vi.fn();

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      originalXHR = globalThis.XMLHttpRequest;
      originalWebSocket = globalThis.WebSocket;
      originalSendBeacon = globalThis.navigator?.sendBeacon;

      globalThis.fetch = fetchSpy;
      // @ts-expect-error Mocking XHR
      globalThis.XMLHttpRequest = xhrSpy;
      // @ts-expect-error Mocking WebSocket
      globalThis.WebSocket = wsSpy;
      if (globalThis.navigator) {
        globalThis.navigator.sendBeacon = beaconSpy;
      }
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      globalThis.XMLHttpRequest = originalXHR;
      globalThis.WebSocket = originalWebSocket;
      if (globalThis.navigator && originalSendBeacon !== undefined) {
        globalThis.navigator.sendBeacon = originalSendBeacon;
      }
      vi.clearAllMocks();
    });

    it("verifies analysis never touches fetch, XMLHttpRequest, WebSocket, or sendBeacon", () => {
      const sensitiveText = `Executive: Project codename Apollo is approved.
Finance: We agreed to a $50,000 budget for Q3.
Lead: I will deploy the private keys by 6 PM today.
Security: Critical blocker! Please verify network isolation immediately.`;

      const result = analyzeConversation(sensitiveText);

      expect(result.findings.length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSpy).not.toHaveBeenCalled();
      expect(wsSpy).not.toHaveBeenCalled();
      expect(beaconSpy).not.toHaveBeenCalled();
    });
  });
});
