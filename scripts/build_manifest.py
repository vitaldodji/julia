"""Enrichit le manifeste du corpus avec les PDF d'un dossier.

Les entrées existantes (reconnues par leur empreinte SHA-256) sont conservées telles quelles, avec leurs
corrections humaines. Les nouveaux documents reçoivent des propositions à relire : domaine, pays, type,
niveau de source, année, présence d'une couche texte, doublons. Rien n'est écrit sans --write.

Usage :
    python scripts/build_manifest.py "dossier/des/pdf"            # aperçu des ajouts
    python scripts/build_manifest.py "dossier/des/pdf" --write    # mise à jour du manifeste
Dépendance : pymupdf (requirements-pipeline.txt) pour détecter la couche texte.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
import unicodedata
from collections.abc import Callable
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "metadata" / "corpus_manifest.yaml"
HEADER = "# Manifeste du corpus Vitalia — niveaux et types à valider (level_confirmed: false)\n"

_DOMAINS = [
    ("fiscal", ("fiscal", "impot", "tva", "dgi", "cgi", "taxe", "mecef")),
    ("comptable", ("comptab", "syscohada", "syscebnl", "plan des comptes")),
    ("social", ("social", "travail", "cnss", "sociale")),
    ("ong_association", ("ong", "association")),
]
_TYPES = [
    ("acte_uniforme", ("acte uniforme", "acte additionnel")),
    ("code_ou_loi", ("code", "loi")),
    ("arrete_ou_acte", ("arrete", "decret", "ordonnance")),
    ("note_circulaire", ("circulaire", "note")),
    ("procedure_dgi", ("procedure",)),
    ("doctrine_administrative", ("doctrine",)),
    ("guide", ("guide", "manuel", "repertoire")),
]
_LEVELS = {"acte_uniforme": 1, "code_ou_loi": 1, "arrete_ou_acte": 1, "note_circulaire": 2, "procedure_dgi": 2,
           "doctrine_administrative": 3, "guide": 3}


def normalize(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.lower())
    return " ".join(re.sub(r"[^a-z0-9]+", " ", "".join(c for c in folded if not unicodedata.combining(c))).split())


def slugify(text: str, max_length: int = 70) -> str:
    return normalize(text).replace(" ", "-")[:max_length].strip("-")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def pdf_has_text_layer(path: Path, pages: int = 3, min_chars: int = 200) -> bool:
    import fitz  # pymupdf

    with fitz.open(path) as document:
        text = "".join(document[i].get_text() for i in range(min(pages, document.page_count)))
    return len(text.strip()) >= min_chars


def _first_match(text: str, table: list[tuple[str, tuple[str, ...]]], default: str) -> str:
    for value, keywords in table:
        if any(re.search(rf"\b{re.escape(keyword)}", text) for keyword in keywords):
            return value
    return default


def propose_entry(relative_path: Path, sha256: str, has_text_layer: bool, taken_ids: set[str]) -> dict[str, Any]:
    """Entrée proposée pour un nouveau document : tout est à relire (level_confirmed: false)."""
    text = normalize(" ".join(relative_path.with_suffix("").parts))
    domain = _first_match(text, _DOMAINS, "a_classer")
    document_type = _first_match(text, _TYPES, "autre")
    country = "OHADA" if re.search(r"\bohada\b|acte uniforme", text) else (
        "CEDEAO" if "cedeao" in text else "UEMOA" if "uemoa" in text else "BJ")
    year = re.search(r"\b(19|20)\d{2}\b", text)
    document_id = slugify(relative_path.stem)
    if document_id in taken_ids:
        document_id = f"{document_id}-{sha256[:6]}"
    taken_ids.add(document_id)
    return {
        "id": document_id,
        "path": relative_path.as_posix(),
        "title": relative_path.stem,
        "domain": domain,
        "country": country,
        "organization": "",
        "document_type": document_type,
        "source_level": _LEVELS.get(document_type, 4),
        "parser": "cgi" if "code general des impots" in text else "ohada" if country == "OHADA" else "generic",
        "level_confirmed": False,
        "version_label": year.group(0) if year else None,
        "status": "a_verifier",
        "has_text_layer": has_text_layer,
        "in_mvp": domain == "fiscal",
        "sha256": sha256,
        "duplicate_of": None,
        "notes": "Ajouté automatiquement : domaine, type, niveau, statut et version à vérifier.",
    }


def build_manifest(
    source_dir: Path,
    existing: dict[str, Any],
    detect_text_layer: Callable[[Path], bool] = pdf_has_text_layer,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Renvoie (manifeste fusionné, nouvelles entrées). Les entrées existantes ne sont pas modifiées."""
    entries = list(existing.get("entries", []))
    first_by_hash = {entry["sha256"]: entry["id"] for entry in entries if entry.get("sha256")}
    taken_ids = {entry["id"] for entry in entries}
    added = []
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() != ".pdf":
            continue
        sha256 = sha256_of(path)
        if sha256 in first_by_hash:
            continue  # déjà dans le manifeste, ou copie exacte d'un fichier déjà ajouté
        entry = propose_entry(path.relative_to(source_dir), sha256, detect_text_layer(path), taken_ids)
        first_by_hash[sha256] = entry["id"]
        entries.append(entry)
        added.append(entry)
    return {"source_root": existing.get("source_root", ""), "entries": entries}, added


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--write", action="store_true", help="écrire le manifeste mis à jour")
    args = parser.parse_args()

    existing = yaml.safe_load(args.manifest.read_text(encoding="utf-8")) if args.manifest.exists() else {}
    manifest, added = build_manifest(args.source_dir, existing or {})
    for entry in added:
        print(f"+ {entry['id']} | {entry['domain']} | {entry['document_type']} | niveau {entry['source_level']} "
              f"| texte : {'oui' if entry['has_text_layer'] else 'non (OCR)'}")
    print(f"{len(added)} document(s) ajouté(s), {len(manifest['entries'])} au total.")
    if args.write:
        body = yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False, width=120)
        args.manifest.write_text(HEADER + body, encoding="utf-8")
        print(f"Manifeste écrit : {args.manifest}")
    elif added:
        print("Aperçu seulement : relancer avec --write pour enregistrer.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main())
