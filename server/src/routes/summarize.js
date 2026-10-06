import { Router } from "express";
import multer from "multer";
import { LIMITS } from "../constants.js";
import { AppError, errorResponse } from "../errors.js";
import { extractPdfText } from "../services/pdfExtract.js";
import { summarizeDocumentText } from "../services/summarize.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.maxFileBytes, files: 1 },
  fileFilter(_req, file, cb) {
    const mime = file.mimetype?.toLowerCase();
    const name = file.originalname?.toLowerCase() || "";
    const looksPdf =
      mime === "application/pdf" || name.endsWith(".pdf");
    if (!looksPdf) {
      cb(
        new AppError(
          400,
          "INVALID_PDF",
          "Please upload a valid PDF file."
        )
      );
      return;
    }
    cb(null, true);
  },
});

router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(
          new AppError(
            400,
            "FILE_TOO_LARGE",
            "This file exceeds the 5 MB size limit. Please choose a smaller PDF."
          )
        );
        return;
      }
      next(
        new AppError(400, "INVALID_PDF", "Could not accept this upload.")
      );
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      throw new AppError(
        400,
        "NO_FILE",
        "Please select a PDF file to summarize."
      );
    }

    const { text } = await extractPdfText(req.file.buffer);
    const summary = await summarizeDocumentText(text);
    res.json({ summary });
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

export default router;
