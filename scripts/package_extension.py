"""Build a Chrome Web Store ZIP with manifest.json at the archive root."""

import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extension"
manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
output_dir = ROOT / "dist"
output_dir.mkdir(exist_ok=True)
output = output_dir / f"nfse-analyzer-chrome-{version}.zip"

files = [
    EXTENSION / "manifest.json",
    EXTENSION / "README.md",
    EXTENSION / "background.js",
    EXTENSION / "popup.html",
    EXTENSION / "popup.js",
    EXTENSION / "site-bridge.js",
    *(EXTENSION / "icons").glob("*.png"),
]
for path in files:
    if not path.is_file():
        raise FileNotFoundError(path)

with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as package:
    for path in files:
        package.write(path, path.relative_to(EXTENSION).as_posix())

with zipfile.ZipFile(output) as package:
    if "manifest.json" not in package.namelist():
        raise RuntimeError("manifest.json is missing from archive root")
    if package.testzip():
        raise RuntimeError("The extension archive is corrupt")

print(output)
