const crypto = require('crypto');
const { queryVectorMemories, saveVectorMemory } = require('../database');
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

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dimensions;
      vector[idx] += 1;
    }

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

    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }

  async storeMemory({ category, contextText, metadata = {} }) {
    const id = crypto.randomUUID();
    const embedding = this.generateEmbedding(contextText);
    await saveVectorMemory({
      id,
      category,
      contextText,
      embedding,
      metadata,
      timestamp: Date.now(),
    });
    return id;
  }

  async findSimilar(queryText, { category = null, limit = 3, minSimilarity = 0.4 } = {}) {
    const queryEmbedding = this.generateEmbedding(queryText);
    const rows = await queryVectorMemories(category);
    if (!rows || rows.length === 0) return [];

    const scored = rows.map(row => {
      let emb = [];
      let meta = {};
      try {
        emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
      } catch {}
      try {
        meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
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
