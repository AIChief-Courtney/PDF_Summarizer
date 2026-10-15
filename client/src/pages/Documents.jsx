import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

export function Documents() {
  const [documents, setDocuments] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState([]);

  const load = useCallback(() => {
    api
      .listDocuments({ q, status })
      .then((d) => setDocuments(d.documents || []))
      .catch((e) => setMessage(e.message));
  }, [q, status]);

  useEffect(() => {
    load();
    api.categories().then((c) => setCategories(c.categories || []));
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function uploadFiles(fileList) {
    if (!fileList?.length) return;
    const fd = new FormData();
    Array.from(fileList)
      .slice(0, 5)
      .forEach((f) => fd.append("files", f));
    try {
      await api.uploadDocuments(fd);
      setMessage("Upload queued for processing.");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function onUpload(e) {
    await uploadFiles(e.target.files);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="page">
      <h1 className="page__title">Documents</h1>
      <p className="page__lede">
        Upload up to five PDFs per batch. Assign categories after upload from
        document details (classification assist coming next iteration).
      </p>

      <div className="panel">
        <h2 className="panel__title">Upload</h2>
        <div
          className="upload-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <p>Drag and drop PDFs here, or choose files (up to 5).</p>
          <input type="file" accept=".pdf,application/pdf" multiple onChange={onUpload} />
        </div>        {message && <p className="alert alert--success">{message}</p>}
      </div>

      <div className="panel">
        <h2 className="panel__title">Library</h2>
        <div className="filters">
          <input
            placeholder="Search filename"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="extracting">Extracting</option>
            <option value="indexing">Indexing</option>
            <option value="ready">Ready</option>
            <option value="needs_review">Needs review</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Pages</th>
              <th>Clinical date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td>{d.filename}</td>
                <td>
                  <span className={`status-pill status-pill--${d.status}`}>
                    {d.status}
                  </span>
                </td>
                <td>{d.pageCount ?? "—"}</td>
                <td>{d.clinicalDate || "—"}</td>
                <td>
                  {(d.status === "failed" || d.status === "needs_review") && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => api.retryDocument(d.id).then(load)}
                    >
                      Retry
                    </button>
                  )}
                  <a className="link-btn" href={api.documentFileUrl(d.id)} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!documents.length && <p>No documents yet.</p>}
        <details style={{ marginTop: "1rem" }}>
          <summary>Category taxonomy reference</summary>
          <ul>
            {categories.map((c) => (
              <li key={c.id}>
                <strong>{c.label}</strong>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
