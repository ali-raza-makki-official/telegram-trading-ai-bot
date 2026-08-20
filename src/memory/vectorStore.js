const crypto = require('crypto');
const { query, execute } = require('../database');
const logger = require('../utils/logger');

// Lightweight TF-IDF & Character N-Gram feature vectorizer for fast, embedded zero-dependency similarity search
class VectorStore {
  constructor() {
    this.vocab = new Map();
  }

  // Generate a fixed-dimension pseudo-embedding using n-grams & keyword hashing
  generateEmbedding(text, dimensions = 64) {
    const vector = new Array(dimensions).fill(0);
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = clean.split(/\s+/).filter(t => t.length > 1);

    if (tokens.length === 0) return vector;

    // Hash tokens to vector indices
    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dimensions;
      vector[idx] += 1;
    }

    // Also add bigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]}_${tokens[i + 1]}`;
      let hash = 0;
      for (let j = 0; j < bigram.length; j++) {
        hash = (hash << 5) - hash + bigram.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dimensions;
      vector[idx] += 1.5;
    }

    // L2 Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  // Calculate Cosine Similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }

  // Store a memory
  async storeMemory({ category, contextText, metadata = {} }) {
    const id = crypto.randomUUID();
    const embedding = this.generateEmbedding(contextText);
    const sql = `
      INSERT INTO vector_memories (id, category, context_text, embedding, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      id,
      category,
      contextText,
      JSON.stringify(embedding),
      JSON.stringify(metadata),
      Date.now(),
    ];
    await execute(sql, params);
    return id;
  }

  // Search for the top K most similar memories
  async findSimilar(queryText, { category = null, limit = 3, minSimilarity = 0.4 } = {}) {
    const queryEmbedding = this.generateEmbedding(queryText);
    let sql = `SELECT * FROM vector_memories`;
    const params = [];
    if (category) {
      sql += ` WHERE category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY timestamp DESC LIMIT 100`;

    const rows = await query(sql, params);
    if (!rows || rows.length === 0) return [];

    const scored = rows.map(row => {
      let emb = [];
      let meta = {};
      try {
        emb = JSON.parse(row.embedding);
      } catch {}
      try {
        meta = JSON.parse(row.metadata);
      } catch {}

      const score = this.cosineSimilarity(queryEmbedding, emb);
      return {
        id: row.id,
        category: row.category,
        contextText: row.context_text,
        metadata: meta,
        timestamp: row.timestamp,
        similarity: score,
      };
    });

    return scored
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}

module.exports = new VectorStore();
