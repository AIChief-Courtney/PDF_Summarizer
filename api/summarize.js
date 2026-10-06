import { parsePdfUpload } from "./_lib/parseUpload.js";
import { errorResponse } from "../server/src/errors.js";
import { extractPdfText } from "../server/src/services/pdfExtract.js";
import { summarizeDocumentText } from "../server/src/services/summarize.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for this endpoint." },
    });
    return;
  }

  try {
    const { buffer } = await parsePdfUpload(req);
    const { text } = await extractPdfText(buffer);
    const summary = await summarizeDocumentText(text);
    res.status(200).json({ summary });
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
}
