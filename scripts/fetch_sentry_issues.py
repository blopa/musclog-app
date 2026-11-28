#!/usr/bin/env python3
"""Save every open Sentry issue as JSON under sentry-issues/<project>/<SHORT-ID>.json.

Each file holds {"issue": <issue>, "latestEvent": <event>}: the issue as the API lists it plus its
newest event with the full stack trace and breadcrumbs (what the "JSON" export on an issue page
gives). Standard library only; nothing is deleted, files of issues you have since resolved stay.

Environment (or the same lines in .env at the repo root, which git ignores):
  SENTRY_DEV_AUTH_TOKEN  Sentry token with Issue & Event: Read. Not SENTRY_AUTH_TOKEN, which the
                         builds use to upload source maps
  SENTRY_ORG             Sentry organization slug, default werules
  SENTRY_BASE_URL        Sentry API host, default https://de.sentry.io (the EU region)

Usage:
  python3 scripts/fetch_sentry_issues.py                  # the app and the Premium Worker
  python3 scripts/fetch_sentry_issues.py [--project SLUG ...] [--query Q] [--out DIR]
  python3 scripts/fetch_sentry_issues.py --all-projects   # every project of the organization

Without --project, the default is DEFAULT_PROJECTS below.

The files can hold user data (location, device models, whatever an error message quotes). The folder is
git-ignored and left out of EAS uploads; keep it so.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# Used when no --project is given (and --all-projects is not).
DEFAULT_PROJECTS = [
    "workout",  # the app (app.json, @sentry/react-native/expo)
    "musclog-premium-worker",  # services/premium-worker
]
DEFAULT_ORG = "werules"


def load_dotenv(path):
    """KEY=VALUE lines of a .env file into os.environ, without overriding what is already set."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        match = re.match(r"\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$", line)
        if match and not line.lstrip().startswith("#"):
            os.environ.setdefault(match.group(1), match.group(2).strip("\"'"))


def env(name, default=None, required=False):
    value = os.environ.get(name, "").strip() or default
    if required and not value:
        sys.exit(f"missing environment variable {name} (set it or put it in {REPO_ROOT / '.env'})")
    return value


def sentry_get(path, params=None):
    """GET one API path (or full URL); returns (parsed JSON, response headers). Retries on 429."""
    base = env("SENTRY_BASE_URL", "https://de.sentry.io").rstrip("/")
    url = path if path.startswith("http") else f"{base}/api/0/{path.lstrip('/')}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {env('SENTRY_DEV_AUTH_TOKEN', required=True)}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response), response.headers
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < 4:
                time.sleep(float(error.headers.get("Retry-After") or 2 ** attempt))
                continue
            said = error.read().decode(errors="replace")[:300]
            hint = {
                401: "the token is not accepted (use the Token value, not Client ID/Secret)",
                403: "the token lacks a scope for this call (Issue & Event: Read; Project/Organization: Read for the project list), or cannot see this organization",
                404: "not found: check SENTRY_ORG and SENTRY_BASE_URL (EU is de.sentry.io, US is sentry.io)",
            }.get(error.code, "")
            sys.exit(f"Sentry answered HTTP {error.code} for {url.split('?')[0]}: {said}\n{hint}")


def next_page(link_header):
    """Sentry paginates with Link: <url>; rel="next"; results="true"; cursor="..."."""
    for part in (link_header or "").split(","):
        if 'rel="next"' in part and 'results="true"' in part:
            match = re.search(r"<([^>]+)>", part)
            if match:
                return match.group(1)
    return None


def open_issues(org, query, slugs):
    """Matching issues of the named projects, or of every project when no slug is given.

    A slug goes to the per-project endpoint, which needs only Issue & Event: Read. The organization
    endpoint filters by numeric project id, and turning a slug into one needs Project: Read.
    """
    if slugs:
        targets = [(f"projects/{org}/{slug}/issues/", {}) for slug in slugs]
    else:
        targets = [(f"organizations/{org}/issues/", {"project": "-1"})]  # -1 = every project
    for url, extra in targets:
        params = {**extra, "query": query, "statsPeriod": "", "limit": "100"}  # statsPeriod "": no time window
        while url:
            page, headers = sentry_get(url, params)
            params = None  # the next-page URL carries them
            yield from page
            url = next_page(headers.get("Link"))


def safe_name(text):
    return re.sub(r"[^\w.-]", "_", text)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--project", action="append", default=[], metavar="SLUG",
                        help="only this project (repeat for several); default: the two Musclog projects")
    parser.add_argument("--all-projects", action="store_true",
                        help="every project of the organization, instead of the default two")
    parser.add_argument("--query", default="is:unresolved", help="Sentry issue search, default: is:unresolved")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "sentry-issues", help="output folder, default: sentry-issues/")
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / ".env")
    org = env("SENTRY_ORG", DEFAULT_ORG)
    env("SENTRY_DEV_AUTH_TOKEN", required=True)

    count = 0
    if args.all_projects and args.project:
        parser.error("--all-projects and --project cannot be combined")
    slugs = [] if args.all_projects else (args.project or DEFAULT_PROJECTS)

    for issue in open_issues(org, args.query, slugs):
        try:
            event, _ = sentry_get(f"organizations/{org}/issues/{issue['id']}/events/latest/")
        except SystemExit as error:  # an issue without a stored event (expired or filtered) still gets its file
            print(f"  no latest event for {issue['shortId']}: {str(error).splitlines()[0]}", file=sys.stderr)
            event = None
        folder = args.out / safe_name(issue.get("project", {}).get("slug") or "unknown")
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{safe_name(issue['shortId'])}.json"
        path.write_text(json.dumps({"issue": issue, "latestEvent": event}, indent=2, ensure_ascii=False) + "\n")
        count += 1
        print(f"{path.relative_to(args.out.parent) if args.out.parent in path.parents else path}  {issue.get('title', '')[:80]}")
    print(f"{count} issue(s) written to {args.out}")


if __name__ == "__main__":
    main()
