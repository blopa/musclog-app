#!/usr/bin/env python3
"""Turns the Google Play listing into App Store Connect text: the files `asc metadata push` syncs.

`scripts/appstore.sh from-listing` runs this. The Play listing (android/play/metadata/<locale>/) is the one
place the store text is written; this only reshapes it into asc's canonical JSON:

    <out>/app-info/<locale>.json              name, subtitle, privacyPolicyUrl
    <out>/version/<version>/<locale>.json     description, promotionalText, keywords, supportUrl, marketingUrl

Field by field:
    name             title.txt                                     (30)
    description      full_description.txt, Play's <b> tags removed (4000)
    promotionalText  short_description.txt                         (170: Play's 80 always fit)
    subtitle         ios/appstore/listing-extra.json, per Apple locale (30)
    keywords         ios/appstore/listing-extra.json, per Apple locale (100, comma-separated, no spaces)
    privacyPolicyUrl, supportUrl, marketingUrl   the website's own pages (websiteRoutes.json + android/play/app.json)

Play has no subtitle or keywords, so those come from listing-extra.json ({"<apple locale>": {"subtitle": "...",
"keywords": "a,b,c"}}); a locale without them leaves the field out, so App Store Connect keeps what it has (asc
treats an omitted field as "no change"). What's new is release copy and is not touched here.

Refuses to write anything when a field is over Apple's limit or the text names another platform (App Review
2.3.10: Android, Google Play, Play Store, Wear OS ...), so a bad translation fails here and not halfway through
a push. One platform term is mapped instead of refused: Play's "Health Connect" (Android's health store) becomes
"Apple Health", which is what the iOS app syncs with (HealthKit). Every such replacement is printed.
Only the locales' own files are written; any other file already in the folder (from `appstore.sh pull`) stays,
and so do fields this script does not manage.

Usage: appstore-listing-metadata.py [--version X.Y.Z] [--listing DIR] [--extra FILE] [OUT_DIR]
       (default OUT_DIR ios/appstore/metadata; version: the version folder already there, else expo.version)
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "ios" / "appstore" / "metadata"
DEFAULT_LISTING = ROOT / "android" / "play" / "metadata"
DEFAULT_EXTRA = ROOT / "ios" / "appstore" / "listing-extra.json"
PLAY_APP_JSON = ROOT / "android" / "play" / "app.json"
ROUTES = ROOT / "components" / "website" / "websiteRoutes.json"

# Play's locale -> App Store Connect's. Apple names some languages without a region ("it", "pl", "ru", "tr").
LOCALES = {
    "en-US": "en-US", "en-GB": "en-GB", "en-AU": "en-AU", "en-CA": "en-CA",
    "es-ES": "es-ES", "es-419": "es-MX", "es-US": "es-MX",
    "nl-NL": "nl-NL", "pt-BR": "pt-BR", "pt-PT": "pt-PT", "ru-RU": "ru",
    "de-DE": "de-DE", "fr-FR": "fr-FR", "fr-CA": "fr-CA", "it-IT": "it", "pl-PL": "pl", "tr-TR": "tr",
    "ja-JP": "ja", "ko-KR": "ko", "zh-CN": "zh-Hans", "zh-TW": "zh-Hant", "zh-HK": "zh-Hant",
    "sv-SE": "sv", "da-DK": "da", "fi-FI": "fi", "nb-NO": "no", "cs-CZ": "cs", "uk": "uk", "ar": "ar-SA",
    "he-IL": "he", "hi-IN": "hi", "id": "id", "th": "th", "vi": "vi", "el-GR": "el", "hu-HU": "hu",
    "ro": "ro", "sk": "sk", "ca": "ca", "hr": "hr", "ms": "ms",
}
LIMITS = {"name": 30, "subtitle": 30, "keywords": 100, "promotionalText": 170, "description": 4000}

# Other platforms by name, which App Review rejects in App Store text (2.3.10).
OTHER_PLATFORMS = re.compile(
    r"\b(Android|Google Play|Play Store|Play Console|Google Fit|Wear OS|Huawei|AppGallery|Samsung Galaxy Store|"
    r"Windows Phone)\b",
    re.I,
)
# Android's health store, named for what the iOS app does instead.
HEALTH_CONNECT = re.compile(r"Health[ -]Connect")
HEALTH_REPLACEMENT = "Apple Health"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def plain_description(text: str) -> str:
    """Play's description allows <b>, <i>, <u>, <br>; App Store text is plain."""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    return re.sub(r"</?[a-zA-Z][^>]*>", "", text).strip()


def site_urls():
    """(support, marketing, privacy) from the website's own registry; one place per URL."""
    base = json.loads(read(PLAY_APP_JSON)).get("contactWebsite") or ""
    routes = json.loads(read(ROUTES))
    base = base.rstrip("/")
    for key in ("contact", "privacy"):
        if key not in routes or not routes[key].get("path"):
            sys.exit(f"error: {ROUTES} has no '{key}' route.")
    if not base.startswith("https://"):
        sys.exit(f"error: android/play/app.json contactWebsite is '{base}'; need an https:// site.")
    return base + routes["contact"]["path"], base + "/", base + routes["privacy"]["path"]


def app_version():
    app = json.loads(read(ROOT / "app.json"))
    return app["expo"]["version"]


def version_dir(out_dir: Path, version):
    """Where asc keeps this version's files: version/<X.Y.Z>/. A pull may have made a different folder."""
    existing = sorted(p for p in (out_dir / "version").glob("*") if p.is_dir()) if (out_dir / "version").is_dir() else []
    if version:
        return out_dir / "version" / version
    if len(existing) == 1:
        return existing[0]
    if len(existing) > 1:
        sys.exit(f"error: more than one version folder in {out_dir / 'version'}; pass --version X.Y.Z.")
    return out_dir / "version" / app_version()


def build(listing_dir: Path, extra: dict):
    """({apple locale: (app_info, version)}, problems, notes)."""
    support, marketing, privacy = site_urls()
    files, problems, notes = {}, [], []
    locales = sorted(p.name for p in listing_dir.iterdir() if p.is_dir())
    if not locales:
        sys.exit(f"error: no locale folders in {listing_dir}")
    for play_loc in locales:
        apple = LOCALES.get(play_loc)
        if not apple:
            problems.append(f"{play_loc}: no App Store locale for it (add it to LOCALES)")
            continue
        d = listing_dir / play_loc
        sources = {"name": d / "title.txt", "promotionalText": d / "short_description.txt", "description": d / "full_description.txt"}
        fields = {}
        for key, path in sources.items():
            if not path.is_file():
                problems.append(f"{play_loc}: missing {path.name}")
                continue
            fields[key] = plain_description(read(path)) if key == "description" else read(path).strip()
        mine = extra.get(apple) or {}
        for key in ("subtitle", "keywords"):
            if mine.get(key):
                fields[key] = ",".join(w.strip() for w in mine[key].split(",") if w.strip()) if key == "keywords" else mine[key].strip()
        for key, text in list(fields.items()):
            hits = HEALTH_CONNECT.findall(text)
            if hits:
                fields[key] = HEALTH_CONNECT.sub(HEALTH_REPLACEMENT, text)
                notes.append(f"{play_loc}: {key}: 'Health Connect' -> '{HEALTH_REPLACEMENT}' ({len(hits)}x)")
        for key, text in fields.items():
            if len(text) > LIMITS[key]:
                problems.append(f"{play_loc}: {key} is {len(text)} characters, the App Store allows {LIMITS[key]}")
            m = OTHER_PLATFORMS.search(text)
            if m:
                problems.append(f"{play_loc}: {key} names another platform ('{m.group(0)}'), which App Review rejects (2.3.10)")
            if key == "keywords" and re.search(r"\s", text):
                problems.append(f"{play_loc}: keywords hold whitespace; use a,b,c")
        app_info = {k: fields[k] for k in ("name", "subtitle") if k in fields}
        app_info["privacyPolicyUrl"] = privacy
        version = {k: fields[k] for k in ("description", "keywords", "promotionalText") if k in fields}
        version.update({"supportUrl": support, "marketingUrl": marketing})
        files[apple] = (app_info, version)
    seen = {}
    for play_loc in locales:
        apple = LOCALES.get(play_loc)
        if apple in seen:
            problems.append(f"{play_loc} and {seen[apple]} both map to the App Store locale {apple}")
        seen[apple] = play_loc
    return files, problems, notes


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("out", nargs="?", default=str(DEFAULT_OUT))
    p.add_argument("--version")
    p.add_argument("--listing", default=str(DEFAULT_LISTING))
    p.add_argument("--extra", default=str(DEFAULT_EXTRA))
    args = p.parse_args()
    out_dir, extra_path = Path(args.out), Path(args.extra)
    extra = json.loads(read(extra_path)) if extra_path.is_file() else {}
    files, problems, notes = build(Path(args.listing), extra)
    if problems:
        sys.exit("error: the Play listing is not ready for the App Store:\n  " + "\n  ".join(problems))

    vdir = version_dir(out_dir, args.version)
    (out_dir / "app-info").mkdir(parents=True, exist_ok=True)
    vdir.mkdir(parents=True, exist_ok=True)
    for loc, (app_info, version) in files.items():
        for path, content in ((out_dir / "app-info" / f"{loc}.json", app_info), (vdir / f"{loc}.json", version)):
            # Keep fields this script does not manage (whatsNew ... from a pull).
            old = json.loads(read(path)) if path.exists() else {}
            old.update(content)
            path.write_text(json.dumps(old, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for n in notes:
        print("note:", n)
    lacking = sorted(l for l, (a, v) in files.items() if "subtitle" not in a or "keywords" not in v)
    print(f"{len(files)} locales -> {out_dir} (version folder {vdir.relative_to(out_dir)}): {', '.join(sorted(files))}")
    if lacking:
        print(f"note: no subtitle / keywords yet for {', '.join(lacking)}; add them to {extra_path.relative_to(ROOT) if extra_path.is_relative_to(ROOT) else extra_path}; App Store Connect keeps its own meanwhile.")


if __name__ == "__main__":
    main()
