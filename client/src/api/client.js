const headers = () => ({
  "X-Workspace-Id": localStorage.getItem("workspaceId") || "default-workspace",
  "X-Patient-Id": localStorage.getItem("patientId") || "default-patient",
});

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || "Request failed");
  return data;
}

export const api = {
  health: () => fetch("/api/health").then(parse),
  workspace: () => fetch("/api/workspace", { headers: headers() }).then(parse),
  categories: () => fetch("/api/categories").then(parse),
  listDocuments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`/api/documents?${q}`, { headers: headers() }).then(parse);
  },
  uploadDocuments: (formData) =>
    fetch("/api/documents", {
      method: "POST",
      headers: headers(),
      body: formData,
    }).then(parse),
  retryDocument: (id) =>
    fetch(`/api/documents/${id}/retry`, {
      method: "POST",
      headers: headers(),
    }).then(parse),
  documentFileUrl: (id) => `/api/documents/${id}/file`,
  createSummary: (config) =>
    fetch("/api/summaries", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    }).then(parse),
  listSummaries: () =>
    fetch("/api/summaries", { headers: headers() }).then(parse),
  getSummary: (id) =>
    fetch(`/api/summaries/${id}`, { headers: headers() }).then(parse),
  getJob: (id) => fetch(`/api/jobs/${id}`).then(parse),
  createConversation: (body) =>
    fetch("/api/conversations", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse),
  sendMessage: (conversationId, content) =>
    fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then(parse),
};
