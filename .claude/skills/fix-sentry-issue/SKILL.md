---
name: fix-sentry-issue
description: >-
  Pick ONE Sentry issue from sentry-issues/*/*.json, work out whether it is a real bug, already
  fixed, or a false positive, deal with it, then delete that JSON file. Covers the app (Sentry
  project "workout") and the Premium Worker ("musclog-premium-worker"). Use when asked to "fix a
  sentry issue", "work through the sentry issues", or "triage sentry-issues".
---

# Fix one Sentry issue

Handle exactly one issue per run, then stop. The user runs the skill again for the next one.

The folder `sentry-issues/` (git-ignored, may hold user data such as location and device models) is
filled by `python3 scripts/fetch_sentry_issues.py` (it needs `SENTRY_DEV_AUTH_TOKEN` in `.env`).
Layout: `sentry-issues/<project>/<SHORT-ID>.json`, each file `{"issue": ..., "latestEvent": ...}`
(issue metadata plus the newest event with stack trace, tags, release and contexts).

## Steps

1. **List and pick.** `find sentry-issues -name '*.json'`. If none, say so and stop.
   Pick any one; prefer one whose latest event has `environment` `production`, then the highest
   `issue.count` (tie: most recent `lastSeen`). Do not ask the user which. Tell them which you
   picked and why in one line.
2. **Read it** with a short `python3 -I` script rather than dumping the whole file: title, culprit,
   count, firstSeen/lastSeen, release, level, tags, exception frames (innermost last), and any
   `contexts`/`context` the code might use. `latestEvent` can be `null`. Never repeat user data (the
   `user` field, which Sentry fills with a location, or anything a message quotes) in commits, docs
   or your summary. Both projects strip events before sending, so do not expect breadcrumbs:
   - **App** (`sentry-init.ts`): of the contexts it keeps the app version and device model, and it
     runs messages through `scrubErrorText` (`[secret]`, `[email]`, `[text]`, `{…}`, cut at 300
     characters). The `context` tag is what the caller passed to `handleError`, and some reports add
     their own tags (`premium_stage`, `premium_failure`).
   - **Worker** (`services/premium-worker/src/sentry.ts`): exception messages are blank and there is
     no request. What identifies an event is the exception type, the stack and the tags `route`,
     `status`, `code`, `severity`, `upstream`. For a signal from `src/logReport.ts` the exception
     type is the log event's `code`.
3. **Locate the code** that produced the event. Grep for the `context` or `code` tag first, then the
   message text (without the variable parts and the scrub placeholders) and the function names. The
   `workout` project is the app and website (repo root); `musclog-premium-worker` is
   `services/premium-worker/`. Frames may point into a bundle (`index.bundle`, wrangler's
   `index.js`) with line numbers that match no source file.
   Check the event against the code it ran:
   - App releases look like `com.werules.logger@<version>+<build>` (native) or
     `Musclog - Lift, Log, Repeat@<version>` (web). The version may be older than HEAD: find its
     commit with `git log -S'"version": "<version>"' -- package.json` (the oldest hit added it).
   - Worker events may carry no release: compare `firstSeen`/`lastSeen` with the commit dates.
4. **Decide the verdict**, from evidence in the code and git history (`git log -S'<text>'`,
   `git log -- <file>`). `docs/FIXES.md`, `docs/PREMIUM_WORKER.md` and code comments are leads to
   check, not proof:
   - **Real bug, not fixed**: fix it (see below).
   - **Already fixed**: a commit after the event's release touches this path and the failing case can
     no longer happen. Name the commit. If you cannot show how the fix covers this exact event, it
     is not "already fixed".
   - **False positive / expected**: the report is a diagnostic or log line, a network failure
     outside our control, something the person can fix themselves (an invalid or exhausted AI key),
     an OS-initiated app end, noise from a development build, etc. Before declaring it, check the
     code to see whether it is reported at too high a level or without need; if reporting it is
     itself the defect (noise), fix the reporting (`sendToSentry: false` on `handleError`, a lower
     level, a filter) rather than just dismissing it. Say plainly when you are not sure.
   - **Needs the user** (mostly Worker signals): a real operational fault with no code fix, such as
     an upstream provider problem, funding or an open breaker. Say what they have to check or do;
     do not do it for them.
5. **If fixing:**
   - Follow `AGENTS.md`, including how to delegate. Work in this checkout on the current branch.
   - Reproduce it with a test that fails first, then fix the root cause, small and in the style of
     the surrounding code. If you cannot reproduce it, say so instead of guessing.
   - Check the platform variants (`.web`, `.ios`, `.android`, `.native` files) and fix every one
     that has the problem.
   - New or changed copy goes into every locale.
   - Keep the privacy promises on what reaches Sentry: tags only, never a reply, prompt, food name,
     path or key; the Worker stays content-free.
   - Record a non-obvious production fix in `docs/FIXES.md`.
   - Validate: the relevant Jest suites, `npm run typecheck`, `npm run lint:eslint`,
     `npx prettier --check` on changed files, and the translation checks when copy changed. For the
     Worker: `npm --prefix services/premium-worker test` and
     `npm --prefix services/premium-worker run typecheck`. Never `npm run lint:all` (it runs
     `git add .`). Say what you ran and what you could not run (a device, iOS).
   - Do not deploy the Worker, release or publish anything. Do not commit unless the user asks.
     Offer a commit message at the end.
6. **Delete the JSON file** (`rm sentry-issues/<project>/<SHORT-ID>.json`) once the verdict is
   reached and, for a fix, the change is made. Delete only that one file. If you could not reach a
   verdict (cannot locate the code, need data you lack), keep the file and say why.
7. **Report** in a few lines: issue ID and title, verdict with the evidence (file:line or commit),
   what changed (if anything), what was verified and what was not, and that the file was deleted.

## Notes

- The Sentry issue itself stays unresolved on sentry.io; the fetch script never deletes local files,
  and re-running it will bring back the JSON if the issue is still open there. Mention the verdict so
  the user can resolve it in Sentry.
- Do not touch `.env` or print a Sentry token.
