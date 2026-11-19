#!/usr/bin/env python3
"""The gate scripts/release-ios.sh puts before every App Store build, upload or submission.

It runs the vendored app-store-compliance guard (.agents/skills/app-store-compliance, see its VENDORED.md)
and fails when a finding at or above --fail-on is not a known false positive (appstore-guard-known.json).
The App Store's counterpart of the preflight gate on the Play side.

    appstore_guard_gate.py [--project DIR] [--fail-on critical|high|medium] [--all-platforms] [--tree] [--raw]

How the guard is run: standalone, with the project path as its argument and stdin closed (so it can never
take its hook mode). By default it scans a SNAPSHOT of the app's own sources, not the checkout: the guard
has no exclude option and greps every .json/.md-adjacent file under the root, including the vendored skill's
own rule files (their regexes then "match" themselves: ODR, ATT, donation links, geofencing, dynamic code
loading, QUERY_ALL_PACKAGES and the removed age-rating endpoint were all that). The snapshot is the files
git lists (tracked and untracked-but-not-ignored) minus EXCLUDED_TOP and EXCLUDED_PREFIXES (agent folders, docs, dev scripts, the
website, store assets, mocks, the lockfile). --tree scans the project folder as it is, which is what running the guard by hand does.

The guard checks Apple, Google Play and web at once. For an App Store release the gate counts only the
findings that are about iOS: ids starting GOOGLE-, ANDROID- or WEB- and findings in android/ are still printed
(marked "other store") but do not fail it. --all-platforms counts them too.

Every finding is printed, known ones marked with their reason, so nothing is hidden; only the exit code
ignores the known ones. A known entry matches by the guard's finding id and, when it names a "file", only
when the finding's file starts with it. Exit 0: nothing else reaches --fail-on. 1: something does. 2: the
guard did not scan (missing, NOT CHECKED, or its report format changed), so nothing is cleared.
"""

import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
# The two env overrides exist for the tests (a fake guard and a throwaway known-findings file).
GUARD = Path(os.environ.get("APPSTORE_GUARD_SCRIPT") or ROOT / ".agents/skills/app-store-compliance/agent-os/hooks/app-store-compliance-guard.sh")
KNOWN = Path(os.environ.get("APPSTORE_GUARD_KNOWN") or HERE / "appstore-guard-known.json")
RANK = {"medium": 0, "high": 1, "critical": 2}
HEAD = re.compile(r"^  \[(CRITICAL|HIGH|MEDIUM)\]\s+(\S+)\s+(.*)$")
STALE_DAYS = 180

# Top-level folders that never ship in the app binary (or are the guard's own rules). Left out of the snapshot.
EXCLUDED_TOP = {
    ".agents": "the vendored guard: its rule files contain every pattern it looks for",
    ".claude": "agent skills and notes (documentation with example URLs and code)",
    ".codex": "agent configuration",
    ".github": "CI configuration",
    "docs": "documentation",
    "doc": "documentation",
    "scripts": "developer tooling, never in the app",
    "promo-video": "separate package, not in the app",
    "screenshots": "store and website captures",
    "layout-audit-report": "generated",
    "public": "the website's static files",
    "tests": "Playwright suites",
}
# Path prefixes (relative to the project) left out as well: the public website is not part of any store
# submission (the guard's WEB-* checks are about it), and these are test doubles, lint rules and the lockfile
# (whose dependency names are matched as if they were calls).
EXCLUDED_PREFIXES = (
    "app/(website)/", "components/website/", "lang/locales/", "__mocks__/", "eslint-rules/", "package-lock.json",
)
# ... except what the guard looks for as proof: the Universal Links / App Links association files.
KEPT_PREFIXES = ("public/.well-known/",)
# What the guard reads (its own find expression), plus the files it looks up by name.
EXTENSIONS = {
    ".swift", ".m", ".h", ".kt", ".java", ".xml", ".plist", ".gradle", ".kts", ".json", ".js", ".jsx", ".ts",
    ".tsx", ".dart", ".xcconfig", ".yaml", ".yml", ".pbxproj", ".entitlements", ".html", ".xcprivacy", ".cs",
    ".rs", ".csproj", ".xaml", ".toml", ".properties", ".podspec",
}
NAMES = {"Podfile", "Podfile.lock"}


def fail(message):
    """Nothing was cleared: exit 2, which release-ios.sh treats like a failed gate."""
    print(message, file=sys.stderr)
    sys.exit(2)


def snapshot(project: Path, dest: Path) -> int:
    """Copies the app's own sources into dest. Returns the number of files."""
    listed = subprocess.run(
        ["git", "-C", str(project), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        capture_output=True, check=True,
    ).stdout.split(b"\0")
    count = 0
    for raw in listed:
        if not raw:
            continue
        rel = Path(raw.decode("utf-8", "surrogateescape"))
        src = project / rel
        posix = rel.as_posix()
        kept = posix.startswith(KEPT_PREFIXES)
        if not kept and (rel.parts[0] in EXCLUDED_TOP or posix.startswith(EXCLUDED_PREFIXES)):
            continue
        if not src.is_file():
            continue
        if not kept and src.suffix not in EXTENSIONS and src.name not in NAMES:
            continue
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
        count += 1
    return count


def parse(text):
    """The guard's findings: [{severity, id, title, file, fix}], from its text report."""
    found, cur = [], None
    for line in text.splitlines():
        m = HEAD.match(line)
        if m:
            cur = {"severity": m.group(1).lower(), "id": m.group(2), "title": m.group(3).strip(), "file": "", "fix": ""}
            found.append(cur)
        elif cur and line.startswith("      file. "):
            cur["file"] = line[len("      file. "):].strip()
        elif cur and line.startswith("      fix. "):
            cur["fix"] = line[len("      fix. "):].strip()
        elif not line.startswith("      "):
            cur = None
    return found


def other_store(f):
    return f["id"].startswith(("GOOGLE-", "ANDROID-", "WEB-")) or f["file"].startswith("android/")


def known_reason(f, known):
    for k in known:
        if k["id"] == f["id"] and f["file"].startswith(k.get("file", "")):
            return k["reason"]
    return None


def load_known():
    data = json.loads(KNOWN.read_text(encoding="utf-8"))["known"]
    today = datetime.date.today()
    for k in data:
        for key in ("id", "reason", "checked"):
            if not k.get(key):
                fail(f"appstore guard: {KNOWN.name}: an entry has no '{key}': {json.dumps(k)[:120]}")
        try:
            age = (today - datetime.date.fromisoformat(k["checked"])).days
        except ValueError:
            fail(f"appstore guard: {KNOWN.name}: '{k['id']}' has a 'checked' that is not YYYY-MM-DD.")
        if age > STALE_DAYS:
            print(f"warning: known finding {k['id']} was last checked {age} days ago ({k['checked']}); look again.",
                  file=sys.stderr)
    return data


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--project", default=str(ROOT), help="the app's folder (default: the repository root)")
    p.add_argument("--fail-on", choices=RANK, default="high")
    p.add_argument("--all-platforms", action="store_true", help="also fail on Google Play, Android and web findings")
    p.add_argument("--tree", action="store_true", help="scan the folder as it is instead of a snapshot of the app's sources")
    p.add_argument("--raw", action="store_true", help="print the guard's own report instead")
    args = p.parse_args()
    if not GUARD.is_file():
        fail(f"appstore guard: {GUARD} is missing (the vendored app-store-compliance skill)")
    project = Path(args.project).resolve()
    known = load_known()

    tmp = None
    scan_dir = project
    try:
        if not args.tree:
            tmp = Path(tempfile.mkdtemp(prefix="musclog-guard-"))
            n = snapshot(project, tmp)
            if n == 0:
                fail("appstore guard: the snapshot has no files (is this a git checkout?); nothing is cleared.")
            scan_dir = tmp
        # The path argument puts the guard in standalone mode; stdin is closed so it can never take hook mode.
        r = subprocess.run(["bash", str(GUARD), str(scan_dir)], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    out = (r.stdout + r.stderr).replace(str(scan_dir) + "/", "")
    if args.raw:
        print(out, end="")
        print(f"(guard exit code {r.returncode})")
        sys.exit(r.returncode)
    if "NOT CHECKED." in out or not re.search(r"^Summary\. critical=\d+", out, re.M):
        print(out, end="", file=sys.stderr)
        fail("appstore guard: the guard did not scan the project; nothing is cleared.")

    findings = parse(out)
    summary = re.search(r"^Summary\. critical=(\d+) high=(\d+) medium=(\d+)", out, re.M)
    if summary and sum(map(int, summary.groups())) != len(findings):
        print(out, end="", file=sys.stderr)
        fail(f"appstore guard: read {len(findings)} findings but the guard counted {sum(map(int, summary.groups()))}; "
                 "its report format changed, so nothing is cleared. Update parse() in this script.")

    print(f"app-store-compliance guard on {project} ({'folder as it is' if args.tree else 'snapshot of the app sources'})")
    blocking = 0
    for f in sorted(findings, key=lambda f: -RANK[f["severity"]]):
        reason = known_reason(f, known)
        skipped = other_store(f) and not args.all_platforms
        gate = RANK[f["severity"]] >= RANK[args.fail_on] and not skipped
        mark = "known" if reason else ("BLOCKS" if gate else ("other store" if skipped else ""))
        print(f"  [{f['severity'].upper():8}] {f['id']}: {f['title']}" + (f"  <- {mark}" if mark else ""))
        if f["file"]:
            print(f"             file: {f['file']}")
        if reason:
            print(f"             known: {reason}")
        elif f["fix"]:
            print(f"             fix: {f['fix']}")
        if gate and not reason:
            blocking += 1
    if blocking:
        print(f"appstore guard: {blocking} finding(s) at or above {args.fail_on} that are not known false positives.\n"
              f"  Fix them, or, if one was checked against the code and is not a problem, add it to {KNOWN.name} "
              "with the reason and the date.")
        sys.exit(1)
    print(f"appstore guard: nothing at or above {args.fail_on} apart from known false positives "
          f"({len(findings)} finding(s) printed above).")


if __name__ == "__main__":
    main()
