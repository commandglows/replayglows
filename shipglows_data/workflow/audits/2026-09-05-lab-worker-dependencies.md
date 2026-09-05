---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: sg-engineering
scope: lab-worker-dependencies
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: [lab, Convex]
depends_on: []
supersedes: []
evidence:
  - "Approved worker dependency refresh; OpenAI SDK explicitly retained."
  - "Linux/amd64 image, pip check, py_compile, 10 offline tests and HTTP auth probes passed."
  - "107 PyPI package advisory lookups: zero findings, zero errors."
next_step: "Revisit Python 3.14 when the NumPy/FunASR native graph supports it."
---

# Worker Dependency Refresh — 2026-09-05

## Scope and compatibility decisions

The nine existing direct dependencies are refreshed in the Python 3.12 Linux
worker. OpenAI 3.8.0 remains installed at the operator's request; production
OpenAI and Deepgram adapters continue using requests. No server contract,
provider, concurrency or authentication behavior is intentionally changed.

| Direct package | Resolved version |
| --- | --- |
| fastapi | 0.141.1 |
| starlette | 1.6.0 |
| uvicorn | 0.52.4 |
| requests | 2.34.2 |
| idna | 3.19 |
| yt-dlp | 2026.8.19 |
| faster-whisper | 1.2.1 |
| openai | 3.8.0 |
| funasr | 1.4.14 |

FunASR 1.4.14 requires NumPy below 2 and explicit PyTorch/TorchAudio installation.
The baseline installed with hashes and passed pip check, but importing FunASR
failed because torch was absent. The CPU lock now targets torch 2.14.0+cpu and
torchaudio 2.11.0+cpu. TorchAudio 2.11 uses the stable ABI and supports PyTorch
2.11 and newer; different version numbers are supported by upstream.
See [TorchAudio installation compatibility](https://docs.pytorch.org/audio/stable/installation.html).

Python 3.14 PR #13 remains deferred. NumPy 1.26.4 has no cp314 wheel, and the
existing editdistance 0.8.1 source build failed in python:3.14-slim. A FROM-only
upgrade is not a validated worker migration. GPU, ARM and other Python versions
are outside this CPU proof.

## Dependency security and reproducibility

The first candidate lock contained torch 2.11.0 and setuptools 81.0.0.
Registry advisories prompted corrections to torch 2.14.0 and setuptools>=83.
The reviewed PyTorch advisory is low severity (CVSS 1.9), fixed in 2.13.0;
do not repeat its earlier critical classification. Sources:
[PyTorch advisory](https://github.com/advisories/GHSA-rrmf-rvhw-rf47) and
[setuptools advisory](https://github.com/advisories/GHSA-h35f-9h28-mq5c).

The corrected lock is resolved by pip-tools 7.6.1 under Linux/Python 3.12.
Existing hashes are reused. The temporary resolver input is seeded with
publisher SHA-256 digests for the updated torch CPU and setuptools releases
to avoid downloading every platform's wheel solely to compute hashes.
The delivered lock remains pip-compile output; Docker installs with
`pip install --no-cache-dir --require-hashes -r requirements.lock`.
The final PyPI version-advisory lookup covered all 107 locked packages with
zero findings and zero lookup errors on 2026-09-05. This is a point-in-time
Python package check, not an OS scan or a universal security guarantee.

## Execution evidence

The corrected Docker build installed all 107 packages with hash enforcement;
antlr4-python3-runtime, crcmod, jieba and oss2 built from their verified source
archives. Base: python:3.12-slim at
`sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea`.
The complete image built and exported successfully on Linux/amd64, Python
3.12.14. Local tag: `replayglows-lab:dependency-refresh-3270`; image manifest:
`sha256:e42848c1d8fbbac103e791cf43a6624184e56ffd8e90fdee11dbfa89e97bffff`.

- `python -m pip check`: no broken requirements.
- `python -m py_compile server.py main.py test_worker.py`: passed.
- `python -m unittest -v test_worker`: all 10 tests passed in 35.730 seconds,
  inside the final image with `--network none` and read-only test/main mounts.
  Native FunASR, faster-whisper, torch and torchaudio imports passed; the
  retained OpenAI SDK completed its MockTransport transcription call.
  Real FFmpeg normalization and audio decoding passed for the local adapters.
  Endpoint tests covered auth 401/403, unsupported captions 400, schema 422,
  media limits 413, busy 429, failure/empty results 500, response fields,
  provider cost and concurrency-slot cleanup.
- A separate container used the image's default startup command, synthetic
  auth and no external network or published ports. HTTP health returned 200;
  all three binaries and both local packages were present. Missing and wrong
  auth returned 401 and 403; valid auth reached the captions rejection (400).
- Owned HTTP and compiler containers were removed after proof. The validated
  image remains available; the shared Docker engine remains running.

## Local Docker recovery

Docker stopped during the initial work. Relaunch failed on an inaccessible
`sailor-ingest.sock` runtime socket. The operator approved targeted recovery.
With Docker processes absent, the local temporary `Docker/run` directory was
renamed to `Docker/run.recovery-20260905`, retaining its two stale socket entries.
Docker recreated the runtime directory and Linux Engine 29.7.2 responded.
No factory reset, data prune, WSL shutdown or unrelated container deletion was
performed. The recovery directory remains for inspection.

## Proof boundaries and documentation

Tests use synthetic audio, real FFmpeg normalization, native decoders and
simulated model/provider responses with runtime networking disabled. They do
not establish model download/loading, inference quality, live YouTube access,
paid API operation, hosted Convex integration or deployment readiness.
Health is package/binary presence evidence only. The managed lab session
remains stopped with its URL pending assignment; isolated Docker checks do
not replace it or publish a host port.

The lab README documents runtime, lock and tests; its unreleased changelog
records the internal operator-facing dependency change. This audit and the
approved spec record technical evidence; public product content is unaffected.
Other product surfaces, untracked ENVIRONMENT files, CI and branch protection
are outside the change.
