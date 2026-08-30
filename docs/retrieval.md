# Retrieval & Vector Search Instrumentation

Feenion provides specialized span types for vector database searches, RAG document retrieval, and semantic search operations.

---

## Instrumenting Vector Search Spans

Use `with span("name", span_type="retrieval")` to record query parameters, top-k results, documents, similarity scores, and execution latency:

```python
from feenion import span

def vector_search(query: str, top_k: int = 5):
    with span("chromadb_query", span_type="retrieval") as s:
        s.input = {
            "query": query,
            "top_k": top_k,
            "collection": "policy_docs",
        }

        # Perform search in vector store (ChromaDB, Pinecone, Qdrant, Weaviate, Milvus, etc.)
        results = my_vector_db.search(query, k=top_k)

        s.output = {
            "documents": [r.page_content for r in results],
            "scores": [r.score for r in results],
            "metadata": [r.metadata for r in results],
        }

        return results
```

---

## What Feenion Captures

- **Query Text**: The search string or embedding query.
- **Top K**: Number of requested nearest neighbors.
- **Retrieved Documents**: Text chunks or document IDs supplied to the LLM context.
- **Relevance Scores**: Distance metric / cosine similarity scores.
- **Search Latency**: Time consumed by vector indexing & search.

---

## Vector Database Independence

Feenion does not require specific vector database libraries. Any vector database (Chroma, Pinecone, Qdrant, PGVector, Weaviate, FAISS) can be instrumented using generic `retrieval` spans.

