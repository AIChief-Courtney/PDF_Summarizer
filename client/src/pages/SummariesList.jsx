import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

export function SummariesList() {
  const [summaries, setSummaries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listSummaries()
      .then((s) => setSummaries(s.summaries || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <h1 className="page__title">Summaries</h1>
      <p className="page__lede">
        Review generated summaries with citations, coverage notes, and follow-up
        questions.
      </p>
      <div className="action-row">
        <Link className="btn btn--green" to="/summaries/new">
          Create summary
        </Link>
      </div>
      {error && <div className="alert alert--error">{error}</div>}
      <div className="panel">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td>
                  <span className={`status-pill status-pill--${s.status}`}>
                    {s.status}
                  </span>
                </td>
                <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                <td>
                  <Link className="link-btn" to={`/summaries/${s.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!summaries.length && !error && <p>No summaries yet.</p>}
      </div>
    </div>
  );
}
