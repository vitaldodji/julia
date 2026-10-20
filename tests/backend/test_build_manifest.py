import hashlib

from scripts.build_manifest import build_manifest


def test_new_documents_are_proposed_and_existing_entries_kept(tmp_path):
    source = tmp_path / "docs"
    (source / "Social").mkdir(parents=True)
    known = b"%PDF cgi deja connu"
    (source / "cgi.pdf").write_bytes(known)
    (source / "2020-ARRETE fixant les taux.pdf").write_bytes(b"%PDF arrete")
    (source / "copie de l'arrete.pdf").write_bytes(b"%PDF arrete")
    (source / "Social" / "Code du travail.pdf").write_bytes(b"%PDF code du travail")
    existing = {
        "source_root": "ressources",
        "entries": [{"id": "cgi-2026", "sha256": hashlib.sha256(known).hexdigest(), "level_confirmed": True,
                     "status": "en_vigueur", "notes": "relu par Vital"}],
    }

    manifest, added = build_manifest(source, existing, detect_text_layer=lambda path: "Code" in path.name)

    assert manifest["entries"][0] == existing["entries"][0]
    assert len(added) == 2
    arrete = next(entry for entry in added if entry["document_type"] == "arrete_ou_acte")
    assert arrete["domain"] == "a_classer" and arrete["source_level"] == 1 and arrete["version_label"] == "2020"
    assert arrete["status"] == "a_verifier" and arrete["level_confirmed"] is False
    travail = next(entry for entry in added if entry["domain"] == "social")
    assert travail["document_type"] == "code_ou_loi" and travail["has_text_layer"] is True
    assert travail["in_mvp"] is False and travail["path"] == "Social/Code du travail.pdf"
