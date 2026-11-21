"""Build the static study site from an allowlist, or preview it on localhost."""
import argparse
import csv
import hashlib
import html
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parent
ASSETS = ("index.html", "study.css", "review.js", "schedule.js", "sets.js", "library.js", "inat.js", "artwork.js", "icons/index.json", "draw.js", "settings.js", "answers.js", "offline.js", "sw.js", "set.json", "display.ttf", "Barlow-OFL.txt", "moth.png", "beetle.png", "lens.png")


def build(output):
    study = ROOT / "study"
    (output / "icons").mkdir()
    for name in json.loads((study / "icons/index.json").read_text()):
        if not re.fullmatch(r"[a-z]+\.png", name):
            raise ValueError(f"Unexpected icon path: {name}")
        shutil.copyfile(study / "icons" / name, output / "icons" / name)
    for name in ASSETS:
        shutil.copyfile(study / name, output / name)
    (output / "photos").mkdir()
    manifest = json.loads((study / "set.json").read_text())
    for taxon in manifest["taxa"]:
        for photo in taxon["photos"]:
            path = photo["src"]
            if not re.fullmatch(r"photos/[0-9]+\.jpg", path):
                raise ValueError(f"Unexpected photograph path: {path}")
            shutil.copyfile(study / path, output / path)


def add_local_pool(output):
    """Include only study fields in the loopback preview, never in a Pages build."""
    path = ROOT / "observations-819165.csv"
    if not path.is_file():
        return
    allowed = ("id", "url", "image_url", "photo_attribution", "user_name", "user_login",
               "iconic_taxon_name", "taxon_class_name", "taxon_order_name", "taxon_superfamily_name",
               "taxon_family_name", "taxon_genus_name", "taxon_species_name",
               "scientific_name", "common_name", "quality_grade")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = [field for field in allowed if field in reader.fieldnames]
        rows = [[row[field] for field in fields] for row in reader if row.get("image_url")]
    filename = f"local-pool-{digest}.json"
    (output / filename).write_text(json.dumps({"fields":fields, "rows":rows}, separators=(",", ":")))
    page = output / "index.html"
    meta = f'<meta name="local-study-pool" content="{digest}" data-file="{filename}" data-title="{html.escape(path.stem)}">'
    page.write_text(page.read_text().replace("</head>", meta + "\n</head>"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--build", type=Path, help="Write the Pages files into a new directory and exit.")
    args = parser.parse_args()
    if args.build:
        args.build.mkdir(parents=True, exist_ok=False)
        build(args.build)
        return
    with TemporaryDirectory(prefix="backyard-arcade-") as directory:
        build(Path(directory))
        add_local_pool(Path(directory))
        handler = partial(SimpleHTTPRequestHandler, directory=directory)
        with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
            print(f"Backyard Moth Families: http://127.0.0.1:{args.port}/", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    main()
