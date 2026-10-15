import { api } from "../api/client.js";

export function EvidenceDrawer({ open, evidence, onClose }) {
  if (!open || !evidence) return null;

  const pdfUrl = evidence.documentId
    ? api.documentFileUrl(evidence.documentId)
    : null;

  return (
    <aside className="drawer" aria-label="Source evidence">
      <div className="drawer__head">
        <h2>Source evidence</h2>
        <button type="button" className="drawer__close" onClick={onClose}>
          Close
        </button>
      </div>
      {evidence.documentName && (
        <p className="drawer__meta">
          {evidence.documentName}
          {evidence.page != null ? ` · Page ${evidence.page}` : ""}
        </p>
      )}
      {evidence.quote && (
        <blockquote className="drawer__quote">{evidence.quote}</blockquote>
      )}
      {pdfUrl && (
        <iframe
          title="Document preview"
          className="drawer__pdf"
          src={`${pdfUrl}#page=${evidence.page || 1}`}
        />
      )}
      {!evidence.highlightAvailable && evidence.quote && (
        <p className="drawer__note">
          Text highlight coordinates are not available for this excerpt; page
          navigation is shown when supported by the viewer.
        </p>
      )}
    </aside>
  );
}
