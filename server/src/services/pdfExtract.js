import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { LIMITS } from "../constants.js";
import { AppError } from "../errors.js";

function isPdfBuffer(buffer) {
  if (!buffer || buffer.length < 5) return false;
  const header = buffer.subarray(0, 5).toString("ascii");
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
      throw new AppError(
        400,
        "PASSWORD_PROTECTED",
        "This PDF is password-protected. Please upload an unlocked PDF."
      );
    }
    throw new AppError(
      400,
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

export async function extractPdfText(buffer) {
  if (!isPdfBuffer(buffer)) {
    throw new AppError(
      400,
      "INVALID_PDF",
      "Please upload a valid PDF file."
    );
  }

  const pdf = await loadPdfDocument(buffer);
  const pageCount = pdf.numPages;

  if (pageCount > LIMITS.maxPages) {
    throw new AppError(
      400,
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The limit is ${LIMITS.maxPages} pages.`
    );
  }

  const text = await extractTextFromPdf(pdf);
  if (!text) {
    throw new AppError(
      400,
      "NO_TEXT",
      "No readable text was found in this PDF. Scanned images and OCR are not supported."
    );
  }

  if (text.length > LIMITS.maxExtractedChars) {
    throw new AppError(
      400,
      "TEXT_TOO_LONG",
      `Extracted text exceeds ${LIMITS.maxExtractedChars.toLocaleString()} characters. Please use a shorter document.`
    );
  }

  return { text, pageCount };
}
