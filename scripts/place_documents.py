"""Range les PDF téléchargés (dossier Drive, archive…) aux chemins attendus par le manifeste.

Chaque fichier est reconnu par son empreinte SHA-256, quel que soit son nom ou son dossier d'origine.
Usage : python scripts/place_documents.py <dossier téléchargé> [--raw-dir data/raw]
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def place_documents(source_dir: Path, raw_dir: Path, manifest_path: Path) -> tuple[list[str], list[str]]:
    """Copie chaque document du manifeste trouvé dans `source_dir`. Renvoie (placés, manquants)."""
    from backend.indexing.manifest import load_manifest

    manifest = load_manifest(manifest_path)
    by_hash = {sha256_of(path): path for path in source_dir.rglob("*") if path.is_file()}
    placed, missing = [], []
    for entry in manifest.entries.values():
        found = by_hash.get(entry.sha256 or "")
        if found is None:
            missing.append(entry.id)
            continue
        target = raw_dir / manifest.file_path(entry)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(found, target)
        placed.append(entry.id)
    return placed, missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--raw-dir", type=Path, default=ROOT / "data" / "raw")
    parser.add_argument("--manifest", type=Path, default=ROOT / "data" / "metadata" / "corpus_manifest.yaml")
    args = parser.parse_args()

    placed, missing = place_documents(args.source_dir, args.raw_dir, args.manifest)
    print(f"{len(placed)} documents placés dans {args.raw_dir}, {len(missing)} introuvables.")
    for document_id in missing:
        print(f"  introuvable : {document_id}")
    return 0 if placed else 1


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main())
