import { useRef, useState } from "react";
import { LIMITS } from "./lib/constants.js";
import {
  buildCombinedDocumentText,
  extractPdfFromFile,
  PdfUserError,
} from "./lib/pdfExtract.js";
import {
  DEFAULT_PRESET_ID,
  PROMPT_PRESETS,
  summarizeDocumentText,
} from "./lib/summarize.js";
import "./App.css";

const MAX_MB = LIMITS.maxFileBytes / (1024 * 1024);

function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCount(value) {
  if (value == null) return "—";
  return value.toLocaleString();
}

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function ClinicalDocIcon() {
  return (
    <svg className="icon-clinical" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M12 6h16l8 8v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28 6v8h8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M24 22v8M20 26h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const inputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [summary, setSummary] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET_ID);
  const [customPrompt, setCustomPrompt] = useState(
    () => PROMPT_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)?.instruction ?? ""
  );

  const isLoading = status.type === "loading";
  const busy = isLoading || analyzing;

  const okDocs = documents.filter((d) => d.status === "ok");
  const totalBytes = okDocs.reduce((n, d) => n + d.fileBytes, 0);
  const totalPages = okDocs.reduce((n, d) => n + d.pageCount, 0);
  const totalChars = okDocs.reduce((n, d) => n + d.charCount, 0);
  const combinedOver = totalChars > LIMITS.maxCombinedExtractedChars;

  const docReady =
    okDocs.length > 0 &&
    !analyzing &&
    !combinedOver &&
    documents.every((d) => d.status === "ok");

  const limitRows = [
    {
      key: "docs",
      label: "Documents",
      current: documents.length ? String(okDocs.length) : "—",
      max: `${LIMITS.maxFiles} max`,
      over: documents.length > LIMITS.maxFiles,
      ok: okDocs.length > 0 && okDocs.length <= LIMITS.maxFiles,
    },
    {
      key: "pages",
      label: "Total pages",
      current: okDocs.length ? formatCount(totalPages) : analyzing ? "…" : "—",
      max: `${LIMITS.maxPages}/file`,
      over: false,
      ok: okDocs.length > 0,
    },
    {
      key: "text",
      label: "Combined text",
      current:
        okDocs.length
          ? `${formatCount(totalChars)} chars`
          : analyzing
            ? "…"
            : "—",
      max: `${formatCount(LIMITS.maxCombinedExtractedChars)} max`,
      over: combinedOver,
      ok: okDocs.length > 0 && !combinedOver,
    },
  ];

  function resetAll() {
    setDocuments([]);
    setAnalyzing(false);
    setSummary("");
    setStatus({ type: "idle", message: "" });
    if (inputRef.current) inputRef.current.value = "";
  }

  function validateBasicFile(file) {
    const name = file.name.toLowerCase();
    const type = file.type;
    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    if (!isPdf) return `"${file.name}" is not a PDF.`;
    if (file.size > LIMITS.maxFileBytes) {
      return `"${file.name}" exceeds ${MAX_MB} MB.`;
    }
    return null;
  }

  async function analyzeFiles(files) {
    setAnalyzing(true);
    setSummary("");
    setStatus({ type: "idle", message: "" });

    const results = [];
    for (const file of files) {
      const basicError = validateBasicFile(file);
      if (basicError) {
        results.push({
          id: fileKey(file),
          name: file.name,
          fileBytes: file.size,
          status: "error",
          error: basicError,
        });
        continue;
      }
      try {
        const extracted = await extractPdfFromFile(file);
        results.push({
          id: fileKey(file),
          name: file.name,
          fileBytes: extracted.fileBytes,
          pageCount: extracted.pageCount,
          charCount: extracted.charCount,
          text: extracted.text,
          status: "ok",
        });
      } catch (err) {
        results.push({
          id: fileKey(file),
          name: file.name,
          fileBytes: file.size,
          status: "error",
          error:
            err instanceof PdfUserError
              ? err.message
              : `Could not read "${file.name}".`,
        });
      }
    }

    setDocuments(results);

    const ok = results.filter((d) => d.status === "ok");
    const combined = ok.reduce((n, d) => n + d.charCount, 0);
    if (ok.length && combined > LIMITS.maxCombinedExtractedChars) {
      setStatus({
        type: "error",
        message: `Combined text (${formatCount(combined)} characters) exceeds the ${formatCount(LIMITS.maxCombinedExtractedChars)} limit. Remove a document or use shorter PDFs.`,
      });
    } else if (results.some((d) => d.status === "error")) {
      setStatus({
        type: "error",
        message: "Some files could not be read. Remove failed files or upload replacements.",
      });
    }

    setAnalyzing(false);
  }

  function ingestFileList(fileList) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    if (incoming.length > LIMITS.maxFiles) {
      setStatus({
        type: "error",
        message: `You can upload up to ${LIMITS.maxFiles} PDFs at a time. Only the first ${LIMITS.maxFiles} were kept.`,
      });
    }
    const slice = incoming.slice(0, LIMITS.maxFiles);
    analyzeFiles(slice);
  }

  function onFileChange(event) {
    ingestFileList(event.target.files);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    ingestFileList(event.dataTransfer.files);
  }

  function onDragOver(event) {
    event.preventDefault();
    if (!busy) setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  function openFilePicker() {
    if (!busy) inputRef.current?.click();
  }

  function removeDocument(id) {
    setDocuments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (next.length === 0 && inputRef.current) inputRef.current.value = "";
      return next;
    });
    setSummary("");
    setStatus({ type: "idle", message: "" });
  }

  function applyPreset(preset) {
    setActivePreset(preset.id);
    setCustomPrompt(preset.instruction);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!docReady || isLoading) return;

    setSummary("");
    setStatus({
      type: "loading",
      message: `Synthesizing ${okDocs.length} document${okDocs.length > 1 ? "s" : ""}…`,
    });

    try {
      const combined = buildCombinedDocumentText(okDocs);
      const result = await summarizeDocumentText(combined, customPrompt);
      setSummary(result);
      setStatus({
        type: "success",
        message: "Unified clinical summary ready. Verify against source records.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || "Summarization failed. Please try again.",
      });
    }
  }

  const showEmptySummary = !summary && !isLoading;

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="#top" aria-label="Home">
            <span className="brand__logo">medkaz</span>
            <span className="brand__sub">Clinical document portal</span>
          </a>
          <nav className="site-nav" aria-label="Primary">
            <a className="site-nav__link site-nav__link--active" href="#upload">
              Upload
            </a>
            <a className="site-nav__link" href="#prompt">
              Instructions
            </a>
            <a className="site-nav__link" href="#results">
              Extract
            </a>
          </nav>
          <div className="site-header__actions">
            <button
              type="button"
              className="btn btn--green"
              onClick={openFilePicker}
              disabled={busy}
            >
              Upload PDFs
            </button>
          </div>
        </div>
      </header>

      <section className="hero-banner" id="top">
        <div className="hero-banner__overlay">
          <h1 className="hero-banner__title">
            Up to five clinical documents — one unified summary
          </h1>
          <p className="hero-banner__text">
            Upload discharge summaries, labs, and visit notes together. Choose
            how you want them summarized, then extract exact clinical facts in
            a single MedKaz-style brief.
          </p>
        </div>
      </section>

      <main className="main-content">
        <div className="workspace workspace--stack">
          <section className="panel" id="upload" aria-labelledby="upload-heading">
            <div className="panel__head">
              <h2 id="upload-heading" className="panel__title">
                Upload clinical PDFs
              </h2>
              <p className="panel__desc" id="pdf-hint">
                Up to {LIMITS.maxFiles} documents · {MAX_MB} MB each ·{" "}
                {LIMITS.maxPages} pages each · selectable text · no OCR
              </p>
            </div>

            <form className="upload-form" onSubmit={onSubmit} noValidate>
              <div
                className={`dropzone${dragOver ? " dropzone--active" : ""}${documents.length ? " dropzone--has-file" : ""}`}
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
                tabIndex={busy ? -1 : 0}
                aria-disabled={busy}
                aria-describedby="pdf-hint"
              >
                <input
                  ref={inputRef}
                  id="pdf-input"
                  className="dropzone__input"
                  name="pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={onFileChange}
                  disabled={busy}
                  tabIndex={-1}
                />
                {documents.length > 0 ? (
                  <ul className="file-list" onClick={(e) => e.stopPropagation()}>
                    {documents.map((doc) => (
                      <li
                        key={doc.id}
                        className={`file-list__item${doc.status === "error" ? " file-list__item--error" : ""}`}
                      >
                        <ClinicalDocIcon />
                        <div className="file-list__meta">
                          <span className="file-list__name">{doc.name}</span>
                          <span className="file-list__detail">
                            {formatBytes(doc.fileBytes)}
                            {doc.status === "ok" &&
                              ` · ${doc.pageCount} pg · ${formatCount(doc.charCount)} chars`}
                            {doc.status === "error" && ` · ${doc.error}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="file-list__remove"
                          onClick={() => removeDocument(doc.id)}
                          disabled={busy}
                          aria-label={`Remove ${doc.name}`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <div className="dropzone__icon-wrap">
                      <ClinicalDocIcon />
                    </div>
                    <p className="dropzone__prompt">
                      <strong>Choose up to {LIMITS.maxFiles} PDFs</strong> or drag
                      and drop here
                    </p>
                    <p className="dropzone__sub">
                      Combined summary from all documents in one request
                    </p>
                  </>
                )}
                {documents.length > 0 && (
                  <p className="dropzone__add-more">Click to replace all files</p>
                )}
              </div>

              <div className="metrics-box">
                <h3 className="metrics-box__title">Batch metrics</h3>
                <ul className="limits" aria-label="Batch metrics and limits">
                  {limitRows.map((item) => (
                    <li
                      key={item.key}
                      className={`limits__item${item.over ? " limits__item--over" : item.ok ? " limits__item--ok" : ""}`}
                    >
                      <span className="limits__label">{item.label}</span>
                      <span className="limits__value">{item.current}</span>
                      <span className="limits__max">{item.max}</span>
                    </li>
                  ))}
                </ul>
                {totalBytes > 0 && (
                  <p className="metrics-box__sub">
                    Total upload size: {formatBytes(totalBytes)}
                  </p>
                )}
              </div>

              <div className="prompt-box" id="prompt">
                <h3 className="prompt-box__title">Summarization instructions</h3>
                <p className="prompt-box__desc">
                  Choose a preset or write your own prompt. All documents are
                  summarized together in one response.
                </p>
                <div className="preset-row" role="group" aria-label="Prompt presets">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-chip${activePreset === preset.id ? " preset-chip--active" : ""}`}
                      onClick={() => applyPreset(preset)}
                      disabled={busy}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <label className="prompt-label" htmlFor="custom-prompt">
                  Your instructions
                </label>
                <textarea
                  id="custom-prompt"
                  className="prompt-textarea"
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setActivePreset("custom");
                  }}
                  rows={6}
                  disabled={busy}
                  placeholder="Describe how you want the combined documents summarized…"
                />
              </div>

              <div className="action-row">
                <button
                  type="submit"
                  className="btn btn--green btn--lg"
                  disabled={!docReady || isLoading || !customPrompt.trim()}
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Summarizing…
                    </>
                  ) : analyzing ? (
                    "Reading PDFs…"
                  ) : (
                    `Summarize ${okDocs.length || ""} document${okDocs.length === 1 ? "" : "s"}`
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn--orange btn--lg"
                  onClick={resetAll}
                  disabled={documents.length === 0 || busy}
                >
                  Clear all
                </button>
              </div>
            </form>

            <section className="status" aria-live="polite">
              {status.type === "error" && (
                <div className="alert alert--error" role="alert">
                  {status.message}
                </div>
              )}
              {status.type === "success" && !isLoading && (
                <div className="alert alert--success">{status.message}</div>
              )}
            </section>
          </section>

          <section
            className="panel panel--result"
            id="results"
            aria-labelledby="summary-heading"
          >
            <div className="panel__head">
              <h2 id="summary-heading" className="panel__title">
                Unified clinical summary
              </h2>
              <p className="panel__desc">
                One extraction across all uploaded documents
              </p>
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
                  <div className="summary-card__label">
                    Combined extraction · {okDocs.length} document
                    {okDocs.length === 1 ? "" : "s"}
                  </div>
                  <div className="summary-text">{summary}</div>
                  <p className="summary-disclaimer">
                    AI-generated from uploaded text. Verify against original
                    records before clinical decisions.
                  </p>
                </article>
              )}

              {showEmptySummary && (
                <div className="result-empty">
                  <ClinicalDocIcon />
                  <p>
                    Upload up to five PDFs, set your summarization instructions,
                    then run <strong>Summarize documents</strong>.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="trust-strip" aria-label="Features">
          <div className="trust-strip__item">
            <strong>Multi-document</strong>
            <span>Up to 5 PDFs in one unified brief</span>
          </div>
          <div className="trust-strip__item">
            <strong>Your prompt</strong>
            <span>Presets or custom clinical instructions</span>
          </div>
          <div className="trust-strip__item">
            <strong>Care coordination</strong>
            <span>Cross-document facts in one view</span>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="support">
        <div className="site-footer__inner">
          <p className="site-footer__brand">
            Clinical document summarizer · MedKaz-inspired portal
          </p>
          <p className="site-footer__legal">
            Handle PHI according to your organization&apos;s privacy and HIPAA
            policies.
          </p>
          <p className="site-footer__copy">
            © {new Date().getFullYear()} · Client-side PDF parsing · OpenAI
            processing
          </p>
        </div>
      </footer>
    </div>
  );
}
