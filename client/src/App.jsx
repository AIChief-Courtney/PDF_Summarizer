import { useRef, useState } from "react";
import "./App.css";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_MB = 5;

const LIMITS = [
  { label: "Max size", value: `${MAX_MB} MB` },
  { label: "Pages", value: "20" },
  { label: "Text", value: "30k chars" },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function PdfIcon() {
  return (
    <svg
      className="icon-pdf"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 4h14l12 12v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M28 4v12h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 28h16M16 34h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [summary, setSummary] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const isLoading = status.type === "loading";

  function resetForNewFile(selected) {
    setFile(selected);
    setSummary("");
    setStatus({ type: "idle", message: "" });
  }

  function validateClientFile(selected) {
    if (!selected) return "Please select a PDF file.";
    const name = selected.name.toLowerCase();
    const type = selected.type;
    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    if (!isPdf) {
      return "Please upload a valid PDF file.";
    }
    if (selected.size > MAX_BYTES) {
      return `This file exceeds the ${MAX_MB} MB size limit. Please choose a smaller PDF.`;
    }
    return null;
  }

  function applyFile(selected) {
    if (!selected) {
      resetForNewFile(null);
      return;
    }
    const clientError = validateClientFile(selected);
    if (clientError) {
      resetForNewFile(null);
      setStatus({ type: "error", message: clientError });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    resetForNewFile(selected);
  }

  function onFileChange(event) {
    applyFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    if (isLoading) return;
    applyFile(event.dataTransfer.files?.[0] ?? null);
  }

  function onDragOver(event) {
    event.preventDefault();
    if (!isLoading) setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  function openFilePicker() {
    if (!isLoading) inputRef.current?.click();
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!file || isLoading) return;

    const clientError = validateClientFile(file);
    if (clientError) {
      setStatus({ type: "error", message: clientError });
      return;
    }

    setSummary("");
    setStatus({ type: "loading", message: "Analyzing document and generating summary…" });

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.error?.message || "Summarization failed. Please try again.";
        setStatus({ type: "error", message });
        return;
      }

      setSummary(data.summary || "");
      setStatus({ type: "success", message: "Summary generated successfully." });
    } catch {
      setStatus({
        type: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }

  const showEmptySummary = !summary && !isLoading && status.type !== "loading";

  return (
    <div className="app">
      <div className="app__backdrop" aria-hidden="true">
        <div className="app__orb app__orb--1" />
        <div className="app__orb app__orb--2" />
        <div className="app__grid" />
      </div>

      <div className="app__shell">
        <header className="hero">
          <div className="hero__badge">AI-powered document brief</div>
          <h1 className="hero__title">PDF Summarizer</h1>
          <p className="hero__subtitle">
            Upload a text-based English PDF and receive a concise, accurate
            summary in seconds—validated on the server before it reaches the
            model.
          </p>
        </header>

        <div className="workspace">
          <section className="panel panel--upload" aria-labelledby="upload-heading">
            <div className="panel__head">
              <h2 id="upload-heading" className="panel__title">
                Upload document
              </h2>
              <p className="panel__desc" id="pdf-hint">
                One PDF per request · selectable text only · no OCR
              </p>
            </div>

            <form className="upload-form" onSubmit={onSubmit} noValidate>
              <div
                className={`dropzone${dragOver ? " dropzone--active" : ""}${file ? " dropzone--has-file" : ""}`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={openFilePicker}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFilePicker();
                  }
                }}
                role="button"
                tabIndex={isLoading ? -1 : 0}
                aria-disabled={isLoading}
                aria-describedby="pdf-hint"
              >
                <input
                  ref={inputRef}
                  id="pdf-input"
                  className="dropzone__input"
                  name="pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onFileChange}
                  disabled={isLoading}
                  tabIndex={-1}
                />
                {file ? (
                  <div className="file-card">
                    <PdfIcon />
                    <div className="file-card__meta">
                      <span className="file-card__name">{file.name}</span>
                      <span className="file-card__size">{formatBytes(file.size)}</span>
                    </div>
                    <span className="file-card__action">Change file</span>
                  </div>
                ) : (
                  <>
                    <div className="dropzone__icon-wrap">
                      <PdfIcon />
                    </div>
                    <p className="dropzone__prompt">
                      <strong>Choose a PDF</strong> or drag and drop here
                    </p>
                    <p className="dropzone__sub">Application/pdf · up to {MAX_MB} MB</p>
                  </>
                )}
              </div>

              <ul className="limits" aria-label="Document limits">
                {LIMITS.map((item) => (
                  <li key={item.label} className="limits__item">
                    <span className="limits__label">{item.label}</span>
                    <span className="limits__value">{item.value}</span>
                  </li>
                ))}
              </ul>

              <button
                type="submit"
                className="btn-primary"
                disabled={!file || isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Processing…
                  </>
                ) : (
                  "Generate summary"
                )}
              </button>
            </form>

            <section className="status" aria-live="polite">
              {status.type === "error" && (
                <div className="alert alert--error" role="alert">
                  <span className="alert__dot" aria-hidden="true" />
                  {status.message}
                </div>
              )}
              {status.type === "success" && !isLoading && (
                <div className="alert alert--success">
                  <span className="alert__dot" aria-hidden="true" />
                  {status.message}
                </div>
              )}
            </section>
          </section>

          <section
            className="panel panel--result"
            aria-labelledby="summary-heading"
          >
            <div className="panel__head">
              <h2 id="summary-heading" className="panel__title">
                Summary
              </h2>
              <p className="panel__desc">~100–150 words when the source is long enough</p>
            </div>

            <div className="result-body">
              {isLoading && (
                <div className="result-loading" role="status">
                  <div className="result-loading__bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>{status.message}</p>
                </div>
              )}

              {!isLoading && summary && (
                <article className="summary-card">
                  <div className="summary-card__label">Generated brief</div>
                  <div className="summary-text">{summary}</div>
                </article>
              )}

              {showEmptySummary && (
                <div className="result-empty">
                  <div className="result-empty__lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>Your summary will appear here after you upload a PDF and generate.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="footer">
          <span>Server-side validation · API key never exposed to the browser</span>
        </footer>
      </div>
    </div>
  );
}
