import { ChromaClient } from "chromadb";
import { db } from "../db.js";
import { getOpenAI } from "./openaiClient.js";

const chromaPath = process.env.CHROMA_PATH || "./data/chroma";
let chroma;

function getChroma() {
  if (!chroma) {
    chroma = new ChromaClient({ path: process.env.CHROMA_URL || undefined });
  }
  return chroma;
}

function collectionName(patientId) {
  return `patient_${patientId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export async function upsertChunks(patientId, chunks, metaById) {
  const openai = getOpenAI();
  if (!openai) throw new Error("OPENAI_API_KEY required for embeddings");

  const client = getChroma();
  const collection = await client.getOrCreateCollection({
    name: collectionName(patientId),
    metadata: { patientId },
  });

  const batchSize = 32;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const input = batch.map((c) => c.text);
    const emb = await openai.embeddings.create({
      model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
      input,
    });
    await collection.upsert({
      ids: batch.map((c) => c.id),
      embeddings: emb.data.map((e) => e.embedding),
      documents: batch.map((c) => c.text),
      metadatas: batch.map((c) => ({
        documentId: c.documentId,
        pageNum: c.pageNum,
        sectionHeading: c.sectionHeading || "",
        ...(metaById[c.documentId] || {}),
      })),
    });
  }
}

export async function deleteDocumentVectors(patientId, documentId) {
  try {
    const client = getChroma();
    const collection = await client.getCollection({
      name: collectionName(patientId),
    });
    const existing = await collection.get({
      where: { documentId },
    });
    if (existing.ids?.length) {
      await collection.delete({ ids: existing.ids });
    }
  } catch {
    /* collection may not exist */
  }
}

function retrieveChunksFromSqlite(patientId, query, { documentIds = [], limit = 12 } = {}) {
  let ids = documentIds;
  if (!ids.length) {
    ids = db
      .prepare(
        "SELECT id FROM documents WHERE patient_id = ? AND status = 'ready'"
      )
      .all(patientId)
      .map((r) => r.id);
  }
  if (!ids.length) return [];

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT c.*, d.filename FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.document_id IN (${placeholders})
       ORDER BY c.page_num`
    )
    .all(...ids);

  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2)
    .slice(0, 12);

  const scored = rows.map((r) => {
    const text = r.text || "";
    const lower = text.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (lower.includes(t)) score += 1;
    }
    return {
      id: r.id,
      text,
      metadata: {
        documentId: r.document_id,
        pageNum: r.page_num,
        sectionHeading: r.section_heading || "",
        filename: r.filename,
      },
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.metadata.pageNum - b.metadata.pageNum);
  const picked = scored.filter((s) => s.score > 0).slice(0, limit);
  if (picked.length) return picked;
  return scored.slice(0, limit);
}

export async function retrieveChunks(patientId, query, { documentIds = [], limit = 12 } = {}) {
  const openai = getOpenAI();
  if (!openai) {
    return retrieveChunksFromSqlite(patientId, query, { documentIds, limit });
  }

  const client = getChroma();
  let collection;
  try {
    collection = await client.getCollection({ name: collectionName(patientId) });
  } catch {
    return retrieveChunksFromSqlite(patientId, query, { documentIds, limit });
  }

  try {
    const qEmb = await openai.embeddings.create({
      model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
      input: query,
    });

    const where =
      documentIds.length > 0
        ? { documentId: { $in: documentIds } }
        : undefined;

    const results = await collection.query({
      queryEmbeddings: [qEmb.data[0].embedding],
      nResults: limit,
      where,
      include: ["documents", "metadatas", "distances"],
    });

    const out = [];
    const ids = results.ids?.[0] || [];
    for (let i = 0; i < ids.length; i += 1) {
      out.push({
        id: ids[i],
        text: results.documents?.[0]?.[i] || "",
        metadata: results.metadatas?.[0]?.[i] || {},
        distance: results.distances?.[0]?.[i],
      });
    }
    if (out.length) return out;
  } catch {
    /* fall through to SQLite */
  }
  return retrieveChunksFromSqlite(patientId, query, { documentIds, limit });
}

export async function listAllChunksForDocuments(patientId, documentIds) {
  const client = getChroma();
  try {
    const collection = await client.getCollection({
      name: collectionName(patientId),
    });
    const where =
      documentIds.length > 0
        ? { documentId: { $in: documentIds } }
        : undefined;
    const res = await collection.get({ where, include: ["documents", "metadatas"] });
    return (res.ids || []).map((id, i) => ({
      id,
      text: res.documents?.[i] || "",
      metadata: res.metadatas?.[i] || {},
    }));
  } catch {
    return [];
  }
}
