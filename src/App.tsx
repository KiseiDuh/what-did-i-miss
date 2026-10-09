import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown,
  CircleHelp, ClipboardList, FileText, LockKeyhole, MessageSquareText,
  RotateCcw, ShieldCheck, Sparkles, Upload, X
} from "lucide-react";
import { analyzeConversation, type Finding } from "./analyzer";

const sampleConversation = `Maya: We agreed to use React and TypeScript for the prototype.
Rohan: I will prepare the first dashboard draft tonight.
Maya: The demo is tomorrow, so please send the slides by 6 PM today.
Aarav: Can someone confirm whether the sample data is ready?
Rohan: Decision: we'll keep the first version local-only and won't connect external APIs.
Maya: Don't forget to review the mobile layout before the demo.
Aarav: Should we add CSV import after the first demo?`;

const labels: Record<Finding["category"], string> = {
  urgent: "Priority",
  action: "Action item",
  decision: "Decision",
  question: "Open question",
};

function App() {
  const [conversation, setConversation] = useState("");
  const [analyzedText, setAnalyzedText] = useState("");
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const analysis = useMemo(
    () => analyzedText ? analyzeConversation(analyzedText) : null,
    [analyzedText],
  );
  const findings = analysis?.findings ?? [];
  const filtered = activeFilter === "all"
    ? findings
    : findings.filter((finding) => finding.category === activeFilter);

  function runAnalysis() {
    if (!conversation.trim()) {
      setError("Paste a conversation first, or try the sample.");
      setAnalyzedText("");
      return;
    }
    setError("");
    setAnalyzedText(conversation);
    setActiveFilter("all");
  }

  function loadSample() {
    setConversation(sampleConversation);
    setAnalyzedText("");
    setError("");
  }

  function clearAll() {
    setConversation("");
    setAnalyzedText("");
    setError("");
    setActiveFilter("all");
  }

  const count = (category: Finding["category"]) =>
    findings.filter((item) => item.category === category).length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div><strong>missed.</strong><span>conversation briefing</span></div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <button className="side-link active"><MessageSquareText size={17} /> Catch me up</button>
        <button className="side-link" onClick={loadSample}><FileText size={17} /> Sample conversation</button>
        <div className="sidebar-bottom">
          <div className="privacy-icon"><ShieldCheck size={18} /></div>
          <strong>Privacy first</strong>
          <p>Conversation analysis runs locally in this prototype. Your pasted text is not sent to an AI API.</p>
          <span className="local-pill"><span /> LOCAL PROCESSING</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Catch me up</strong></div>
          <div className="top-status"><span className="status-dot" /> Local mode <ChevronDown size={14} /></div>
        </header>

        <div className="content">
          <div className="hero">
            <div className="eyebrow"><Activity size={14} /> YOUR CONVERSATION BRIEFING</div>
            <h1>What did I <em>miss?</em></h1>
            <p>Skip the scroll. Get the signal. Find what matters in your conversations.</p>
          </div>

          <section className="input-card">
            <div className="card-heading">
              <div className="heading-icon"><MessageSquareText size={18} /></div>
              <div><h2>Drop in your conversation</h2><p>Paste a chat, meeting notes, or a long message thread.</p></div>
              <span className="private-tag"><LockKeyhole size={12} /> Private by design</span>
            </div>
            <textarea
              value={conversation}
              onChange={(event) => setConversation(event.target.value)}
              placeholder={"Paste your conversation here...\n\nExample:\nTeam: The presentation is due tomorrow.\nSam: I'll finish the slides tonight."}
              aria-label="Conversation text"
            />
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className="input-footer">
              <span>{conversation.length.toLocaleString()} characters <span className="dot-separator">·</span> {conversation.split(/\r?\n/).filter((line) => line.trim()).length} lines</span>
              <div className="input-actions">
                <button className="button-quiet" onClick={loadSample}><Upload size={15} /> Try sample</button>
                <button className="button-primary" onClick={runAnalysis}><Sparkles size={16} /> Find what matters <ArrowUpRight size={15} /></button>
              </div>
            </div>
          </section>

          {analysis ? (
            <>
              <div className="section-title-row">
                <div><div className="eyebrow">THE QUICK READ</div><h2>Your briefing</h2></div>
                <button className="button-quiet" onClick={() => { setAnalyzedText(""); setError(""); }}><RotateCcw size={14} /> Reset results</button>
              </div>
              <section className="summary-card">
                <div className="summary-top"><div className="summary-symbol"><Sparkles size={17} /></div><span>CONVERSATION OVERVIEW</span><span className="summary-lines">{analysis.messageCount} lines scanned</span></div>
                <p>{analysis.summary}</p>
                <div className="summary-note">Prototype analysis uses simple local rules. Verify important details in the original conversation.</div>
              </section>

              <div className="stats-grid">
                <StatCard icon={<AlertTriangle size={17} />} label="Priority signals" value={count("urgent")} tone="red" />
                <StatCard icon={<ClipboardList size={17} />} label="Action candidates" value={count("action")} tone="blue" />
                <StatCard icon={<CheckCircle2 size={17} />} label="Decisions" value={count("decision")} tone="green" />
                <StatCard icon={<CircleHelp size={17} />} label="Open questions" value={count("question")} tone="amber" />
              </div>

              <div className="section-title-row findings-heading">
                <div><div className="eyebrow">DON'T LET THESE SLIP</div><h2>Signals worth your attention</h2></div>
                <span className="result-count">{findings.length} found</span>
              </div>
              <div className="filter-row">
                {[
                  ["all", "All signals"], ["urgent", "Priority"], ["action", "Action items"],
                  ["decision", "Decisions"], ["question", "Questions"],
                ].map(([value, label]) => (
                  <button key={value} className={`filter-chip ${activeFilter === value ? "selected" : ""}`} onClick={() => setActiveFilter(value)}>{label}</button>
                ))}
              </div>
              <div className="findings-list">
                {filtered.length ? filtered.map((finding) => <FindingCard key={finding.id} finding={finding} />) : (
                  <div className="empty-state"><Check size={20} /><strong>No signals in this category</strong><span>Try another filter or analyze a different conversation.</span></div>
                )}
              </div>
            </>
          ) : (
            <section className="empty-prompt">
              <div className="empty-art"><MessageSquareText size={25} /><Sparkles size={17} /></div>
              <h2>Your next conversation, decoded.</h2>
              <p>We’ll surface deadlines, decisions, follow-ups, and questions so you can focus on what matters.</p>
              <button className="button-quiet" onClick={loadSample}>Explore with a sample <ArrowUpRight size={14} /></button>
            </section>
          )}

          <footer className="footer"><span>missed. · Conversation intelligence</span><span><LockKeyhole size={12} /> Your text stays in this browser</span></footer>
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value.toString().padStart(2, "0")}</strong></div></div>;
}

function FindingCard({ finding }: { finding: Finding }) {
  const [done, setDone] = useState(false);
  return (
    <article className={`finding-card ${done ? "completed" : ""}`}>
      <button className={`finding-check ${done ? "checked" : ""}`} aria-label={done ? "Mark incomplete" : "Mark complete"} onClick={() => setDone(!done)}>{done && <Check size={13} />}</button>
      <div className="finding-content"><div className="finding-meta"><span className={`category-tag ${finding.category}`}>{labels[finding.category]}</span><span className="finding-reason">{finding.reason}</span></div><p>{finding.text}</p></div>
      <button className="icon-button" title="Dismiss signal" onClick={(event) => event.currentTarget.closest("article")?.remove()}><X size={15} /></button>
    </article>
  );
}

export default App;