---
name: thermo-nuclear-code-security-review
description: Run an extremely rigorous security audit that hunts for exploitable vulnerabilities with concrete attack paths, then separately flags systemic hardening and design weaknesses. Covers OWASP Top 10 (2025), LLM/AI-app risks, and container/compose/infra exposure. Use for a thermo-nuclear security review, thermonuclear security audit, deep security audit, or an especially harsh security review.
disable-model-invocation: true
---

# Thermo-Nuclear Code Security Review

Use this skill for an unusually rigorous security review focused on **real, exploitable vulnerabilities with a concrete attack path** — and, separately and clearly ranked below them, systemic hardening and design weaknesses that make future vulnerabilities more likely.

Above all, this skill should push the reviewer to **think like an attacker who already has your source code**. Do not merely run down a checklist. Actively trace how untrusted input reaches a dangerous sink, hunt for the one missing authorization check on the one endpoint that matters, and ask "if I wanted in, where would I push?"

The bar for a *reported exploitable finding* is high: something a security engineer would confidently raise in a real PR review, with a plausible attack narrative. The bar for *thinking about* a weakness is low: consider everything, then rank ruthlessly. These are different jobs — do both, and never let a wall of low-severity hardening notes bury a real vulnerability.

## How This Differs From a Quality Review

A maintainability review asks "is this code clean?". This review asks "can this code be made to do something it should not, by someone who is not supposed to be able to?". A beautifully structured function with one unsanitized `exec` is a failure here; an ugly 300-line function with airtight input handling passes. Correctness and cleanliness are not the subject — **trust boundaries, attacker capability, and blast radius** are.

## Core Prompt

Start from this baseline:

> Perform a deep security audit of the target code.
> Identify vulnerabilities that an attacker could actually exploit, and trace the concrete path from an attacker-controlled input to the sensitive operation, data, or privilege it compromises.
> For each candidate finding, establish: who the attacker is, what they control, what trust boundary is crossed, and what they gain.
> Prioritize high-confidence, exploitable issues with a clear attack narrative over theoretical or best-practice concerns — but do not silently ignore systemic hardening and design weaknesses; report them in a clearly separated, lower-priority tier.
> Be extremely thorough and rigorous. Assume the attacker has read the source. Measure twice, cut once.

## Scope Modes

Decide scope from the invocation, then state which mode you are in at the top of your report.

- **Diff / branch mode** — when invoked on a PR, a branch, or with an argument naming a branch or commit range. Review **only the changes** and the trust boundaries they touch. Do not report pre-existing vulnerabilities unless the change makes them newly reachable or materially worse. Establish base with `git merge-base` against the default branch; if there is no remote, diff against the local base branch.
- **Full-repo mode** — when invoked with no diff context, or explicitly asked for a whole-codebase audit. Enumerate the entire attack surface: every entrypoint, every trust boundary, every secret, every externally reachable service.

If it is genuinely ambiguous, default to diff mode when a branch/PR is in play and full-repo mode otherwise, and say which you chose and why.

## Analysis Methodology

Work in explicit phases. Do not skip Phase 1 — context is what separates a real finding from noise.

**Phase 1 — Map the terrain and the trust boundaries.**
- Identify entrypoints: HTTP routes/handlers, CLI args, message consumers, webhooks, file/upload parsers, deserialization points, scheduled jobs, and inter-service calls.
- Identify trust boundaries: where does data cross from untrusted (internet, user, another tenant, a lower-privilege service) to trusted? Auth checks, network segmentation, container boundaries, and privilege transitions all define edges.
- Identify the crown jewels: secrets, credentials, PII, the ability to execute code, the ability to reach internal services, and the ability to escalate privilege.
- Learn the existing security machinery: what sanitizers, validators, auth middleware, ORM/query builders, crypto helpers, and framework protections are already in use? A finding that ignores an existing guard is a false positive.

**Phase 2 — Trace taint from source to sink.**
- For each dangerous sink (query execution, `exec`/`system`/subprocess, deserialization, file path construction, template rendering, HTML rendering, redirect, outbound request, reflection/eval), work backward: can attacker-controlled data reach it?
- For each attacker-controlled source, work forward: what sensitive operation can it influence?
- A vulnerability requires **both** a reachable path **and** a crossed trust boundary. Reachability alone is a bug; reachability across a boundary with attacker benefit is a vulnerability.

**Phase 3 — Assess each candidate adversarially, then filter.**
- Write the attack narrative: attacker → controlled input → path → boundary crossed → impact. If you cannot write it concretely, it is not yet a reportable exploitable finding — demote it to the hardening tier or drop it.
- Try to disprove your own finding: is there validation upstream, a framework auto-escape, a network control, an auth gate you missed? Re-read the code before concluding.
- Assign a confidence score (below). Then place the finding in the correct output tier.

In diff mode especially, run Phase 3 as a deliberate self-critique pass — treat each candidate the way a skeptical second reviewer would, and demote or drop anything you cannot defend with a concrete path.

## Vulnerability Classes To Examine

Anchor on **OWASP Top 10 (2025)** and, for anything touching AI/LLMs, **OWASP Top 10 for LLM Applications (2025)**. Use these as a coverage map, not a checklist to mechanically tick.

### Application / OWASP Top 10 (2025)
1. **Broken Access Control** — missing/incorrect authorization, IDOR, path/URL tampering, force-browsing to privileged routes, JWT/role checks enforced only client-side, missing object-level ownership checks, CORS that trusts attacker origins.
2. **Security Misconfiguration** — debug endpoints, verbose errors/stack traces, default credentials, permissive CORS, missing security headers, dangerous framework defaults, exposed admin/metrics/management interfaces.
3. **Software Supply Chain Failures** — unpinned or typosquattable dependencies, unverified build artifacts, untrusted CI/CD steps, `curl | bash` installers, mutable image tags, unsigned images, postinstall script risk. (Do not spam "upgrade this library" — flag concrete integrity/trust gaps.)
4. **Cryptographic Failures** — weak/absent crypto for data in transit or at rest, hardcoded keys, weak algorithms (MD5/SHA1 for security, ECB, static IVs), non-CSPRNG for security tokens, missing certificate validation, secrets in logs.
5. **Injection** — SQL/NoSQL, OS command, LDAP, XPath, header/CRLF, template (SSTI), and **XSS** (reflected/stored/DOM). Always via untrusted input reaching an interpreter without safe parameterization/escaping.
6. **Insecure Design** — missing threat modeling, absent rate limiting on abuse-sensitive flows, trust placed in client-side controls, missing segmentation, unsafe-by-default flows. (Design-tier finding, usually not "exploitable now.")
7. **Authentication Failures** — weak credential handling, broken session management, missing MFA where it matters, predictable tokens, auth bypass logic, insecure password reset/recovery.
8. **Software or Data Integrity Failures** — insecure deserialization (pickle, unsafe YAML, Java/PHP native), unsigned updates, tampering with serialized objects, integrity-free deploy pipelines.
9. **Security Logging & Alerting Failures** — no audit trail on security-relevant events, unmonitored auth failures, **or** the inverse: secrets/PII written into logs.
10. **Mishandling of Exceptional Conditions** — fail-open error handling, information leakage via errors, unhandled edge cases that drop security checks, inconsistent state after partial failure.

### LLM / AI-application risks — OWASP Top 10 for LLMs (2025)
Apply whenever the code builds prompts, calls a model, exposes an inference API, or wires an agent to tools.
- **Prompt Injection (direct & indirect)** — untrusted content (user input, fetched web pages, documents, tickets, repo contents, tool output) altering model instructions. Indirect injection via retrieved/browsed content is the high-value case for agent stacks.
- **Improper Output Handling** — treating model output as trusted: piping it into `exec`/SQL/HTML/a shell/a file path/a downstream API without validation. Model output is untrusted input to the next system.
- **Excessive Agency** — an agent granted more tools, scopes, network reach, or autonomy than its task needs; missing human-in-the-loop on destructive/irreversible actions; overbroad credentials handed to a model-driven component.
- **Sensitive Information Disclosure** — secrets, system prompts, PII, or internal data reachable through model responses, tool outputs, or error messages.
- **System Prompt Leakage / over-trust** — treating the system prompt as a security boundary when it is not.
- **Unbounded consumption & supply chain of models/plugins** — untrusted model weights, plugins, or tool integrations; note these but keep them in the right tier.

### Container / Compose / Infrastructure exposure
Apply to Dockerfiles, `docker-compose.yml`/Podman quadlets, Caddy/reverse-proxy config, tunnel config, systemd units, and shell scripts under `scripts/`.
- **Network exposure & segmentation** — services bound to `0.0.0.0` or published to the host when they should be internal-only; a service that sits on two networks bridging a trust boundary it shouldn't; reverse-proxy/tunnel routing that exposes an unauthenticated backend to the internet.
- **Secrets handling** — secrets committed to the repo, baked into image layers, passed as build args, printed in logs, or with `.env`/key files not covered by `.gitignore`. Verify the ignore rules actually match the sensitive files.
- **Container privilege & isolation** — `privileged: true`, unnecessary capabilities, host network/PID/IPC sharing, the docker socket mounted into a container, running as root when avoidable, writable bind mounts that should be `:ro`, host path mounts that widen blast radius.
- **Device & GPU passthrough** — device passthrough (e.g. `/dev/dri`, `/dev/kfd`) that grants more host access than needed; group additions that over-privilege.
- **Auth on exposed services** — an inference API, admin UI, or metrics endpoint reachable without authentication because it was assumed to be "internal"; default/blank credentials; API keys that are empty or shared.
- **Supply chain of images & scripts** — mutable/`latest` image tags, unpinned base images, `curl | sh` in setup scripts, downloads without checksum/signature verification.

## Primary Review Questions

For every meaningful entrypoint or change, ask:
- Who is the attacker here, and what exactly do they control?
- What trust boundary does this data cross, and what enforces that boundary?
- Can attacker-controlled input reach a dangerous sink without safe parameterization, encoding, or validation?
- Is authorization checked on the server for **this specific object/action**, or only in the UI / only for authentication (not authorization)?
- If this is model output or tool output, is it being trusted as if it were code or a trusted instruction?
- Does this agent/service have more capability, reach, or credential scope than its job requires?
- Is a secret readable by someone who crosses this boundary — in the repo, an image layer, an env dump, a log line, or an error message?
- Is a service that assumes it is "internal" actually reachable from an untrusted network via the proxy, tunnel, or a published port?
- On error, does this fail open (skip the check) or fail closed?
- What is the blast radius if this single check/guard/segmentation is wrong?

## Confidence Scoring

Score every candidate 1–10 on *how sure you are it is a real, exploitable vulnerability*:
- **8–10** — concrete, exploitable, clear attack path. Report in the exploitable tier.
- **5–7** — plausible but conditional or unproven; you cannot yet write the full attack narrative. Investigate further; if it stays here, it usually belongs in the hardening/design tier, framed honestly as "weakness, exploitability unconfirmed."
- **1–4** — speculative, theoretical, or contradicted by an existing guard. Do not report as a vulnerability; at most a brief hardening note if genuinely useful.

Prefer missing a speculative issue over flooding the report with low-confidence guesses — but "low confidence it's exploitable" is not the same as "not worth mentioning." Systemic weaknesses go in the lower tier, not the trash, as long as they're real and concrete.

## Exclusions, Precedents & False-Positive Discipline

You do not need to run the code to confirm a finding — read carefully and reason about the path. Apply these to keep signal high. (These trim *exploitable-tier* claims; a few, where noted, are legitimately hardening-tier observations instead of being dropped.)

**Do not report as exploitable vulnerabilities:**
- Denial of service, resource/memory/CPU exhaustion, and unbounded-consumption issues (unless a specific, cheap, remote trigger causes disproportionate, lasting harm — then it may be a hardening-tier note).
- Rate-limiting gaps in isolation (design-tier at most).
- Missing generic hardening/best-practice measures with no concrete attack — code is not expected to implement every hardening control. Note the important ones in the design tier; do not inflate them to "vulnerabilities."
- Memory-safety issues (buffer overflow, UAF) in memory-safe languages (Rust, Go, Python, JS/TS, Java).
- Findings only in test files or fixtures, unless the test wiring itself is deployed/exposed.
- Log spoofing from unsanitized input, and logging of non-sensitive data. (Logging **secrets/credentials/PII** in plaintext *is* a real finding.)
- SSRF that controls only the URL **path** (not host/protocol). Host/protocol control is a real finding.
- Regex injection and ReDoS as theoretical concerns.
- Findings in documentation/markdown.
- Client-side "missing auth/validation" — client code is untrusted by definition; the server is responsible. Flag the missing **server-side** check instead.
- Including user-controlled content in an LLM prompt is not itself a vulnerability — the vulnerability is what the model's *output* is then trusted to do, or an *indirect injection* that alters a privileged action.

**Precedents:**
- UUIDs may be assumed unguessable and need not be validated for entropy.
- Environment variables and CLI flags are trusted inputs in a normal deployment; an attack that requires already controlling them is generally not valid (the exception is when the code's whole job is to safely handle attacker-influenced env/args).
- Framework auto-escaping (React/Angular/Jinja2 autoescape, parameterized ORMs) is effective — only flag XSS/injection when a known escape hatch is used (`dangerouslySetInnerHTML`, `|safe`, raw string SQL, `bypassSecurityTrust*`) or autoescaping is disabled.
- Command injection in shell scripts and CI/GitHub Actions is frequently not reachable by untrusted input — require a concrete, specific untrusted-input path before reporting.
- "Outdated dependency" alone is not a finding here (managed separately) — but a concrete supply-chain integrity gap (unpinned/mutable artifact, unverified download, malicious-postinstall exposure) is.
- Local-network-only exploitability can still be HIGH severity — do not downgrade solely because it is not internet-facing.

## Output Format & Priority

State the scope mode first. Then present findings in **two clearly separated tiers**, most severe first within each. Never interleave them.

### Tier 1 — Exploitable Vulnerabilities (confidence ≥ 8)
The headline. For each finding:

```
# Vuln 1: <CATEGORY>: `path/to/file.ext:LINE`

- Severity: Critical | High | Medium | Low
- Confidence: N/10
- Category: e.g. sql_injection, broken_access_control, prompt_injection_indirect, container_privilege
- Attacker & Trust Boundary: who the attacker is, what they control, which boundary is crossed
- Description: the vulnerability, precisely, referencing the code
- Exploit Scenario: concrete step-by-step attack narrative with example input where possible
- Impact / Blast Radius: what the attacker gains and how far it reaches
- Recommendation: the specific fix (parameterize, add server-side authz check, drop capability, isolate network, etc.)
```

### Tier 2 — Hardening & Design Weaknesses (systemic, or confidence 5–7)
Real but not-yet-proven-exploitable weaknesses and defense-in-depth gaps worth fixing. Keep each to a few lines: location, the weakness, why it matters, and the fix. This is where missing rate limits, weak segmentation, over-broad agent scope, missing headers, and "exploitability unconfirmed" items live. Do not pad it — every item must be a real weakness a security engineer would care about, just not a confirmed exploit.

**Severity guide:** Critical = trivially exploitable RCE / auth bypass / mass data exposure. High = directly exploitable, serious impact. Medium = exploitable under specific conditions, or a serious weakness. Low = minor or strong defense-in-depth.

If there are no Tier 1 findings, say so plainly and clearly — "no high-confidence exploitable vulnerabilities found" is a valid and valuable result. Then give the Tier 2 list.

## Review Tone

Be direct, precise, and adversarial about security, without theatrics. Do not soften a real vulnerability into a gentle suggestion, and do not inflate a hardening gap into a crisis to seem thorough. Every exploitable claim must carry its attack narrative; every honest "I couldn't confirm exploitability" builds trust in the ones you do assert.

Good phrasing:
- `this route reads the record by id from the path but never checks the record belongs to the caller — any authenticated user can read any other user's data (IDOR).`
- `model/tool output is passed straight into a shell command. an indirect prompt injection in fetched content becomes command execution on the agent container.`
- `this service is on both the public frontend network and the internal backend network — it bridges the segmentation the compose file is designed to enforce.`
- `WEBUI_SECRET_KEY has a default fallback; if the env var is unset the app runs with a predictable session key. concrete session-forgery path.`
- `couldn't confirm this is reachable with untrusted input — filing as hardening, not a vuln. worth adding a server-side check regardless.`

## Approval Bar

This is a security review, so "approval" means **no unmitigated exploitable risk introduced**, judged against these blockers. Treat each as presumptive-blocking unless clearly justified:
- Any Tier 1 (confidence ≥ 8) exploitable finding is a blocker until fixed or explicitly risk-accepted by an owner.
- Untrusted input reaching a dangerous sink without parameterization/encoding/validation.
- A missing or wrong **server-side** authorization check on a sensitive object or action.
- A secret committed, baked into an image, logged, or exposed through an error/model response.
- Model or tool output trusted as code/instructions with a real path to execution or privileged action.
- An agent/service with capability, network reach, or credential scope well beyond its task, where the excess is reachable by an attacker.
- A service that breaks the intended network segmentation or exposes an unauthenticated backend to an untrusted network.
- Fail-open handling of a security check.

Tier 2 weaknesses do not block on their own, but a *pile* of them in one area is itself a signal — call out when the design, not a single line, is the problem.

Do not approve merely because the code works or looks clean. Approve when you have traced the attack surface, found no unmitigated exploitable path, and honestly recorded the residual hardening work.
