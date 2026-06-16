import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Plus,
  ArrowUp,
  Square,
  X,
  Brain,
  Target,
  Zap,
  Activity,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import Mermaid from "./shared/Mermaid";
import InteractiveChart from "./shared/InteractiveChart";
import "./Chatbot.css";

// ── Personality mode → subtle pill style ─────────────────────────
const MODE_STYLE = {
  EMPATHETIC: {
    label: "Empathetic",
    color: "#1D9E75",
    bg: "rgba(29,158,117,0.10)",
  },
  STRICT: { label: "Strict", color: "#D85A30", bg: "rgba(216,90,48,0.10)" },
  PEER: { label: "Peer mode", color: "#378ADD", bg: "rgba(55,138,221,0.10)" },
  BALANCED: {
    label: "Socratic",
    color: "#888780",
    bg: "rgba(136,135,128,0.10)",
  },
};

const Chatbot = ({ colors, isDarkMode, messages = [], setMessages }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [limitResetTime, setLimitResetTime] = useState(null);

  // ── NEW: system status state ──────────────────────────────────
  const [personalityMode, setPersonalityMode] = useState(null); // "EMPATHETIC" | "STRICT" | "PEER" | "BALANCED"
  const [toneLabel, setToneLabel] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null); // "operational" | "degraded" | "critical"
  const [msgRemaining, setMsgRemaining] = useState(null); // number

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Poll /health every 15s ────────────────────────────────────
  const fetchHealth = useCallback(async () => {
    try {
      const { data } = await axios.get("http://127.0.0.1:8000/health");
      setSystemHealth(data.status); // "operational" | "degraded" | "critical"
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 15000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  // ── Visual renderer ───────────────────────────────────────────
  const renderMessageText = (text, displayImage, visualData) => {
    if (!text) return null;
    if (visualData?.type === "mermaid")
      return <Mermaid chart={visualData.chart} isDarkMode={isDarkMode} />;
    if (visualData?.type === "plotly")
      return <InteractiveChart data={visualData.data} />;

    const parts = text.split(/\[GENERATE_VISUAL:\s*(.*?)\]/g);
    if (parts.length === 1) return <span>{text}</span>;

    return parts.map((part, i) =>
      i % 2 === 1 ? (
        displayImage ? null : (
          <div
            key={i}
            style={{
              background: isDarkMode
                ? "rgba(124,58,237,0.1)"
                : "rgba(124,58,237,0.05)",
              border: `1px dashed var(--accent)`,
              padding: "18px",
              borderRadius: "14px",
              margin: "14px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              color: "var(--accent)",
              textAlign: "center",
            }}
          >
            <ImageIcon size={32} strokeWidth={1.5} />
            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              Generating Visual...
            </div>
            <div style={{ fontSize: "0.82rem", opacity: 0.75 }}>"{part}"</div>
          </div>
        )
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  // ── Helpers ───────────────────────────────────────────────────
  const toBase64 = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.readAsDataURL(file);
      r.onload = () => res(r.result);
      r.onerror = rej;
    });

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith("image/")) setPreviewUrl(await toBase64(file));
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
    setMessages((prev) => [
      ...prev,
      { sender: "Teacher", text: "--- Inquiry Paused ---" },
    ]);
  };

  const triggerMemorize = async (history) => {
    try {
      await axios.post("http://127.0.0.1:8000/memorize", {
        student_name: "Taha",
        chat_history: history.map(
          (m) =>
            `${m.sender}: ${m.text}${m.extractedData ? "\n[Doc: " + m.extractedData + "]" : ""}`,
        ),
      });
    } catch (e) {
      console.error("[Memory]", e);
    }
  };

  const triggerEvaluation = async (history) => {
    setIsEvaluating(true);
    try {
      await axios.post("http://127.0.0.1:8000/evaluate", {
        student_name: "Taha",
        chat_history: history.map(
          (m) =>
            `${m.sender}: ${m.text}${m.extractedData ? "\n[Doc: " + m.extractedData + "]" : ""}`,
        ),
      });
      await triggerMemorize(history);
      setMessages((prev) => [
        ...prev,
        {
          sender: "System",
          text: "⚡ Mastery Confirmed. Your Cognitive Diagnostic Report has been saved to your Dashboard.",
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRegenerate = () => {
    const last = messages.filter((m) => m.sender === "Student").at(-1);
    if (!last) return;
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i--)
        if (["Teacher", "Specialist", "Supervisor"].includes(prev[i].sender))
          return prev.slice(0, i);
      return prev;
    });
    handleSend(last.text);
  };

  const handleSend = async (customInput = null) => {
    const text = customInput ?? input;
    if (!text.trim() && !selectedFile) return;

    abortControllerRef.current = new AbortController();
    setMessages((prev) => [
      ...prev,
      {
        sender: "Student",
        text,
        file: selectedFile?.name,
        displayImage: previewUrl,
      },
    ]);
    setInput("");
    setLoading(true);
    setPreviewUrl(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const fd = new FormData();
    fd.append("user_input", text);
    fd.append("student_name", "Taha");
    fd.append("user_id", "Taha"); // ← NEW: pass user_id for rate limiting
    fd.append(
      "chat_history",
      JSON.stringify(
        messages.map(
          (m) =>
            `${m.sender}: ${m.text}${m.extractedData ? "\n[Doc: " + m.extractedData + "]" : ""}`,
        ),
      ),
    );
    if (selectedFile) fd.append("file", selectedFile);

    try {
      const {
        data: { task_id },
      } = await axios.post("http://127.0.0.1:8000/chat", fd, {
        signal: abortControllerRef.current.signal,
      });

      const poll = async () => {
        if (abortControllerRef.current?.signal.aborted) {
          setLoading(false);
          return;
        }
        try {
          const { data } = await axios.get(
            `http://127.0.0.1:8000/chat/status/${task_id}`,
          );
          if (data.status === "complete") {
            const r = data.result;

            // ── NEW: read personality + rate limit from response ──
            if (r.personality_mode) setPersonalityMode(r.personality_mode);
            if (r.tone_label) setToneLabel(r.tone_label);
            if (r.limited) setLimitResetTime(r.reset_in);

            const msg = {
              sender: r.sender,
              text: r.message,
              thought: r.thought,
              empatheticValidation: r.empathetic_validation,
              uiPayload: r.ui_payload,
              displayImage: r.displayImage,
              visualData: r.visual_data,
              // ── NEW: store personality per-message for header pill ──
              personalityMode: r.personality_mode,
              toneLabel: r.tone_label,
            };
            let evalHistory = [];
            setMessages((prev) => {
              const next = [...prev];
              if (next.at(-1)?.sender === "Student" && r.extracted_text)
                next[next.length - 1] = {
                  ...next.at(-1),
                  extractedData: r.extracted_text,
                };
              evalHistory = [...next, msg];
              return evalHistory;
            });
            if (r.state === "CONFIRMED_MASTERED")
              triggerEvaluation(evalHistory);
            setSelectedFile(null);
            setLoading(false);
            abortControllerRef.current = null;
          } else if (data.status === "error" || data.status === "FAILURE") {
            setMessages((prev) => [
              ...prev,
              { sender: "Teacher", text: "Task processing failed." },
            ]);
            setLoading(false);
            setSelectedFile(null);
            abortControllerRef.current = null;
          } else {
            setTimeout(poll, 1500);
          }
        } catch (e) {
          console.error("Poll error", e);
          setLoading(false);
        }
      };
      poll();
    } catch (err) {
      if (err.response?.status === 429) {
        // ── NEW: use reset_in from backend, fallback to retry_after ──
        const resetIn =
          err.response.data.reset_in ?? err.response.data.retry_after ?? 3600;
        setLimitResetTime(resetIn);
      } else if (!axios.isCancel(err))
        setMessages((prev) => [
          ...prev,
          { sender: "Teacher", text: "Connection failed." },
        ]);
      setSelectedFile(null);
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // ── Health dot color ──────────────────────────────────────────
  const healthDot =
    {
      operational: "#1D9E75",
      degraded: "#EF9F27",
      critical: "#E24B4A",
    }[systemHealth] ?? "transparent";

  const suggestions = [
    {
      label: "Explain Neural Networks",
      detail: "Understand the basics of AI architecture",
    },
    {
      label: "Aegis Flood Prediction",
      detail: "How the disaster assistance system works",
    },
    {
      label: "Socratic Inquiry",
      detail: "Learn the method of synthesis through questioning",
    },
    {
      label: "UI/UX Principles",
      detail: "Review design patterns for software engineering",
    },
  ];

  return (
    <>
      {/* ── CHAT AREA ────────────────────────────────────── */}

      <div className="chat-scroller">
        <div className="chat-max-width">/
          {messages.length === 0 ? (
            /* Empty state */
            <div className="empty-state">
              <Brain
                size={50}
                strokeWidth={1.5}
                style={{ opacity: 0.7, color: "var(--text)" }}
              />
              <h1
                style={{
                  fontFamily: "Bricolage Grotesque",
                  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                  letterSpacing: "-1px",
                  margin: "14px 0 0",
                  color: "var(--text)",
                }}
              >
                Synthesis through Inquiry.
              </h1>
              <div className="suggestion-grid">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="suggestion-card"
                    onClick={() => handleSend(s.label)}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        marginBottom: 6,
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: "0.82rem", opacity: 0.5 }}>
                      {s.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`msg-container ${m.sender.toLowerCase()}`}
                >
                  {(m.sender === "Teacher" || m.sender === "Specialist") && (
                    <div className="ai-header">
                      {/* Brain icon + label */}
                      <Brain size={15} strokeWidth={2.5} />
                      {m.sender === "Specialist"
                        ? "FEHM.AI — SPECIALIST"
                        : "FEHM.AI"}

                      {/* ── NEW: health dot (only on latest message) ── */}
                      {i === messages.length - 1 && systemHealth && (
                        <span
                          title={`System ${systemHealth}`}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: healthDot,
                            display: "inline-block",
                            marginLeft: 2,
                          }}
                        />
                      )}

                      {/* ── NEW: personality mode pill (per-message) ── */}
                      {m.personalityMode &&
                        m.personalityMode !== "BALANCED" &&
                        (() => {
                          const ms =
                            MODE_STYLE[m.personalityMode] ||
                            MODE_STYLE.BALANCED;
                          return (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                padding: "2px 7px",
                                borderRadius: 10,
                                background: ms.bg,
                                color: ms.color,
                                letterSpacing: "0.02em",
                                marginLeft: 4,
                              }}
                            >
                              {m.toneLabel || ms.label}
                            </span>
                          );
                        })()}
                    </div>
                  )}

                  {m.sender === "Supervisor" && (
                    <div className="ai-header" style={{ color: "#F59E0B" }}>
                      <Zap size={15} strokeWidth={2.5} /> FEHM.AI — GUIDANCE
                    </div>
                  )}

                  <div className="bubble">
                    {m.displayImage && (
                      <img
                        src={m.displayImage}
                        alt="Visual"
                        style={{
                          maxWidth: "100%",
                          borderRadius: "10px",
                          marginBottom: 10,
                          display: "block",
                          border: "1px solid var(--border)",
                        }}
                      />
                    )}
                    {m.file && !m.displayImage && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          background: isDarkMode
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.04)",
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          marginBottom: m.text ? 10 : 0,
                          width: "fit-content",
                          color: "var(--text)",
                        }}
                      >
                        <FileText size={15} strokeWidth={2} color="#3B82F6" />{" "}
                        {m.file}
                      </div>
                    )}
                    {m.thought && (
                      <div className="thought-box">
                        <div className="thought-label">
                          <Brain size={11} strokeWidth={2.5} /> Internal
                          Strategy
                        </div>
                        {typeof m.thought === "object"
                          ? `Mode: ${m.thought.mode || "—"} | Stage: ${m.thought.socratic_stage || "—"} | Emotion: ${m.thought.student_emotional_state || "—"} | ZPD: ${m.thought.zpd_estimate || "—"}`
                          : m.thought}
                      </div>
                    )}
                    {m.empatheticValidation && (
                      <div className="empathy-box">
                        <div className="empathy-label">
                          <Activity size={11} strokeWidth={3} /> Emotional
                          Validation
                        </div>
                        {m.empatheticValidation}
                      </div>
                    )}
                    {renderMessageText(m.text, m.displayImage, m.visualData)}
                    {m.uiPayload && (
                      <>
                        {m.uiPayload.parallel_sandbox_problem && (
                          <div className="sandbox-box">
                            <div className="sandbox-header">
                              <Target size={14} strokeWidth={2.5} /> Parallel
                              Sandbox Protocol
                            </div>
                            {m.uiPayload.parallel_sandbox_problem}
                          </div>
                        )}
                        <div className="ui-badge-container">
                          {m.uiPayload.requires_diagram && (
                            <div className="ui-badge">
                              <ImageIcon size={11} /> Diagram Triggered
                            </div>
                          )}
                          {m.uiPayload.requires_code_editor && (
                            <div className="ui-badge">
                              <Square size={11} /> Code Sandbox Required
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {(m.sender === "Teacher" || m.sender === "Specialist") &&
                    i === messages.length - 1 && (
                      <button
                        className="regenerate-btn"
                        onClick={handleRegenerate}
                      >
                        <Activity size={11} strokeWidth={2} /> Regenerate
                        Response
                      </button>
                    )}
                </div>
              ))}

              {loading && (
                <div>
                  <div className="ai-header">
                    <Brain size={15} strokeWidth={2.5} /> FEHM.AI
                  </div>
                  <div className="thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
              {isEvaluating && (
                <div
                  style={{
                    alignSelf: "center",
                    opacity: 0.4,
                    fontSize: "0.8rem",
                    fontStyle: "italic",
                    color: "#3B82F6",
                  }}
                >
                  Generating Cognitive Report...
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── INPUT AREA ───────────────────────────────────── */}
      <div className="input-anchor">
        {selectedFile && (
          <div className="file-preview-chip">
            {previewUrl ? (
              <img src={previewUrl} className="preview-thumb" alt="thumb" />
            ) : (
              <FileText size={15} strokeWidth={2} color="#3B82F6" />
            )}
            <span style={{ fontWeight: 600 }}>
              {selectedFile.name.substring(0, 18)}…
            </span>
            <div
              className="cancel-btn"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
            >
              <X size={13} strokeWidth={3} />
            </div>
          </div>
        )}

        <div className="input-box">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            className="attach-btn"
            onClick={() => fileInputRef.current.click()}
          >
            <Plus size={22} strokeWidth={2} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 180) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
                if (textareaRef.current)
                  textareaRef.current.style.height = "auto";
              }
            }}
            placeholder="Upload a document or ask a question…"
          />
          {loading || isEvaluating ? (
            <button className="action-btn stop-btn" onClick={handleStop}>
              <Square size={20} fill="currentColor" color="currentColor" />
            </button>
          ) : (
            <button
              className="action-btn send-btn"
              onClick={() => handleSend()}
            >
              <ArrowUp size={24} strokeWidth={2.5} color="currentColor" />
            </button>
          )}
        </div>

        {/* ── NEW: subtle status bar under input ───────────── */}
        {(personalityMode ||
          systemHealth === "degraded" ||
          systemHealth === "critical") && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 4px 0",
              fontSize: "0.72rem",
              color: "var(--text)",
              opacity: 0.45,
            }}
          >
            {/* Personality pill — only show non-balanced */}
            {personalityMode &&
              personalityMode !== "BALANCED" &&
              (() => {
                const ms = MODE_STYLE[personalityMode] || MODE_STYLE.BALANCED;
                return (
                  <span
                    style={{
                      padding: "1px 7px",
                      borderRadius: 8,
                      background: ms.bg,
                      color: ms.color,
                      opacity: 1,
                      fontWeight: 600,
                      fontSize: "0.70rem",
                    }}
                  >
                    {toneLabel || ms.label}
                  </span>
                );
              })()}

            {/* System degraded warning */}
            {(systemHealth === "degraded" || systemHealth === "critical") && (
              <span
                style={{
                  color: systemHealth === "critical" ? "#E24B4A" : "#EF9F27",
                  opacity: 1,
                }}
              >
                {systemHealth === "critical"
                  ? "⚠ All nodes offline"
                  : "⚠ Routing to backup model"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── RATE LIMIT MODAL ─────────────────────────────── */}
      {limitResetTime !== null && (
        <div
          className="rate-limit-overlay"
          onClick={() => setLimitResetTime(null)}
        >
          <div
            className="rate-limit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle size={44} color="var(--warning)" />
            <h2
              style={{
                fontFamily: "Bricolage Grotesque",
                fontSize: "1.35rem",
                margin: "14px 0 6px",
              }}
            >
              Daily Limit Reached
            </h2>
            <p style={{ opacity: 0.65, fontSize: "0.9rem" }}>
              To keep FEHM.AI sustainable, we limit daily Socratic inquiries.
            </p>
            {/* ── NEW: show h m format properly from seconds ── */}
            <div className="rate-limit-timer">
              {limitResetTime >= 3600
                ? `${Math.floor(limitResetTime / 3600)}h ${Math.floor((limitResetTime % 3600) / 60)}m`
                : limitResetTime >= 60
                  ? `${Math.floor(limitResetTime / 60)}m ${limitResetTime % 60}s`
                  : `${limitResetTime}s`}
            </div>
            <p style={{ opacity: 0.5, fontSize: "0.8rem" }}>
              until your limit resets
            </p>
            <button
              className="rate-limit-btn"
              onClick={() => setLimitResetTime(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
