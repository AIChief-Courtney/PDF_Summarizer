export const MEDICAL_GROUNDING = `Medical grounding rules:
- Patient-specific facts must come from provided document excerpts only.
- Preserve exact doses, units, dates, anatomy, laterality, and qualifiers.
- Distinguish suspected vs confirmed diagnoses; ordered vs administered treatment.
- "Not documented" is not "normal" or "absent."
- Do not diagnose from images/ECG beyond documented interpretations.
- Web context is general education only—never imply it describes this patient.
- If evidence is insufficient, say so explicitly.`;

export const SUMMARY_METHODS = {
  quick: "Quick overview for care coordination (short narrative).",
  detailed: "Detailed clinical summary with problems, data, and plan.",
  by_category: "Organize by document category and section type.",
  timeline: "Chronological timeline with explicit dates when documented.",
  discharge: "Discharge and follow-up focused summary.",
  meds: "Medication and allergy focused summary.",
  labs: "Laboratory and diagnostic results focused summary.",
  compare: "Compare selected records; note changes and contradictions.",
  custom: "Follow the user's custom instructions.",
};

export function buildSummarySystemPrompt(config) {
  const method = SUMMARY_METHODS[config.method] || SUMMARY_METHODS.detailed;
  const audience =
    config.audience === "patient"
      ? "Use plain language suitable for an educated patient."
      : "Use professional clinical language.";
  const length =
    config.length === "short"
      ? "Keep output concise."
      : config.length === "detailed"
        ? "Be thorough while staying grounded."
        : "Standard length.";
  const format =
    config.format === "bullets"
      ? "Use bullet lists."
      : config.format === "table"
        ? "Use plain-text tables where helpful."
        : "Use narrative paragraphs.";

  return `${MEDICAL_GROUNDING}

Task: Produce a unified medical record summary.
Method: ${method}
Audience: ${audience}
Length: ${length}
Format: ${format}
Custom instructions: ${config.customInstructions || "None"}

Return JSON with keys:
title (string),
sections (array of {heading, body, citations: [{documentId, page, quote}]}),
coverage ({documentsIncluded, documentsMissing, limitations}),
ambiguities (array of strings),
pendingItems (array of strings),
webContext (null or {heading, body, sources: [{title, url, publisher}]}),
citations (flat array of {documentId, page, quote, claim}).`;
}

export function buildChatSystemPrompt(sourceMode) {
  return `${MEDICAL_GROUNDING}

Answer follow-up questions using retrieved document excerpts as primary evidence.
Do not treat a prior AI summary as sole truth—re-check excerpts.
Source mode: ${sourceMode}.

Return JSON:
answerSections: {
  documentFindings: string,
  webContext: string | null,
  missingOrUncertain: string,
},
sources: {
  documents: [{documentId, documentName, page, quote}],
  web: [{title, url, publisher}]
},
usedWeb: boolean`;
}
