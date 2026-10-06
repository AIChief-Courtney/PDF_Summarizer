import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "samples");
fs.mkdirSync(outDir, { recursive: true });

const text =
  "Sample document for PDF Summarizer testing. This paragraph describes a fictional product launch in 2024. " +
  "The team shipped a web tool that extracts PDF text and summarizes it with AI. Key goals included clear error messages, " +
  "server-side validation, and a simple React UI. Stakeholders wanted summaries of about one hundred to one hundred fifty words.";

const doc = await PDFDocument.create();
const page = doc.addPage();
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText(text, { x: 50, y: 700, size: 12, font, maxWidth: 500, lineHeight: 14 });
const bytes = await doc.save();

const outPath = path.join(outDir, "sample-text.pdf");
fs.writeFileSync(outPath, bytes);
console.log("Wrote", outPath);
