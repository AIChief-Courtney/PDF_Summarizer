# Verification note

Checks performed during development (re-run locally with your API key):

| ID | Check | Result |
|----|--------|--------|
| A1 | `npm install`, `npm run install:all`, `.env` + README steps | Documented; run after clone |
| A2 | Valid text PDF → real OpenAI summary | Requires `OPENAI_API_KEY` (PDF extract verified locally) |
| — | `POST /api/summarize` with `samples/sample-text.pdf` | Returns `CONFIG_ERROR` without key; extraction succeeds before AI step |
| — | `GET /api/health` | Returns `{"ok":true}` |
| — | `npm run build` (client) | Succeeds |
| A4 | Loading spinner, disabled submit while in flight | Implemented in `client/src/App.jsx` |
| A5 | Invalid / oversized inputs return JSON errors | Server validation in `server/src/services/pdfExtract.js` |
| A7 | New file clears prior summary/error | `resetForNewFile` on file change |
| A8 | API key server-only; responsive layout | Key read only in `server/`; CSS uses fluid width |

## Suggested manual tests

1. Start with `npm run dev` and open http://localhost:5173.
2. Upload a small text-based PDF and confirm a ~100–150 word summary.
3. Try a `.txt` renamed to `.pdf` or a corrupt file → clear error.
4. Try a file &gt; 5 MB → size limit message.
5. Start a summary, confirm the button stays disabled until completion.
6. Upload a second PDF without refresh → old summary must not show for the new file.

## Unresolved / environment

- End-to-end AI test depends on a valid `OPENAI_API_KEY` and network access to OpenAI.
- Password-protected and scanned PDF behavior depends on `pdf-parse` error messages on your OS.
