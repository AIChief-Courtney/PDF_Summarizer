import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

export function Overview() {
  const [health, setHealth] = useState(null);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetch("/api/health?verifyAi=1")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
    api.listDocuments().then((d) => setDocs(d.documents || [])).catch(() => {});
  }, []);

  const ready = docs.filter((d) => d.status === "ready").length;

  return (
    <div className="page">
      <h1 className="page__title">Overview</h1>
      <p className="page__lede">
        Organize medical documents, configure summarization, review cited
        evidence, and ask follow-up questions—grounded in your records.
      </p>
      <div className="panel">
        <h2 className="panel__title">Workspace status</h2>
        <ul className="stat-list">
          <li>
            <strong>AI summarization:</strong>{" "}
            {!health?.ai
              ? "Unavailable — set OPENAI_API_KEY on server"
              : health.aiVerified === false
                ? health.aiError || "API key rejected by OpenAI"
                : health.aiVerified
                  ? "Available (key verified)"
                  : "Configured (not verified)"}
          </li>
          <li>
            <strong>Web enrichment:</strong>{" "}
            {health?.webSearch ? "Available" : "Not configured (TAVILY_API_KEY)"}
          </li>
          <li>
            <strong>Documents ready:</strong> {ready} / {docs.length}
          </li>
        </ul>
        <div className="action-row" style={{ marginTop: "1rem" }}>
          <Link className="btn btn--green" to="/documents">
            Manage documents
          </Link>
          <Link className="btn btn--orange" to="/summaries/new">
            Create summary
          </Link>
        </div>
      </div>
    </div>
  );
}
