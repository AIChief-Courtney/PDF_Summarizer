import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

const METHODS = [
  { id: "quick", label: "Quick overview" },
  { id: "detailed", label: "Detailed clinical summary" },
  { id: "by_category", label: "Category-by-category" },
  { id: "timeline", label: "Chronological timeline" },
  { id: "discharge", label: "Discharge & follow-up" },
  { id: "meds", label: "Medications & allergies" },
  { id: "labs", label: "Labs & diagnostics" },
  { id: "compare", label: "Compare selected records" },
  { id: "custom", label: "Custom prompt" },
];

export function CreateSummary() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [config, setConfig] = useState({
    method: "detailed",
    audience: "clinical",
    length: "standard",
    format: "narrative",
    sourceMode: "documents",
    customInstructions: "",
    title: "Clinical summary",
  });
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  function loadDocs() {
    api.listDocuments().then((d) => {
      const all = d.documents || [];
      const ready = all.filter((x) => x.status === "ready");
      setDocs(all);
      setSelected((prev) => {
        const readyIds = ready.map((x) => x.id);
        if (!prev.length) return readyIds;
        return prev.filter((id) => readyIds.includes(id));
      });
    });
  }

  useEffect(() => {
    loadDocs();
    const t = setInterval(loadDocs, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      const { job } = await api.getJob(jobId);
      setProgress(job);
      if (job.status === "completed" && job.result?.summaryId) {
        clearInterval(t);
        navigate(`/summaries/${job.result.summaryId}`);
      }
      if (job.status === "failed") {
        clearInterval(t);
        setJobId(null);
        setError(job.error || "Summary job failed.");
      }
    }, 1500);
    return () => clearInterval(t);
  }, [jobId, navigate]);

  async function generate(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.createSummary({
        ...config,
        documentIds: selected,
      });
      if (res.status === "completed" && res.result?.summaryId) {
        navigate(`/summaries/${res.result.summaryId}`);
        return;
      }
      setJobId(res.jobId);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleDoc(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">Create summary</h1>
      <p className="page__lede">
        Select scope, method, output preferences, and optional web enrichment.
      </p>

      <form onSubmit={generate}>
        <div className="panel">
          <h2 className="panel__title">A. Scope</h2>
          <p>Select documents ({selected.length} selected)</p>
          <ul className="select-list">
            {docs.map((d) => {
              const selectable = d.status === "ready";
              return (
                <li key={d.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      disabled={!selectable}
                      onChange={() => toggleDoc(d.id)}
                    />
                    {d.filename} · {d.pageCount ?? "?"} pages ·{" "}
                    <span className={`status-pill status-pill--${d.status}`}>
                      {d.status}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {!docs.length && <p>No documents yet. Upload PDFs on the Documents page.</p>}
          {docs.length > 0 &&
            !docs.some((d) => d.status === "ready") && (
              <p className="alert alert--error">
                Documents are still processing. Ready items will become selectable
                automatically.
              </p>
            )}
        </div>

        <div className="panel">
          <h2 className="panel__title">B. Summary method</h2>
          <div className="preset-row">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`preset-chip${config.method === m.id ? " preset-chip--active" : ""}`}
                onClick={() => setConfig({ ...config, method: m.id })}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel__title">C. Output preferences</h2>
          <div className="form-grid">
            <label>
              Audience
              <select
                value={config.audience}
                onChange={(e) => setConfig({ ...config, audience: e.target.value })}
              >
                <option value="clinical">Clinical</option>
                <option value="patient">Patient-friendly</option>
              </select>
            </label>
            <label>
              Length
              <select
                value={config.length}
                onChange={(e) => setConfig({ ...config, length: e.target.value })}
              >
                <option value="short">Short</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <label>
              Format
              <select
                value={config.format}
                onChange={(e) => setConfig({ ...config, format: e.target.value })}
              >
                <option value="narrative">Narrative</option>
                <option value="bullets">Bullets</option>
                <option value="table">Table</option>
              </select>
            </label>
          </div>
          <label className="prompt-label" htmlFor="custom-instructions">
            Custom instructions
          </label>
          <textarea
            id="custom-instructions"
            className="prompt-textarea"
            rows={5}
            value={config.customInstructions}
            onChange={(e) =>
              setConfig({ ...config, customInstructions: e.target.value })
            }
          />
        </div>

        <div className="panel">
          <h2 className="panel__title">D. Source mode</h2>
          <label>
            <input
              type="radio"
              checked={config.sourceMode === "documents"}
              onChange={() => setConfig({ ...config, sourceMode: "documents" })}
            />{" "}
            Documents only (default)
          </label>
          <label>
            <input
              type="radio"
              checked={config.sourceMode === "documents_web"}
              onChange={() =>
                setConfig({ ...config, sourceMode: "documents_web" })
              }
            />{" "}
            Documents + web context (general medical sources, de-identified queries)
          </label>
        </div>

        <div className="action-row">
          <button
            type="submit"
            className="btn btn--green btn--lg"
            disabled={!selected.length || Boolean(jobId && progress?.status === "running")}
          >
            Generate summary
          </button>
        </div>
        {progress && (
          <p>
            Job {progress.status} · {Math.round((progress.progress || 0) * 100)}%
          </p>
        )}
        {error && <div className="alert alert--error">{error}</div>}
      </form>
    </div>
  );
}
