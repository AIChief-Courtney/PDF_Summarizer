const TRUSTED_HOSTS = [
  "nih.gov",
  "cdc.gov",
  "fda.gov",
  "who.int",
  "medlineplus.gov",
  "cancer.gov",
  "heart.org",
  "diabetes.org",
  "mayoclinic.org",
  "clevelandclinic.org",
];

function sanitizeQuery(query) {
  return query
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "")
    .replace(/\b(MRN|DOB|SSN|patient name)[:\s]*[^\s,]+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function searchMedicalWeb(generalConcept) {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return {
      available: false,
      reason: "Web search is not configured (TAVILY_API_KEY missing).",
      results: [],
    };
  }

  const query = sanitizeQuery(generalConcept);
  if (!query) {
    return {
      available: false,
      reason: "Could not form a safe generalized search query.",
      results: [],
    };
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: `${query} site:gov OR site:org medical guideline`,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    return {
      available: false,
      reason: "Web search provider returned an error.",
      results: [],
    };
  }

  const data = await response.json();
  const results = (data.results || [])
    .filter((r) => {
      try {
        const host = new URL(r.url).hostname.replace(/^www\./, "");
        return TRUSTED_HOSTS.some((h) => host.endsWith(h));
      } catch {
        return false;
      }
    })
    .map((r) => ({
      title: r.title,
      url: r.url,
      publisher: safeHost(r.url),
      snippet: r.content?.slice(0, 400) || "",
      publishedDate: r.published_date || null,
    }));

  return { available: true, query, results };
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
