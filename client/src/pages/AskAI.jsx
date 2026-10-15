import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";

const SUGGESTED = [
  "What changed between these reports?",
  "Which medications were prescribed at discharge?",
  "What follow-up was documented?",
  "Explain this laboratory result in plain language.",
  "Which findings are uncertain or conflicting?",
  "What do reliable external sources say about this term?",
];

export function AskAI() {
  const [params] = useSearchParams();
  const [conversationId, setConversationId] = useState(
    params.get("conversation") || ""
  );
  const [sourceMode, setSourceMode] = useState("documents");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [scopeIds, setScopeIds] = useState([]);

  useEffect(() => {
    api.listDocuments().then((d) => {
      const ready = (d.documents || []).filter((x) => x.status === "ready");
      setDocuments(ready);
      setScopeIds(ready.map((x) => x.id));
    });
    const t = setInterval(() => {
      api.listDocuments().then((d) => {
        const ready = (d.documents || []).filter((x) => x.status === "ready");
        setDocuments(ready);
        setScopeIds((prev) =>
          prev.length ? prev.filter((id) => ready.some((r) => r.id === id)) : ready.map((x) => x.id)
        );
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const { conversationId: id } = await api.createConversation({
      scope: { documentIds: scopeIds },
      sourceMode,
    });
    setConversationId(id);
    return id;
  }

  async function send(text) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const id = await ensureConversation();
      setMessages((m) => [...m, { role: "user", content: text }]);
      const res = await api.sendMessage(id, text);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.message.content,
          sources: res.message.sources,
          usedWeb: res.message.usedWeb,
        },
      ]);
      setInput("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.get("conversation")) setConversationId(params.get("conversation"));
  }, [params]);

  return (
    <div className="page">
      <h1 className="page__title">Ask AI</h1>
      <p className="page__lede">
        Follow-up questions retrieve document evidence again—not only the prior
        summary.
      </p>

      <div className="panel">
        <h2 className="panel__title">Document scope</h2>
        {!documents.length ? (
          <p>Upload documents and wait until status is <strong>ready</strong>.</p>
        ) : (
          <ul className="select-list">
            {documents.map((d) => (
              <li key={d.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={scopeIds.includes(d.id)}
                    onChange={() =>
                      setScopeIds((prev) =>
                        prev.includes(d.id)
                          ? prev.filter((x) => x !== d.id)
                          : [...prev, d.id]
                      )
                    }
                  />
                  {d.filename}
                </label>
              </li>
            ))}
          </ul>
        )}
        <label>
          Source mode{" "}
          <select value={sourceMode} onChange={(e) => setSourceMode(e.target.value)}>
            <option value="documents">Documents only</option>
            <option value="documents_web">Documents + web</option>
          </select>
        </label>
        <div className="preset-row">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              type="button"
              className="preset-chip"
              onClick={() => send(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="panel chat-panel">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <strong>{m.role === "user" ? "You" : "Assistant"}</strong>
            <p>{m.content}</p>
            {m.sources?.documents?.length > 0 && (
              <p className="chat-sources">
                Document sources:{" "}
                {m.sources.documents
                  .map((s) => `${s.documentName || s.documentId} p.${s.page}`)
                  .join(", ")}
              </p>
            )}
            {m.usedWeb && <p className="chat-sources">Used web context (general)</p>}
          </div>
        ))}
        {error && <div className="alert alert--error">{error}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            className="prompt-textarea"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your records…"
          />
          <button type="submit" className="btn btn--green" disabled={loading}>
            {loading ? "Thinking…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
