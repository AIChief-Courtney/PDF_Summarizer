import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LIMITS } from "./constants.js";

GlobalWorkerOptions.workerSrc = pdfWorker;

export class PdfUserError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isPdfBuffer(buffer) {
  if (!buffer || buffer.byteLength < 5) return false;
  const header = new TextDecoder().decode(buffer.slice(0, 5));
  return header.startsWith("%PDF-");
}

function isPasswordError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes("password") ||
    lower.includes("encrypted") ||
    lower.includes("needs password")
  );
}

async function loadPdfDocument(buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    const msg = err?.message || String(err);
    if (isPasswordError(msg)) {
      throw new PdfUserError(
        "PASSWORD_PROTECTED",
        "This PDF is password-protected. Please upload an unlocked PDF."
      );
    }
    throw new PdfUserError(
      "INVALID_PDF",
      "We could not read this PDF. It may be corrupt or unsupported."
    );
  }
}

async function extractTextFromPdf(pdf) {
  const parts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(pageText);
  }
  return parts.join("\n").replace(/\s+/g, " ").trim();
}

export async function extractPdfFromFile(file) {
  const buffer = await file.arrayBuffer();
  if (!isPdfBuffer(buffer)) {
    throw new PdfUserError(
      "INVALID_PDF",
      "Please upload a valid PDF file."
    );
  }

  const pdf = await loadPdfDocument(buffer);
  const pageCount = pdf.numPages;

  if (pageCount > LIMITS.maxPages) {
    throw new PdfUserError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The limit is ${LIMITS.maxPages} pages per file.`
    );
  }

  const text = await extractTextFromPdf(pdf);
  if (!text) {
    throw new PdfUserError(
      "NO_TEXT",
      "No readable text was found in this PDF. Scanned images and OCR are not supported."
    );
  }

  if (text.length > LIMITS.maxExtractedCharsPerFile) {
    throw new PdfUserError(
      "TEXT_TOO_LONG",
      `Extracted text exceeds ${LIMITS.maxExtractedCharsPerFile.toLocaleString()} characters for this file.`
    );
  }

  return { text, pageCount, charCount: text.length, fileBytes: file.size };
}

export function buildCombinedDocumentText(documents) {
  return documents
    .map(
      (doc, index) =>
        `=== DOCUMENT ${index + 1}: ${doc.name} ===\n${doc.text}`
    )
    .join("\n\n");
}
