---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: sg-engineering
scope: lab-worker-dependency-refresh
user_story: "As a worker operator, I can install the CPU worker reproducibly and retain authenticated transcription contracts."
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [lab, Convex]
depends_on: []
supersedes: []
evidence:
  - "Operator approved the Python 3.12 CPU migration plan, then explicitly retained the OpenAI SDK."
  - "Baseline Linux hash install, pip check, auth and simulated transcript passed; FunASR import failed without torch."
next_step: "Deliver the verified worker change through normal Git policy."
---

# ReplayGlows Lab Dependency Refresh

## Outcome and authority

An operator installing the worker must obtain importable local engines and the
same authenticated transcription contract after dependency maintenance.
The operator approved the proposed plan and subsequently asked to retain the
OpenAI SDK; upgrade it to 3.8.0 while preserving the requests-based provider.
Owned branch: `codex/lab-worker-dependency-refresh`; rollback baseline: `d06d0d6`.

## Scope and non-goals

Update lab dependencies, hash lock, focused tests and directly associated docs.
Retain Python 3.12, CPU defaults, existing providers, auth, queue semantics and
response fields. Do not edit other product surfaces, pre-existing ENVIRONMENT
files, CI policy, branch protection, secrets, cookies or deployment state.
Python 3.14 PR #13 remains deferred. Ordinary exact-scope commits/pushes and
protection-preserving integration after remote refresh are authorized.

## Behavioral contract

POST /transcribe retains entries, fullText, estimatedCostUsd and warnings.
Missing/wrong bearer returns 401/403; captions return 400; saturation returns
429; hard media limits return 413; provider failure releases the slot.
Metadata and download checks precede normalization and provider execution.
Health remains a presence/status endpoint, not model readiness evidence.

## Tasks and acceptance

1. Update the nine direct packages to the audited versions. Use torchaudio
   2.11.0 CPU with PyTorch 2.14.0 (stable ABI) from the official PyTorch index. Resolve under Linux
   Python 3.12 with pip-tools and hashes, respecting FunASR's numpy<2 constraint.
2. Build the complete Docker image with ffmpeg and hash-enforced installation;
   verify pip check, native imports and SDK initialization without API calls.
3. Add offline contract tests covering successful and failing requests, real
   ffmpeg normalization, mocked providers/downloads, limits and slot cleanup.
4. Record compatibility constraints, exact regeneration/test commands and proof
   limits. Review owned diff, refresh remote state, commit/push and integrate
   only if checks and repository policy permit it.

## Proof contract

Run Linux/amd64 image build, pip check, py_compile and unittest discovery inside
the image with network disabled. Test auth, schema, warnings, cost, empty results,
media limits, saturation and error cleanup. Import FunASR, faster-whisper, torch,
torchaudio and OpenAI without downloading models. Test model adapters using
synthetic outputs; no paid calls, live YouTube, real keys or cookies.
Run a short isolated container HTTP health probe without publishing a host port.
Real model quality, GPU, ARM, hosted OAuth and live YouTube remain unverified.

## Links & Consequences

Convex consumes the unchanged response contract; no caller edit is needed.
FunASR requires explicit torch/torchaudio installation upstream. New CPU wheels
increase image size and require the official public PyTorch package index.
The existing 3.14 slim path cannot build pinned editdistance; latest FunASR
requires NumPy 1.x, which has no cp314 wheel. Do not bypass dependency constraints.

## Documentation Coherence

Updated lab/README.md, its unreleased changelog, the worker tracker and
audits/2026-09-05-lab-worker-dependencies.md. No new public product claims or
editorial changes. Historical audits remain historical evidence.

## OWASP Security Gate

A03 supply chain, A07 auth and A10 error handling: public approved indexes,
hash-enforced lock, synthetic credentials, no runtime network in regression
tests, 401/403 and slot-release assertions. No ASVS compliance claim. Residual
live provider/cookie/model evidence belongs to a separately authorized runtime
validation; it is not required for this simulated dependency proof.

## Execution Notes

Read lab/AGENT.md, requirements.in, Dockerfile and server.py. Work only in the
owned worktree. Docker is shared; never stop/prune unrelated resources. Use
uniquely named temporary containers and remove only those owned by this task.
Stop for an incompatible dependency graph requiring a different product/provider
or Python policy, unresolved Git conflicts, or unexpected credential needs.

## Skill Run History

- 2026-09-05 — sg-engineering deps: Linux baseline audited; migration proposed.
- 2026-09-05 — readiness: ready against the approved scope, current upstream
  installation contracts, rollback commit and offline acceptance criteria.

## Current Chantier Flow

Approved -> ready -> implementation -> verification passed -> Git delivery.

2026-09-05: OpenAI SDK 3.8.0 is retained. The corrected lock resolves torch
2.14.0+cpu, torchaudio 2.11.0+cpu and setuptools 84.0.0 under Linux/Python 3.12.
The complete Linux/amd64 image built successfully; pip check, py_compile,
all 10 offline tests, native imports, real audio normalization and isolated
HTTP health/auth probes passed. PyPI advisory lookup covered all 107 locked
packages with zero findings and zero lookup errors. No live provider/model,
GPU, Python 3.14 or deployment claim is made.

The operator separately approved recovery after Docker failed on a stale
runtime socket. With Docker stopped, its temporary socket directory was
preserved as run.recovery-20260905 and Desktop recreated it successfully.
Linux Engine 29.7.2 remains running; only this task's test/compiler containers
were removed. Detailed evidence and limitations are recorded in the audit.
