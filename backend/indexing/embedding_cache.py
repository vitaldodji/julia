"""Cache disque des embeddings.

Une indexation interrompue reprend là où elle s'est arrêtée, et une réindexation ne recalcule que
les chunks dont le texte a changé : sur un CPU, BGE-M3 met plus d'une heure pour tout le corpus.
"""

from __future__ import annotations

import hashlib
import logging
import sqlite3
from collections.abc import Sequence
from pathlib import Path

import numpy as np

from backend.rag.interfaces import Embedder

logger = logging.getLogger(__name__)

_SQLITE_MAX_VARIABLES = 500


class EmbeddingCache:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path)
        self._conn.execute("CREATE TABLE IF NOT EXISTS embeddings (key TEXT PRIMARY KEY, vector BLOB NOT NULL)")

    @staticmethod
    def key(model_name: str, text: str) -> str:
        return hashlib.sha256(f"{model_name}\n{text}".encode()).hexdigest()

    def get_many(self, keys: Sequence[str]) -> dict[str, list[float]]:
        found: dict[str, list[float]] = {}
        for start in range(0, len(keys), _SQLITE_MAX_VARIABLES):
            batch = list(keys[start : start + _SQLITE_MAX_VARIABLES])
            placeholders = ",".join("?" * len(batch))
            rows = self._conn.execute(f"SELECT key, vector FROM embeddings WHERE key IN ({placeholders})", batch)
            for key, blob in rows:
                found[key] = np.frombuffer(blob, dtype=np.float32).tolist()
        return found

    def put_many(self, items: Sequence[tuple[str, Sequence[float]]]) -> None:
        with self._conn:
            self._conn.executemany(
                "INSERT OR REPLACE INTO embeddings (key, vector) VALUES (?, ?)",
                [(key, np.asarray(vector, dtype=np.float32).tobytes()) for key, vector in items],
            )

    def close(self) -> None:
        self._conn.close()


def embed_with_cache(
    texts: Sequence[str], embedder: Embedder, cache: EmbeddingCache, batch_size: int = 64
) -> list[list[float]]:
    """Calcule les embeddings manquants par lots, en les enregistrant au fur et à mesure."""
    keys = [EmbeddingCache.key(embedder.model_name, text) for text in texts]
    vectors = cache.get_many(list(dict.fromkeys(keys)))
    texts_by_key = {key: text for key, text in zip(keys, texts, strict=True) if key not in vectors}
    # Les plus longs d'abord : chaque lot regroupe des textes de taille voisine (moins de remplissage).
    todo = sorted(texts_by_key, key=lambda key: len(texts_by_key[key]), reverse=True)
    logger.info(
        "Embeddings : %d en cache, %d à calculer avec %s.", len(keys) - len(todo), len(todo), embedder.model_name
    )

    next_report = 0.05
    for start in range(0, len(todo), batch_size):
        batch = todo[start : start + batch_size]
        batch_vectors = embedder.embed_documents([texts_by_key[key] for key in batch])
        cache.put_many(list(zip(batch, batch_vectors, strict=True)))
        vectors.update(zip(batch, batch_vectors, strict=True))
        done = start + len(batch)
        if done / len(todo) >= next_report or done == len(todo):
            logger.info("Embeddings : %d / %d (%.0f %%)", done, len(todo), 100 * done / len(todo))
            next_report += 0.05
    return [vectors[key] for key in keys]
