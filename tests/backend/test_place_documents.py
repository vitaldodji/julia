import hashlib

from scripts.place_documents import place_documents


def test_documents_are_placed_by_content_whatever_their_name(tmp_path):
    downloaded = tmp_path / "telechargement" / "dossier renommé"
    downloaded.mkdir(parents=True)
    content = b"%PDF-1.7 code general des impots"
    (downloaded / "copie (1).pdf").write_bytes(content)
    manifest = tmp_path / "manifest.yaml"
    manifest.write_text(
        f"""
source_root: ressources
entries:
- id: cgi-2026
  path: Fiscal/CODE/cgi-2026.pdf
  title: cgi
  domain: fiscal
  country: BJ
  document_type: code_ou_loi
  source_level: 1
  status: en_vigueur
  has_text_layer: true
  sha256: "{hashlib.sha256(content).hexdigest()}"
- id: absent
  path: Fiscal/absent.pdf
  title: absent
  domain: fiscal
  country: BJ
  document_type: guide
  source_level: 3
  status: en_vigueur
  has_text_layer: true
  sha256: "{"0" * 64}"
""",
        encoding="utf-8",
    )
    raw = tmp_path / "raw"

    placed, missing = place_documents(tmp_path / "telechargement", raw, manifest)

    assert placed == ["cgi-2026"]
    assert missing == ["absent"]
    assert (raw / "ressources" / "Fiscal" / "CODE" / "cgi-2026.pdf").read_bytes() == content
