from __future__ import annotations

import dataclasses
import logging

import psycopg
from pgvector.psycopg import register_vector
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from backend.stores import ContactRecord, TraceRecord

logger = logging.getLogger(__name__)


def configure_connection(conn: psycopg.Connection) -> None:
    register_vector(conn)


def database_status(pool: ConnectionPool) -> str:
    try:
        with pool.connection(timeout=2) as conn:
            conn.execute("SELECT 1")
    except Exception as error:
        logger.warning("Base de données injoignable : %s", error)
        return "down"
    return "ok"


class PgTraceStore:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def record(self, trace: TraceRecord) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO rag_traces (request_id, question, filters, status, retrieved, cited,
                                        timings_ms, llm_model, input_tokens, output_tokens, error,
                                        client_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (request_id) DO NOTHING
                """,
                (
                    trace.request_id,
                    trace.question,
                    Jsonb(trace.filters),
                    trace.status,
                    Jsonb([dataclasses.asdict(hit) for hit in trace.retrieved]),
                    trace.cited,
                    Jsonb(trace.timings_ms),
                    trace.llm_model,
                    trace.input_tokens,
                    trace.output_tokens,
                    trace.error,
                    trace.client_hash,
                ),
            )


class PgContactStore:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def add(self, contact: ContactRecord, client_hash: str | None) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "INSERT INTO contacts (full_name, email, phone, company, position, consent, client_hash)"
                " VALUES (%s, %s, %s, %s, %s, true, %s)",
                (contact.full_name, contact.email, contact.phone, contact.company, contact.position, client_hash),
            )

    def list_all(self) -> list[ContactRecord]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                "SELECT full_name, email, phone, company, position, created_at FROM contacts ORDER BY created_at"
            ).fetchall()
        return [ContactRecord(*row[:5], created_at=row[5].isoformat(timespec="seconds")) for row in rows]


class PgFeedbackStore:
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def add(self, request_id: str, rating: int, comment: str | None) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "INSERT INTO feedback (request_id, rating, comment) VALUES (%s, %s, %s)",
                (request_id, rating, comment),
            )
