"""Refresh Umami's GeoLite2 City data without changing its application image.

Requires maxminddb==3.2.0. Run under the production deployment lock, then
recreate only Umami to clear its in-memory lookup cache. See docs/runbooks.md.
"""

import hashlib
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import maxminddb

# The same fallback source used by Umami v3.0.3's scripts/build-geo.js.
URL = "https://raw.githubusercontent.com/GitSquared/node-geolite2-redist/master/redist/GeoLite2-City.tar.gz"
NAME = "GeoLite2-City.mmdb"


def refresh(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    current = destination / NAME
    with tempfile.TemporaryDirectory(dir=destination) as temporary:
        stage = Path(temporary)
        archive = stage / "download.tar.gz"
        with urllib.request.urlopen(URL, timeout=60) as response, archive.open("wb") as output:
            shutil.copyfileobj(response, output)
        candidate = stage / NAME
        with tarfile.open(archive) as source:
            entries = [entry for entry in source if entry.isfile() and Path(entry.name).name == NAME]
            if len(entries) != 1:
                raise ValueError("Expected one GeoLite2 City database")
            with source.extractfile(entries[0]) as data, candidate.open("wb") as output:
                shutil.copyfileobj(data, output)
        with maxminddb.open_database(str(candidate)) as database:
            metadata = database.metadata()
            if metadata.database_type != "GeoLite2-City" or metadata.ip_version != 6:
                raise ValueError("Unexpected GeoIP database type")
            if not time.time() - 30 * 86400 < metadata.build_epoch < time.time() + 86400:
                raise ValueError("GeoIP database must be from the last 30 days")
            if not database.get("8.8.8.8"):
                raise ValueError("GeoIP lookup validation failed")
        built = datetime.fromtimestamp(metadata.build_epoch, timezone.utc).isoformat()
        with candidate.open("rb") as data:
            checksum = hashlib.file_digest(data, "sha256").hexdigest()
        if current.exists():
            with maxminddb.open_database(str(current)) as previous:
                if previous.metadata().build_epoch >= metadata.build_epoch:
                    print("Installed database is already as recent; left unchanged")
                    return
            shutil.copy2(current, destination / f"{NAME}.previous")
        candidate.chmod(0o644)
        candidate.replace(current)
        print(f"Installed GeoLite2-City built {built}; SHA-256 {checksum}")


if __name__ == "__main__":
    refresh(Path(sys.argv[1]))
