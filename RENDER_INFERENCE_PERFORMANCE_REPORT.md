# MaskGuard AI — Render Inference Performance Investigation

**Date:** 2026-11-02
**Status:** Local profiling and safeguards complete; production root cause remains unconfirmed.
**Deployment:** No commit, push, or deployment was performed.

## Summary

The production detection endpoint was observed returning HTTP 502 (`text/plain`) about 31.7 seconds after a valid multipart JPEG request. Production `/health` returned HTTP 200 and reported both models ready.

On this local environment, actual model inference returned a valid JPEG in approximately 53–60 ms for the tested frame sizes. The mismatch establishes that production is slower or otherwise failing, but does not identify the production failure stage.

One hypothesis is Gunicorn's default 30-second worker timeout: the README documents `gunicorn --chdir src web_server:app`, and that default is near the observed 31.7-second failure. The deployed Render start command and logs were not available, so this is not confirmed as the cause. A single synchronous worker also queues requests before Flask can run its nonblocking inference lock, so it cannot return an application-level 429 for those queued requests.

## Production observations

- `GET /health`: HTTP 200.
- `face_detector`: ready.
- `mask_classifier`: ready.
- A multipart POST to `/api/detect` with a browser-sized JPEG: HTTP 502, `text/plain`, approximately 31.7 seconds.
- A second production detection probe also returned HTTP 502 after approximately 31.7 seconds.
- Production was not sent webcam or personal images; the probe used a repository image.

Health readiness confirms initialization status only. It does not show whether inference finished, whether the worker timed out, or whether the proxy dropped the request.

## Local benchmark

Benchmarks used the repository's `web/assets/hero.png`, resized and encoded as JPEG at quality 65. The real local TensorFlow model and OpenCV DNN face detector were used. Each size was requested seven times; values below are medians, with stage times taken from request instrumentation.

| Input dimensions | JPEG input bytes | Median total | Multipart | Decode | Detector input | Detector forward | Boxes | Crop preprocessing | TensorFlow | JPEG encode |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 320×240 | 15,022 | 52.6 ms | 0.81 ms | 0.36 ms | 0.50 ms | 31.16 ms | 0.04 ms | 0.18 ms | 17.88 ms | 0.30 ms |
| 480×360 | 28,798 | 53.2 ms | 0.96 ms | 0.69 ms | 0.55 ms | 31.29 ms | 0.04 ms | 0.21 ms | 17.58 ms | 0.62 ms |
| 640×640 | 58,979 | 55.2 ms | 1.23 ms | 1.44 ms | 0.57 ms | 31.56 ms | 0.04 ms | 0.25 ms | 17.47 ms | 1.30 ms |
| 1280×720 | 102,566 | 59.8 ms | 1.11 ms | 2.74 ms | 0.64 ms | 31.93 ms | 0.04 ms | 0.28 ms | 17.75 ms | 2.71 ms |

Each tested local request detected and classified one face and returned a decodable `image/jpeg`. The larger images show only a modest increase in this test because the detector input is resized to 300×300 and the classifier crop is resized to 224×224.

### Thread benchmark

The local environment exposed two CPUs. A separate 20-request-per-mode comparison at 480×360 used the same actual models, input image, and sequential Flask test-client calls:

| Runtime threads | Total median | Total P95 | Total max | Detector median | TensorFlow median |
|---|---:|---:|---:|---:|---:|
| TensorFlow automatic; OpenCV default (2) | 66.26 ms | 100.90 ms | 144.96 ms | 32.78 ms | 29.43 ms |
| TensorFlow intra/inter-op 1/1; OpenCV 1 | 58.34 ms | 74.07 ms | 113.44 ms | 33.97 ms | 18.18 ms |

With one-CPU affinity and single-thread settings, the total median remained about 58–60 ms across tested sizes. The one-thread choice improved the measured median and P95 in this local comparison, mainly in TensorFlow, but the maxima varied. These are local measurements, not Render benchmarks.

### Repeated sequential inference

Twenty actual-model sequential requests per input size were measured with TensorFlow/OpenCV configured to one thread. Times include the Flask request and image response. Detector and classifier columns are stage median/P95:

| Input dimensions | Total median | Total P95 | Total max | Detector median/P95 | TensorFlow median/P95 |
|---|---:|---:|---:|---:|---:|
| 320×240 | 57.50 ms | 74.31 ms | 132.20 ms | 34.47 / 44.67 ms | 17.89 / 26.59 ms |
| 480×360 | 58.41 ms | 63.49 ms | 84.44 ms | 33.19 / 39.81 ms | 18.28 / 24.71 ms |
| 640×480 | 58.84 ms | 66.52 ms | 77.68 ms | 31.78 / 36.48 ms | 18.12 / 24.37 ms |

### Resource context

- Local CPU affinity: two CPUs.
- Local memory visible: approximately 7.8 GiB total, approximately 5.2 GiB available at inspection.
- cgroup CPU quota: unlimited (`cpu.max` reported `max 100000`).
- cgroup memory limit: unlimited (`memory.max` reported `max`).
- Benchmark process peak RSS: approximately 0.9 GiB.
- Latest repeated-benchmark process peak RSS: approximately 912.4 MiB.
- The default installed OpenCV package in the environment could not import due to missing `libGL.so.1`. Benchmarks used the project's pinned `opencv-python-headless==4.11.0.86` installed temporarily outside the repository; the temporary installation was removed afterward.
- Render CPU/RAM plan and quotas were not available.

## Changes made locally

### `src/web_server.py`

- Added monotonic timing for multipart extraction, image decode, detector input preparation, detector forward pass, bounding-box handling, crop preprocessing, classifier inference, JPEG encoding, and total request duration.
- Added safe logs for request start, dimensions, face counts, stage durations, and output byte count. Logs do not include image contents or filesystem paths.
- Set TensorFlow intra-op/inter-op and OpenCV thread counts to one during model initialization, based on the local benchmark.
- Added image dimension caps: no side over 1920 pixels and no more than 4 megapixels. The existing 8 MB upload cap remains.
- Limited classifier work to at most 10 faces per frame.
- Changed inference-lock handling to return HTTP 429 immediately when an inference is already running, rather than queueing another request. The frontend treats 429 as retryable.
- Preserved the existing trained model, face detector, preprocessing, classification threshold, labels, and confidence calculation.

### Existing dashboard edits

The working tree also contains dashboard changes from the preceding task in `web/app.js` and `web/styles.css`:

- Samples frames at a default 1000 ms interval, configurable through `?detectionIntervalMs=<ms>` and bounded to 250–10,000 ms.
- Captures at a maximum width of 480 pixels and JPEG quality 0.65.
- Keeps the camera preview independent from server inference, allows only one active request, and retains the last valid annotated result while processing.
- Retries 429 with bounded backoff, stops polling on permanent HTTP responses such as 502, bounds network retries, and shows the latest successful detection time.
- Aborts pending inference and stops all camera tracks when stopping the camera or navigating away.
- Validates the JPEG response and revokes replaced/abandoned object URLs.

The backend also wraps inference with a process-local nonblocking lock. A deterministic contention test returned 200 to the active request and 429 to a simultaneous request. Under the currently reported one-sync-worker Gunicorn setup, requests queue before entering Flask, so this mechanism cannot reject those upstream queued requests. It protects requests when the server dispatches concurrently (for example, with a threaded worker); it is not shared across worker processes.

## Validation results

- `python -m py_compile src/web_server.py`: passed.
- `node --check web/app.js`: passed.
- `git diff --check`: passed.
- Local `/health`: HTTP 200; both models ready.
- Local `/api/detect` for all benchmark inputs: HTTP 200, `image/jpeg`, decoded successfully.
- Latest run repeated each of 320×240, 480×360, and 640×480 20 times (60 real-model requests total); all returned valid decodable JPEGs and request IDs.
- 2048×2048 image: rejected with HTTP 413.
- Simulated inference-lock contention: rejected with HTTP 429 and a retryable error.
- Controlled two-request contention: active inference completed with HTTP 200; the concurrent Flask request received HTTP 429 without waiting for the lock.
- Simulated 12 face detections: only 10 were classified, and a JPEG was returned.
- Frontend mock checks: query interval default/valid/clamped/invalid values, one in-flight request, preservation of the prior result during inference, release of the prior object URL, 429 retry, 502 stop, pending-request abort, navigation cleanup, and immediate camera restart while an old request unwinds.
- No labeled mask/no-mask test image pair was present; benchmark output is not an accuracy evaluation.

## Production diagnosis still needed

To determine the exact source of the 502, collect Render logs and metrics for one failing request, including the request timestamp and `X-Request-ID`:

1. **Request and stage logs:** Check whether the detector/classifier start messages have matching completion messages, and inspect the logged stage duration and total duration.
   - Detector started but did not complete: likely stall in OpenCV DNN or process termination during that stage.
   - Classifier started but did not complete: likely stall in TensorFlow inference or process termination during that stage.
   - All stages completed but the client saw 502: investigate proxy/response handling and upstream logs.
2. **Gunicorn logs:** Look for `WORKER TIMEOUT`, worker restart/exit, boot failure, or worker heartbeat messages near the failure. Confirm the actual Render start command and any `--timeout` option. A timeout around 30 seconds would fit the observed timing, but must be verified.
3. **Render service events and metrics:** Check for OOM/termination, memory pressure, CPU saturation/throttling, and restarts. A healthy `/health` response before or after a failure does not rule out a worker-specific crash or transient resource event.
4. **Concurrency:** Compare timestamps and request IDs for overlapping detection requests. The current local guard returns 429 when the process lock is occupied; multiple Gunicorn processes have separate locks.

Do not treat the local benchmark or production health response as proof that production inference is fixed. No Render performance claim is made.

## Files changed in the working tree

- `src/web_server.py` — profiling, thread settings, and safe inference limits.
- `web/app.js` — prior local dashboard frame/retry/rendering changes.
- `web/styles.css` — prior local detection-result visibility change.
- `RENDER_INFERENCE_PERFORMANCE_REPORT.md` — this report.

No commit, push, deployment, retraining, or model replacement was performed.

## Request-correlated diagnostics follow-up

The diagnostics described above have since been extended in the **local working tree only**. `git show HEAD:src/web_server.py` contains none of the request-ID or stage-timing markers, and `src/web_server.py` remains modified locally. These diagnostics have **not** been deployed; the live Render process cannot be assumed to emit them.

Each `/api/detect` request now receives a UUID request ID before request parsing. It is included in diagnostic stage logs and returned in the `X-Request-ID` response header. Stage logs include elapsed time from request receipt; measured operations also include stage duration. The stages include request receipt, multipart extraction, image decode, detector start/completion, per-face preprocessing, classifier start/completion, JPEG encode start/completion, and response completion.

Unhandled detection exceptions use `logger.exception` with the request ID and current stage, preserving the full traceback in server logs. The browser receives only a generic `Image processing failed.` response. No image content or filesystem path is deliberately logged.

### Request and concurrency review

- The module-global lock protects inference within one Python process and is released in a `finally` block. Requests that find it occupied receive HTTP 429 immediately. With the stated single synchronous Gunicorn worker, requests are already serialized; the lock additionally protects inference if request threading is enabled. It is not shared across multiple worker processes.
- TensorFlow intra-op/inter-op and OpenCV thread settings are applied before model loading and warm-up in each worker process. Local tests report TensorFlow settings `1/1` and OpenCV `1`.
- The classifier limit is 10 classified face crops per frame. Additional above-threshold boxes are counted but not classified.
- Frontend polling schedules the next frame only after the current `fetch` completes, so its normal loop does not overlap requests. 429 is retried with bounded backoff; 502 stops polling and displays an error; network exceptions retry up to the configured cap.

### Diagnostic test results

- Actual local model inference returned HTTP 200 `image/jpeg`; request ID was present in the response and all expected stages appeared in captured server logs with that same ID.
- A simulated inference exception returned HTTP 500 with a generic browser body; the captured server log contained the correlated exception and traceback.
- Frontend behavior tests verified retry on 429, stop on 502, bounded network-error retry, and no next-frame scheduling while a request is pending.
- Python syntax, JavaScript syntax, and whitespace checks passed after these changes.

### Suggested Render diagnostic start command

For a diagnostic run that allows Flask to receive concurrent requests and exercise its immediate 429 guard, use one `gthread` worker with two threads. This does not increase the worker timeout:

```sh
gunicorn --chdir src --workers 1 --worker-class gthread --threads 2 --access-logfile - --error-logfile - --log-level info --capture-output --access-logformat '%(h)s %(t)s "%(r)s" %(s)s %(b)s request_id=%({x-request-id}o)s' web_server:app
```

This is a diagnostic configuration, not a proven fix; it also does not coordinate locks across multiple worker processes. Check the actual failing request's `X-Request-ID` against application and access logs, and look for `WORKER TIMEOUT`, worker restarts, or missing stage completion. Changing the Render start command is not part of this local work.
