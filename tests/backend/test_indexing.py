import json
from pathlib import Path

import pytest

from backend.indexing.index_corpus import (
    IndexingError,
    check_against_manifest,
    embedding_text,
    main,
    read_chunks,
)
from backend.indexing.embedding_cache import EmbeddingCache, embed_with_cache
from backend.indexing.index_corpus import select_mvp_chunks
from backend.indexing.manifest import load_manifest
from backend.indexing.quality import quality_report
from backend.rag.fake import HashingEmbedder
from contracts import LegalChunk

REAL_MANIFEST = Path(__file__).resolve().parents[2] / "data" / "metadata" / "corpus_manifest.yaml"

MANIFEST_YAML = """
source_root: ressources
entries:
- id: cgi-2026
  path: Fiscal/CODE/cgi-2026.pdf
  title: cgi 2026
  domain: fiscal
  country: BJ
  document_type: code_ou_loi
  source_level: 1
  version_label: 2026 (LF 2025-22)
  status: en_vigueur
  has_text_layer: true
  in_mvp: true
  sha256: abc
- id: note-copie
  path: Fiscal/note-copie.pdf
  title: note copie
  domain: fiscal
  country: BJ
  document_type: note_circulaire
  source_level: 2
  status: en_vigueur
  has_text_layer: false
  duplicate_of: note
- id: arrete-2020
  path: Fiscal/ARRETE/arrete-2020.pdf
  title: arrete 2020
  domain: fiscal
  country: BJ
  document_type: arrete_ou_acte
  source_level: 1
  status: en_vigueur
  has_text_layer: false
  in_mvp: true
"""


def chunk(**overrides):
    fields = {
        "chunk_id": "cgi-2026:art-1",
        "document_id": "cgi-2026",
        "ordinal": 0,
        "content": "Texte de l'article premier.",
        "source_level": 1,
        "country": "BJ",
        "document_type": "code_ou_loi",
        "document_title": "Code général des impôts",
        "status": "en_vigueur",
        "article": "1",
        "title": "Livre I",
    }
    fields.update(overrides)
    return LegalChunk.model_validate(fields)


@pytest.fixture
def manifest(tmp_path):
    path = tmp_path / "manifest.yaml"
    path.write_text(MANIFEST_YAML, encoding="utf-8")
    return load_manifest(path)


def test_real_manifest_loads():
    manifest = load_manifest(REAL_MANIFEST)

    assert len(manifest.entries) == 48
    assert sum(entry.in_mvp for entry in manifest.entries.values()) == 33


def test_manifest_builds_the_path_under_data_raw(manifest):
    assert manifest.file_path(manifest.entries["cgi-2026"]) == "ressources/Fiscal/CODE/cgi-2026.pdf"


def test_consistent_chunks_pass(manifest):
    assert check_against_manifest([chunk(), chunk(chunk_id="cgi-2026:art-2", ordinal=1)], manifest) == []


def test_manifest_checks_report_every_problem(manifest):
    errors = check_against_manifest(
        [
            chunk(),
            chunk(ordinal=1),
            chunk(chunk_id="cgi-2026:art-3", ordinal=2, status="archive", source_level=2),
            chunk(chunk_id="inconnu:1", document_id="inconnu"),
            chunk(chunk_id="copie:1", document_id="note-copie", source_level=2, document_type="note_circulaire"),
        ],
        manifest,
    )

    joined = "\n".join(errors)
    assert "chunk_id en double" in joined
    assert "status = 'archive', le manifeste indique 'en_vigueur'" in joined
    assert "source_level = 2" in joined
    assert "absent du manifeste" in joined
    assert "doublon de note" in joined


def test_read_chunks_reports_file_and_line(tmp_path):
    path = tmp_path / "cgi.jsonl"
    path.write_text(chunk().model_dump_json() + "\n\n" + json.dumps({"chunk_id": "x"}) + "\n", encoding="utf-8")

    with pytest.raises(IndexingError) as error:
        read_chunks([path])

    assert any(message.startswith("cgi.jsonl:3 : ") for message in error.value.errors)


def test_embedding_text_carries_the_legal_context():
    text = embedding_text(chunk())

    assert text.splitlines()[0] == "Code général des impôts — Livre I — Article 1"
    assert text.endswith("Texte de l'article premier.")


def test_dry_run_validates_without_a_database(tmp_path, manifest, monkeypatch):
    manifest_path = tmp_path / "manifest.yaml"
    good = tmp_path / "good.jsonl"
    good.write_text(chunk().model_dump_json() + "\n", encoding="utf-8")
    bad = tmp_path / "bad.jsonl"
    bad.write_text(chunk(status="archive").model_dump_json() + "\n", encoding="utf-8")
    report = tmp_path / "qualite.json"
    monkeypatch.delenv("JULIA_DATABASE_URL", raising=False)

    args = ["--manifest", str(manifest_path), "--dry-run", "--report", str(report)]
    assert main(["--chunks", str(tmp_path / "good*.jsonl"), *args]) == 0
    assert {check["code"] for check in json.loads(report.read_text(encoding="utf-8"))} == {
        "documents_mvp_absents", "trop_court",
    }
    assert main(["--chunks", str(bad), "--manifest", str(manifest_path), "--dry-run"]) == 1


NORMAL_TEXT = "Texte de l'article, assez long pour ne pas passer pour un simple intitulé isolé."


def test_quality_report_flags_what_the_pipeline_must_fix(manifest):
    heading = "Les bénéfices réalisés par les sociétés et autres personnes morales sont imposables"
    repeated = "Journal officiel de la République du Bénin, numéro spécial, en-tête répété en haut de page"
    chunks = [
        chunk(content="x" * 4500),
        chunk(chunk_id="cgi-2026:2", ordinal=1, article="2", content="Article 2"),
        chunk(chunk_id="cgi-2026:3", ordinal=2, article="icl", is_ocr=True, content=NORMAL_TEXT),
        chunk(chunk_id="cgi-2026:4", ordinal=3, article="4", title=heading, content=f"Article 4 : {heading} à l'IS."),
        chunk(chunk_id="cgi-2026:5", ordinal=4, article="5", content=repeated),
        chunk(chunk_id="cgi-2026:6", ordinal=5, article="6", content=repeated),
    ]

    checks = {check.code: check.items for check in quality_report(chunks, manifest)}

    assert checks == {
        "documents_mvp_absents": ["arrete-2020"],
        "trop_long": ["cgi-2026:art-1 (4500 car.)"],
        "trop_court": ["cgi-2026:2 : « Article 2 »"],
        "ocr_incoherent": ["cgi-2026 (1/6 chunks)"],
        "article_suspect": ["cgi-2026:3 : article « icl »"],
        "hierarchie_suspecte": [f"cgi-2026:4 : « {heading[:50]} »"],
        "doublon_dans_document": [f"cgi-2026 : 2 fois « {repeated[:40]} »"],
    }


def test_clean_chunks_produce_no_quality_warning(manifest):
    chunks = [chunk(content=NORMAL_TEXT), chunk(chunk_id="cgi-2026:art-2", ordinal=1, article="2", content=NORMAL_TEXT + " Bis.")]
    clean_manifest = load_manifest_without("arrete-2020", manifest)

    assert quality_report(chunks, clean_manifest) == []


class CountingEmbedder(HashingEmbedder):
    def __init__(self):
        super().__init__()
        self.embedded = []

    def embed_documents(self, texts):
        self.embedded.extend(texts)
        return super().embed_documents(texts)


def test_embedding_cache_only_computes_new_texts(tmp_path):
    cache = EmbeddingCache(tmp_path / "cache.sqlite")
    embedder = CountingEmbedder()

    first = embed_with_cache(["texte a", "texte b", "texte a"], embedder, cache, batch_size=2)
    assert sorted(embedder.embedded) == ["texte a", "texte b"]

    embedder.embedded.clear()
    second = embed_with_cache(["texte a", "texte c"], embedder, cache)

    assert embedder.embedded == ["texte c"]
    assert second[0] == pytest.approx(first[0], abs=1e-6)
    cache.close()


def test_embedding_cache_survives_a_restart(tmp_path):
    path = tmp_path / "cache.sqlite"
    cache = EmbeddingCache(path)
    embed_with_cache(["texte"], CountingEmbedder(), cache)
    cache.close()

    reopened, embedder = EmbeddingCache(path), CountingEmbedder()
    embed_with_cache(["texte"], embedder, reopened)

    assert embedder.embedded == []
    reopened.close()


def test_only_mvp_keeps_the_mvp_documents(manifest):
    chunks = [
        chunk(),
        chunk(chunk_id="note-copie:1", document_id="note-copie", source_level=2, document_type="note_circulaire"),
    ]

    assert [c.document_id for c in select_mvp_chunks(chunks, manifest)] == ["cgi-2026"]


def test_cache_only_computes_embeddings_without_a_database(tmp_path, manifest, monkeypatch):
    chunks_path = tmp_path / "cgi.jsonl"
    chunks_path.write_text(chunk().model_dump_json() + "\n", encoding="utf-8")
    cache_path = tmp_path / "cache.sqlite"
    monkeypatch.chdir(tmp_path)  # aucun .env local ne doit influencer le test
    monkeypatch.setenv("JULIA_EMBEDDING_MODEL", "test/hashing")
    monkeypatch.delenv("JULIA_DATABASE_URL", raising=False)

    args = ["--chunks", str(chunks_path), "--manifest", str(tmp_path / "manifest.yaml")]
    assert main([*args, "--cache-only", "--cache", str(cache_path)]) == 0

    cache = EmbeddingCache(cache_path)
    assert len(cache.get_many([EmbeddingCache.key("test/hashing", embedding_text(chunk()))])) == 1
    cache.close()


def load_manifest_without(document_id, manifest):
    return type(manifest)(manifest.source_root, {k: v for k, v in manifest.entries.items() if k != document_id})
