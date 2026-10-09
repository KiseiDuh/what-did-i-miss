import { useMemo, useState, useRef } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown,
  ChevronUp, CircleHelp, ClipboardList, FileText, LockKeyhole, MessageSquareText,
  RotateCcw, ShieldCheck, Sparkles, Upload, X, FileSpreadsheet, FileCode,
  File, Loader2, Info
} from "lucide-react";
import { analyzeConversation, type Finding, type SourceMessage } from "./analyzer";
import { parseContentAuto, type ParseResult } from "./parsers";

const samplePlainText = `Maya: We agreed to use React and TypeScript for the prototype.
Rohan: I will prepare the first dashboard draft tonight.
Maya: The demo is tomorrow, so please send the slides by 6 PM today.
Aarav: Can someone confirm whether the sample data is ready?
Rohan: Decision: we'll keep the first version local-only and won't connect external APIs.
Maya: Don't forget to review the mobile layout before the demo.
Aarav: Should we add CSV import after the first demo?`;

const sampleJsonText = JSON.stringify(
  [
    { sender: "Maya", text: "We agreed to use React and TypeScript for the prototype." },
    { sender: "Rohan", text: "I will prepare the first dashboard draft tonight." },
    { sender: "Maya", text: "The demo is tomorrow, so please send the slides by 6 PM today." },
    { sender: "Aarav", text: "Can someone confirm whether the sample data is ready?" },
    { sender: "Rohan", text: "Decision: we'll keep the first version local-only." }
  ],
  null,
  2
);

const sampleCsvText = `sender,message,timestamp
Maya,"We agreed to use React and TypeScript for the prototype.","10:00"
Rohan,"I will prepare the first dashboard draft tonight.","10:05"
Maya,"The demo is tomorrow, so please send the slides by 6 PM today.","10:10"
Aarav,"Can someone confirm whether the sample data is ready?","10:15"`;

const labels: Record<Finding["category"], string> = {
  urgent: "Priority",
  action: "Action item",
  decision: "Decision",
  question: "Open question",
};

interface UploadedFileMeta {
  name: string;
  format: string;
  count: number;
}

function App() {
  const [conversation, setConversation] = useState("");
  const [analyzedMessages, setAnalyzedMessages] = useState<SourceMessage[] | null>(null);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [uploadedFile, setUploadedFile] = useState<UploadedFileMeta | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic parser evaluation on current textarea value
  const parsedPreview = useMemo(() => {
    const trimmed = conversation.trim();
    if (!trimmed) return null;
    return parseContentAuto(trimmed, uploadedFile?.name || "conversation.txt");
  }, [conversation, uploadedFile]);

  const currentMessageCount = parsedPreview?.messages.length ?? 0;
  const currentLineCount = conversation ? conversation.split(/\r?\n/).length : 0;

  // Analysis derived strictly from current input
  const analysis = useMemo(() => {
    if (!isAnalyzed) return null;
    if (analyzedMessages && analyzedMessages.length > 0) {
      return analyzeConversation(analyzedMessages);
    }
    if (conversation.trim()) {
      return analyzeConversation(conversation);
    }
    return null;
  }, [isAnalyzed, analyzedMessages, conversation]);

  const activeFindings = useMemo(
    () => (analysis?.findings ?? []).filter((finding) => !dismissedIds.has(finding.id)),
    [analysis, dismissedIds],
  );

  const filtered = activeFilter === "all"
    ? activeFindings
    : activeFindings.filter(
        (finding) =>
          finding.category === activeFilter ||
          (activeFilter === "urgent" && finding.priority === "high"),
      );

  function handleDismiss(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
  }

  function handleToggleComplete(id: string) {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTextareaChange(value: string) {
    setConversation(value);
    // Invalidate stale results and notifications as soon as input changes
    setIsAnalyzed(false);
    setAnalyzedMessages(null);
    setSuccessNotice("");
    if (error) setError("");
    setDismissedIds(new Set());
    setCompletedIds(new Set());
    if (uploadedFile) setUploadedFile(null);
  }

  function handleRunAnalysis() {
    const trimmed = conversation.trim();
    if (!trimmed) {
      setError("Please paste a conversation or upload a file first.");
      setIsAnalyzed(false);
      setSuccessNotice("");
      return;
    }

    setError("");
    setSuccessNotice("");
    setIsAnalyzing(true);

    setTimeout(() => {
      try {
        const parseResult = parseContentAuto(trimmed, uploadedFile?.name || "conversation.txt");
        if (!parseResult.success || parseResult.messages.length === 0) {
          setIsAnalyzing(false);
          setIsAnalyzed(false);
          setError(parseResult.error || "No valid messages could be parsed from the conversation.");
          return;
        }

        setAnalyzedMessages(parseResult.messages);
        setIsAnalyzed(true);
        setActiveFilter("all");
        setDismissedIds(new Set());
        setCompletedIds(new Set());
        setIsAnalyzing(false);
        setSuccessNotice(`Analysis complete: ${parseResult.messages.length} message${parseResult.messages.length === 1 ? "" : "s"} scanned.`);
      } catch (err) {
        setIsAnalyzing(false);
        setIsAnalyzed(false);
        setError(`Analysis error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 80);
  }

  function processFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["txt", "json", "csv"].includes(ext)) {
      setError(`Unsupported file format (.${ext || "unknown"}). Please upload a plain text (.txt), JSON (.json), or CSV (.csv) file.`);
      return;
    }

    setError("");
    setSuccessNotice("");
    setIsAnalyzed(false);
    setAnalyzedMessages(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        setError(`The uploaded file (${file.name}) is empty.`);
        return;
      }

      const parsed: ParseResult = parseContentAuto(content, file.name);
      if (!parsed.success) {
        setError(parsed.error || `Failed to parse ${file.name}.`);
        return;
      }

      setConversation(parsed.text);
      setAnalyzedMessages(parsed.messages);
      setIsAnalyzed(false);
      setSuccessNotice("");
      setDismissedIds(new Set());
      setCompletedIds(new Set());
      setUploadedFile({
        name: file.name,
        format: parsed.formatDetected.toUpperCase(),
        count: parsed.messages.length,
      });
    };

    reader.onerror = () => {
      setError(`Error reading file ${file.name}.`);
    };

    reader.readAsText(file);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function clearAll() {
    setConversation("");
    setAnalyzedMessages(null);
    setIsAnalyzed(false);
    setError("");
    setSuccessNotice("");
    setActiveFilter("all");
    setDismissedIds(new Set());
    setCompletedIds(new Set());
    setUploadedFile(null);
  }

  function resetResults() {
    setIsAnalyzed(false);
    setAnalyzedMessages(null);
    setError("");
    setSuccessNotice("");
    setDismissedIds(new Set());
    setCompletedIds(new Set());
  }

  function loadTemplate(type: "plain" | "json" | "csv") {
    clearAll();
    if (type === "plain") {
      setConversation(samplePlainText);
      setUploadedFile({ name: "sample.txt", format: "TXT", count: 7 });
    } else if (type === "json") {
      setConversation(sampleJsonText);
      setUploadedFile({ name: "sample.json", format: "JSON", count: 5 });
    } else if (type === "csv") {
      setConversation(sampleCsvText);
      setUploadedFile({ name: "sample.csv", format: "CSV", count: 4 });
    }
    setShowFormatGuide(false);
  }

  const count = (category: Finding["category"]) =>
    category === "urgent"
      ? activeFindings.filter((item) => item.category === "urgent" || item.priority === "high").length
      : activeFindings.filter((item) => item.category === category).length;

  return (
    <main className="app-shell">
      <input
        type="file"
        ref={fileInputRef}
        accept=".txt,.json,.csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div><strong>missed.</strong><span>conversation briefing</span></div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <button className="side-link active"><MessageSquareText size={17} /> Catch me up</button>
        <button className="side-link" onClick={() => fileInputRef.current?.click()}><Upload size={17} /> Upload file</button>
        <button className="side-link" onClick={() => setShowFormatGuide(!showFormatGuide)}><FileText size={17} /> Formats & Guide</button>

        <div className="sidebar-bottom">
          <div className="privacy-icon"><ShieldCheck size={18} /></div>
          <strong>Privacy first</strong>
          <p>All conversation analysis runs 100% locally in your browser. Zero conversation text is ever transmitted to an external service.</p>
          <span className="local-pill"><span /> STRICT LOCAL PROCESSING</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Catch me up</strong></div>
          <div className="top-status"><span className="status-dot" /> Local Mode Active <ChevronDown size={14} /></div>
        </header>

        <div className="content">
          <div className="hero">
            <div className="eyebrow"><Activity size={14} /> CONVERSATION INTELLIGENCE</div>
            <h1>What did I <em>miss?</em></h1>
            <p>Skip the scroll. Surface explicit action items, decisions, deadlines, and questions directly from your conversation.</p>
          </div>

          <section className="input-card">
            <div className="card-heading">
              <div className="heading-icon"><MessageSquareText size={18} /></div>
              <div>
                <h2>Drop in your conversation</h2>
                <p>Paste a chat, meeting thread, or upload a TXT, JSON, or CSV file.</p>
              </div>
              <span className="private-tag"><LockKeyhole size={12} /> Private by design</span>
            </div>

            {uploadedFile && (
              <div className="upload-status-row">
                <span className="upload-chip">
                  <File size={13} /> {uploadedFile.name} ({uploadedFile.format} · {uploadedFile.count} msgs)
                  <button type="button" onClick={() => setUploadedFile(null)} title="Remove file" aria-label="Remove file"><X size={12} /></button>
                </span>
              </div>
            )}

            <div
              className="textarea-container"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="drop-overlay">
                  <Upload size={24} />
                  <span>Drop your .txt, .json, or .csv conversation file here</span>
                </div>
              )}
              <textarea
                value={conversation}
                onChange={(event) => handleTextareaChange(event.target.value)}
                placeholder={"Paste your conversation here (or drag and drop a .txt, .json, or .csv file)...\n\nExample:\nMaya: We agreed to use React for the prototype.\nRohan: I will prepare the first dashboard draft tonight.\nMaya: Please send the slides by 6 PM today."}
                aria-label="Conversation text"
              />
            </div>

            {error && (
              <div className="status-banner error" role="alert">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            {successNotice && (
              <div className="status-banner success" role="status">
                <CheckCircle2 size={15} />
                <span>{successNotice}</span>
              </div>
            )}

            <div className="input-footer">
              <span>
                {conversation.length.toLocaleString()} characters <span className="dot-separator">·</span> {currentMessageCount} message{currentMessageCount === 1 ? "" : "s"} ({currentLineCount} line{currentLineCount === 1 ? "" : "s"})
              </span>
              <div className="input-actions">
                <button className="button-quiet" type="button" onClick={clearAll} title="Clear text and results">
                  <RotateCcw size={14} /> Clear
                </button>
                <button className="button-quiet" type="button" onClick={() => fileInputRef.current?.click()} title="Upload TXT, JSON, or CSV">
                  <Upload size={14} /> Upload file
                </button>
                <button
                  className="button-quiet"
                  type="button"
                  onClick={() => setShowFormatGuide(!showFormatGuide)}
                  title="View format examples"
                >
                  <FileText size={14} /> {showFormatGuide ? "Hide templates" : "Sample templates"}
                </button>
                <button
                  className="button-primary"
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleRunAnalysis}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={15} className="spinner" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Find what matters <ArrowUpRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {showFormatGuide && (
              <section className="format-guide" aria-label="Supported file formats">
                <div className="format-guide-header" onClick={() => setShowFormatGuide(false)}>
                  <span><Info size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Supported formats (TXT, JSON, CSV)</span>
                  <ChevronUp size={14} />
                </div>
                <div className="format-guide-content">
                  <div className="format-box">
                    <h4><span><FileText size={13} /> Plain text (.txt)</span> <button type="button" onClick={() => loadTemplate("plain")}>Load example</button></h4>
                    <p>Format lines as <code>Speaker: Message</code> or <code>[Timestamp] Speaker: Message</code>.</p>
                  </div>
                  <div className="format-box">
                    <h4><span><FileCode size={13} /> JSON (.json)</span> <button type="button" onClick={() => loadTemplate("json")}>Load example</button></h4>
                    <p>Array of objects with <code>sender</code> and <code>text</code> keys (or wrapped in <code>messages</code>).</p>
                  </div>
                  <div className="format-box">
                    <h4><span><FileSpreadsheet size={13} /> CSV (.csv)</span> <button type="button" onClick={() => loadTemplate("csv")}>Load example</button></h4>
                    <p>CSV with <code>sender</code>, <code>message</code>, and optional <code>timestamp</code> columns.</p>
                  </div>
                </div>
              </section>
            )}
          </section>

          {analysis && analysis.messageCount > 0 ? (
            <>
              <div className="section-title-row">
                <div><div className="eyebrow">THE QUICK READ</div><h2>Your briefing</h2></div>
                <button className="button-quiet" type="button" onClick={resetResults}><RotateCcw size={14} /> Reset results</button>
              </div>

              <section className="summary-card">
                <div className="summary-top">
                  <div className="summary-symbol"><Sparkles size={17} /></div>
                  <span>CONVERSATION OVERVIEW</span>
                  <span className="summary-lines">{analysis.messageCount} messages analyzed</span>
                </div>
                <p>{analysis.summary}</p>
                <div className="summary-note">
                  Facts, deadlines, and decisions are derived strictly from your messages without fabrication. Verify original context below.
                </div>
              </section>

              <div className="stats-grid">
                <StatCard icon={<AlertTriangle size={17} />} label="Priority signals" value={count("urgent")} tone="red" />
                <StatCard icon={<ClipboardList size={17} />} label="Action candidates" value={count("action")} tone="blue" />
                <StatCard icon={<CheckCircle2 size={17} />} label="Decisions" value={count("decision")} tone="green" />
                <StatCard icon={<CircleHelp size={17} />} label="Open questions" value={count("question")} tone="amber" />
              </div>

              <div className="section-title-row findings-heading">
                <div><div className="eyebrow">DON'T LET THESE SLIP</div><h2>Signals worth your attention</h2></div>
                <span className="result-count">{activeFindings.length} found</span>
              </div>

              <div className="filter-row">
                {[
                  ["all", "All signals"], ["urgent", "Priority"], ["action", "Action items"],
                  ["decision", "Decisions"], ["question", "Questions"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`filter-chip ${activeFilter === value ? "selected" : ""}`}
                    onClick={() => setActiveFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="findings-list">
                {filtered.length ? (
                  filtered.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      isCompleted={completedIds.has(finding.id)}
                      onToggleComplete={() => handleToggleComplete(finding.id)}
                      onDismiss={() => handleDismiss(finding.id)}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <Check size={20} />
                    <strong>{activeFilter === "all" ? "No signals found" : "No signals in this category"}</strong>
                    <span>
                      {activeFilter === "all"
                        ? `${analysis.messageCount} messages were scanned, but no explicit deadlines, decisions, or action items were identified.`
                        : "Try selecting another filter chip or inspect the full briefing overview."}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <section className="empty-prompt">
              <div className="empty-art"><MessageSquareText size={25} /><Sparkles size={17} /></div>
              <h2>Your next conversation, decoded.</h2>
              <p>Paste text or upload a conversation file (.txt, .json, .csv) to surface action items, deadlines, decisions, and questions without sending your data to any remote server.</p>
              <button className="button-quiet" type="button" onClick={() => loadTemplate("plain")}>
                Explore with a sample <ArrowUpRight size={14} />
              </button>
            </section>
          )}

          <footer className="footer">
            <span>missed. · Conversation intelligence</span>
            <span><LockKeyhole size={12} /> Local browser processing · Zero remote data transmission</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value.toString().padStart(2, "0")}</strong>
      </div>
    </div>
  );
}

function FindingCard({
  finding,
  isCompleted,
  onToggleComplete,
  onDismiss,
}: {
  finding: Finding;
  isCompleted: boolean;
  onToggleComplete: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className={`finding-card ${isCompleted ? "completed" : ""}`}>
      <button
        type="button"
        className={`finding-check ${isCompleted ? "checked" : ""}`}
        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
        onClick={onToggleComplete}
      >
        {isCompleted && <Check size={13} />}
      </button>

      <div className="finding-content">
        <div className="finding-meta">
          <span className={`category-tag ${finding.category}`}>{labels[finding.category]}</span>
          {finding.priority === "high" && finding.category !== "urgent" && (
            <span className="category-tag urgent">Priority</span>
          )}
          {finding.deadline && (
            <span className="finding-reason">⏰ Due: {finding.deadline.raw}</span>
          )}
          {finding.assignee && (
            <span className="badge-verified">👤 {finding.assignee}</span>
          )}
          {finding.sourceMessage?.speaker && (
            <span className="finding-reason">From {finding.sourceMessage.speaker}</span>
          )}
          <span className="finding-reason">{finding.reason}</span>
        </div>

        <p>{finding.text}</p>

        {/* Verifiable source excerpt box */}
        <div className="source-excerpt">
          <span className="source-label">
            Source message {finding.sourceMessage.lineNumber ? `(Line ${finding.sourceMessage.lineNumber})` : ""}
          </span>
          <blockquote className="source-quote">{finding.sourceMessage.raw}</blockquote>
        </div>
      </div>

      <button
        type="button"
        className="icon-button"
        title="Dismiss signal"
        aria-label="Dismiss signal"
        onClick={onDismiss}
      >
        <X size={15} />
      </button>
    </article>
  );
}

export default App;