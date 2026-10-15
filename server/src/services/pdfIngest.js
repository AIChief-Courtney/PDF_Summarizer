import fs from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

export async function extractPagesFromPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.map((item) => ({
      str: "str" in item ? item.str : "",
      transform: item.transform,
    }));
    const text = items
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ pageNum, text, items });
  }
  return { pageCount: pdf.numPages, pages };
}

function guessSectionHeading(text) {
  const match = text.match(
    /^(ASSESSMENT|PLAN|IMPRESSION|FINDINGS|HISTORY|MEDICATIONS|DISCHARGE|LABORATORY|DIAGNOSIS)[:\s]/i
  );
  return match ? match[1].toUpperCase() : null;
}

export function chunkPages(pages, documentId) {
  const chunks = [];
  for (const page of pages) {
    if (!page.text) continue;
    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(start + CHUNK_SIZE, page.text.length);
      const slice = page.text.slice(start, end).trim();
      if (slice) {
        chunks.push({
          id: `${documentId}-p${page.pageNum}-${start}`,
          documentId,
          pageNum: page.pageNum,
          sectionHeading: start === 0 ? guessSectionHeading(slice) : null,
          text: slice,
          charStart: start,
          charEnd: end,
        });
      }
      if (end >= page.text.length) break;
      start = end - CHUNK_OVERLAP;
    }
  }
  return chunks;
}
