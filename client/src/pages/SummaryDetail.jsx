import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useEvidence } from "../state/EvidenceContext.jsx";

const FOLLOW_UP = [
  "What changed between these reports?",
  "Which medications were prescribed at discharge?",
  "What follow-up was documented?",
];

function CitationButton({ cite, docName, onOpen }) {
  return (
    <button
      type="button"
      className="cite-btn"
      onClick={() =>
        onOpen({
          documentId: cite.documentId,
          documentName: docName,
          page: cite.page,
          quote: cite.quote,
          highlightAvailable: false,
        })
      }
    >
      [{docName || cite.documentId} p.{cite.page}]
    </button>
  );
}

export function SummaryDetail() {
  const { id } = useParams();
  const { openEvidence } = useEvidence();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    api
      .getSummary(id)
      .then((s) => setSummary(s.summary))
      .catch((e) => setError(e.message));
  }, [id]);

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const scope = {
      documentIds: summary?.output?.scope?.documentIds || [],
    };
    const { conversationId: cid } = await api.createConversation({
      summaryId: id,
      scope,
      sourceMode: summary?.config?.sourceMode || "documents",
    });
    setConversationId(cid);
    return cid;
  }

  async function sendFollowUp(text) {
    if (!text.trim()) return;
    setChatLoading(true);
    try {
      const cid = await ensureConversation();
      setChatMessages((m) => [...m, { role: "user", content: text }]);
      const res = await api.sendMessage(cid, text);
      setChatMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.message.content,
          structured: res.message.structured,
          usedWeb: res.message.usedWeb,
        },
      ]);
      setChatInput("");
    } catch (e) {
      setError(e.message);
    } finally {
      setChatLoading(false);
    }
  }

  function copySummary() {
    const text = (summary?.output?.sections || [])
      .map((s) => `${s.heading}\n${s.body}`)
      .join("\n\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  if (error) return <div className="page alert alert--error">{error}</div>;
  if (!summary) return <div className="page">Loading summary…</div>;

  const output = summary.output;
  const nameById = Object.fromEntries(
    (output?.documents || []).map((d) => [d.id, d.filename])
  );

  return (
    <div className="page">
      <h1 className="page__title">{summary.title}</h1>
      <p className="page__lede">
        Generated {output?.generatedAt ? new Date(output.generatedAt).toLocaleString() : ""}
      </p>

      <div className="panel">
        <h2 className="panel__title">Scope & coverage</h2>
        <p>
          Documents included: {(output?.coverage?.documentsIncluded || []).length}
        </p>
        {(output?.coverage?.limitations || []).map((l) => (
          <p key={l} className="alert alert--error">
            {l}
          </p>
        ))}
        {(output?.coverage?.documentsMissing || []).length > 0 && (
          <p>Missing/unready: {output.coverage.documentsMissing.join(", ")}</p>
        )}
      </div>

      {(output?.sections || []).map((section) => (
        <div className="panel" key={section.heading}>
          <h2 className="panel__title">{section.heading}</h2>
          <div className="summary-text">{section.body}</div>
          <div className="cite-row">
            {(section.citations || []).map((c, i) => (
              <CitationButton
                key={`${c.documentId}-${c.page}-${i}`}
                cite={c}
                docName={nameById[c.documentId]}
                onOpen={openEvidence}
              />
            ))}
          </div>
        </div>
      ))}

      {output?.webContext && (
        <div className="panel web-section">
          <h2 className="panel__title">{output.webContext.heading}</h2>
          <p>{output.webContext.body}</p>
          <ul>
            {(output.webContext.sources || []).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title} ({s.publisher})
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(output?.ambiguities?.length > 0 || output?.pendingItems?.length > 0) && (
        <div className="panel">
          <h2 className="panel__title">Ambiguities & pending items</h2>
          <ul>
            {output.ambiguities?.map((a) => (
              <li key={a}>{a}</li>
            ))}
            {output.pendingItems?.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="action-row">
        <button type="button" className="btn btn--green" onClick={copySummary}>
          Copy summary
        </button>
        <Link className="btn btn--orange" to="/summaries/new">
          Regenerate
        </Link>
        {conversationId && (
          <Link className="btn btn--orange" to={`/ask?conversation=${conversationId}`}>
            Open in Ask AI
          </Link>
        )}
      </div>

      <div className="panel chat-panel">
        <h2 className="panel__title">Follow-up questions</h2>
        <p className="page__lede">
          Answers re-query your documents; the summary alone is not treated as
          the source of truth.
        </p>
        <div className="preset-row">
          {FOLLOW_UP.map((q) => (
            <button
              key={q}
              type="button"
              className="preset-chip"
              disabled={chatLoading}
              onClick={() => sendFollowUp(q)}
            >
              {q}
            </button>
          ))}
        </div>
        {chatMessages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <strong>{m.role === "user" ? "You" : "Assistant"}</strong>
            {m.structured ? (
              <>
                <p>
                  <em>What your documents say</em>
                </p>
                <p>{m.structured.documentFindings}</p>
                {m.structured.webContext && (
                  <>
                    <p>
                      <em>General medical context (web)</em>
                    </p>
                    <p>{m.structured.webContext}</p>
                  </>
                )}
                {m.structured.missingOrUncertain && (
                  <>
                    <p>
                      <em>Missing or uncertain</em>
                    </p>
                    <p>{m.structured.missingOrUncertain}</p>
                  </>
                )}
              </>
            ) : (
              <p>{m.content}</p>
            )}
            {m.usedWeb && (
              <p className="chat-sources">Source mode: documents + web</p>
            )}
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendFollowUp(chatInput);
          }}
        >
          <textarea
            className="prompt-textarea"
            rows={3}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about this summary or a cited finding…"
          />
          <button type="submit" className="btn btn--green" disabled={chatLoading}>
            {chatLoading ? "Thinking…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
