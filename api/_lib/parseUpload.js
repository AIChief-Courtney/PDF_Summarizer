import Busboy from "busboy";
import { LIMITS } from "../../server/src/constants.js";
import { AppError } from "../../server/src/errors.js";

function looksLikePdf(filename, mimeType) {
  const name = (filename || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

export function parsePdfUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: LIMITS.maxFileBytes },
    });

    let fileBuffer = null;
    let filename = "";
    let mimeType = "";
    let sawFile = false;

    busboy.on("file", (field, stream, info) => {
      if (field !== "file") {
        stream.resume();
        return;
      }
      sawFile = true;
      filename = info.filename;
      mimeType = info.mimeType;
      const chunks = [];

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => {
        reject(
          new AppError(
            400,
            "FILE_TOO_LARGE",
            "This file exceeds the 5 MB size limit. Please choose a smaller PDF."
          )
        );
      });
      stream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("error", (err) => reject(err));

    busboy.on("finish", () => {
      if (!sawFile || !fileBuffer) {
        reject(
          new AppError(
            400,
            "NO_FILE",
            "Please select a PDF file to summarize."
          )
        );
        return;
      }
      if (!looksLikePdf(filename, mimeType)) {
        reject(
          new AppError(
            400,
            "INVALID_PDF",
            "Please upload a valid PDF file."
          )
        );
        return;
      }
      resolve({ buffer: fileBuffer, filename, mimeType });
    });

    req.pipe(busboy);
  });
}
