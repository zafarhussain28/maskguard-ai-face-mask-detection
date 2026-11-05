# MaskGuard AI — Phase 4 Inference Optimization Report

## Summary

The Phase 3 baseline was 0.8 FPS with TensorFlow.js WebGL in a headless, software-rendered browser. The browser was using ANGLE/SwiftShader rather than a hardware-accelerated GPU. On the same classifier and identical face crop, WASM was substantially faster than WebGL, WebGPU, or CPU in this environment.

The worker now prefers WASM, then WebGL, then CPU. The fixed-shape GraphModel uses `execute()` rather than `executeAsync()`, and development diagnostics separately time face crop/resize, RGBA pixel readback, RGB conversion/normalization, tensor creation, graph execution, output readback, and disposal. The optimized one-face run sustained **9.57 FPS**, about 12× the Phase 3 rate, but did **not** meet the 10 FPS target.

All tests used an automated headless Chromium session. The face was a real portrait photograph supplied as a fake-camera video, not physical webcam footage. No physical webcam or multi-face test was performed.

## Scope and files

### Inspected

- `web/app.js`
- `web/browser_inference_worker.js`
- `web/styles.css`
- `web/models/maskguard_graph/model.json` and its referenced weight shards
- `web/models/mediapipe/blaze_face_short_range.tflite`
- `models/mask_detector.keras`
- `PHASE_3_WEBCAM_VALIDATION_REPORT.md`

The GraphModel manifest declares input `[batch, 224, 224, 3]` and output `[batch, 1]`. It is a fixed-shape graph without dynamic output shapes or control flow.

### Changed for Phase 4

- `web/browser_inference_worker.js` — WASM-first backend selection with existing WebGL/CPU fallbacks; stage-level profiling; synchronous GraphModel execution for the static graph.
- `web/app.js` — development diagnostics now display separate crop/resize, pixel readback, and RGB normalization timings.
- `PHASE_4_INFERENCE_OPTIMIZATION_REPORT.md` — this report.

No model weights, training model, Flask inference behavior, production configuration, detector behavior, or frame-scheduling policy were changed. The `/api/detect` endpoint remains untouched. Existing local changes from earlier phases were preserved.

## Environment and test inputs

- Chrome for Testing 156.0.8078.4 with Playwright Core 1.58.2.
- TensorFlow.js 4.22.0; MediaPipe Tasks Vision 0.10.21.
- Automated fake-camera video based on the real portrait photograph used in Phase 3; 640×480 frame, one visible face.
- Separate blank fake-camera video for the no-face path.
- The final browser-exported RGB face crop was byte-identical to the Phase 3 fixture at `/tmp/maskguard-face-crop-224.png`.
- The crop SHA-256 was `b052583ad7768e73ef653a7e970ac3ee203e30d0d63223655f8257076123c88f`.
- The unchanged original Keras model was run with TensorFlow 2.22.0-rc0. Its input used RGB, float32, 224×224, division by 255, and NHWC layout.

The host reported a virtual Hyper-V DRI device, `hardwareConcurrency=2`, `crossOriginIsolated=false`, and no `SharedArrayBuffer`. Browser WebGL and WebGPU used ANGLE/SwiftShader software rendering; hardware GPU acceleration was not available for these tests. WASM ran single-threaded. The pinned WASM runtime assets are fetched from jsDelivr; inference inputs and outputs are not sent to an inference service.

## Phase 3 baseline

| Metric | Phase 3 result |
|---|---:|
| Backend | WebGL, software rendering |
| Warm face detection mean | 18.2 ms |
| Warm classifier mean | 1,252.3 ms |
| Warm total frame processing mean | 1,276.5 ms |
| Observed throughput | 0.8 FPS |

## Backend benchmark

Backends were benchmarked on the same saved 224×224 RGB crop, normalized to float32 `[0,1]` and shaped `[1,224,224,3]`. The backend microbenchmark collected seven warm samples; at this sample count, reported P95 is effectively the maximum. Backend and model initialization times below are measured separately from the end-to-end worker initialization.

| Backend | Backend init | GraphModel load | First inference | Warm median / P95 | Abs. delta vs Python |
|---|---:|---:|---:|---:|---:|
| WebGL (SwiftShader) | 7.1 ms | 105.3 ms | 3,997.3 ms | 678.1 / 802.4 ms | 0 |
| WASM | 23.2 ms | 165.5 ms | 108.9 ms | 35.9 / 50.2 ms | 5.96×10⁻⁸ |
| WebGPU (SwiftShader) | 35.2 ms | 101.6 ms | 11,572.2 ms | 5,330.6 / 5,378.5 ms | 0 |
| CPU | 1.1 ms | 126.4 ms | 1,211.8 ms | 1,720.3 / 1,757.3 ms | 5.96×10⁻⁸ |

All four backends loaded and executed the graph in this test environment. WebGPU was technically available but dramatically slower under SwiftShader; it is not selected. WASM had the best measured throughput and is now preferred. Blocking the WASM backend script also exercised the WebGL fallback successfully; under SwiftShader that fallback took about 8.17 seconds to initialize. Automatic fallback from WebGL to CPU was not separately exercised in a browser run.

TensorFlow.js reported 130 tensors and 9,512,332 bytes after inference, unchanged across repeated inference for all backends. CPU memory reporting is marked by TensorFlow.js as an upper bound. These counts include the loaded model and are not expected to return to zero while the worker remains initialized.

### GraphModel execution API check

On WASM, a 30-run comparison on the same crop measured:

| API | Warm median | Warm P95 | Tensor count / bytes |
|---|---:|---:|---:|
| `executeAsync()` | 45.7 ms | 69.8 ms | 130 / 9,512,332 |
| `execute()` | 45.4 ms | 60.9 ms | 130 / 9,512,332 |

The static graph supports `execute()`. Its median was effectively unchanged, while the observed P95 was lower; it also avoids the TensorFlow.js warning recommending this API for graphs without dynamic shapes or control flow. Warmup and per-frame graph execution now both use `execute()`.

## Optimized browser measurements

### One-face fake-camera run

After worker initialization and the first result, 151 frame intervals were measured over 15.78 seconds. All frames detected and classified one face. Stage statistics are median / P95:

| Stage | Median / P95 |
|---|---:|
| Total frame processing | 65.4 / 114.8 ms |
| MediaPipe face detection | 8.9 / 18.5 ms |
| Face crop and resize | 0.0 / 0.1 ms |
| RGBA pixel readback | 0.6 / 1.0 ms |
| RGB conversion and normalization | 0.8 / 2.0 ms |
| Tensor creation | 0.1 / 0.2 ms |
| Graph execution | 54.1 / 92.6 ms |
| Output readback | 0.0 / 0.2 ms |
| Tensor disposal | 0.0 / 0.0 ms |
| Total classifier work | 54.1 / 92.6 ms |

Browser worker/model initialization was 1,402.8 ms in this run. The separate WASM microbenchmark measured 108.9 ms for the first model-only inference; a cold end-to-end browser frame was not separately isolated.

The browser probability was `0.9974156022071838`. Python Keras returned `0.9974155426025391` for the byte-identical exported crop. Absolute difference was approximately `5.96×10⁻⁸`; both values were at or above 0.5. Input/output shapes were `(1,224,224,3)` and `(1,1)`. Preprocessing, RGB order, the 0.5 threshold, and the existing confidence calculation were preserved.

Observed processing throughput was **9.57 FPS** (the UI displayed 9.6 FPS). This is roughly 12× the Phase 3 rate, but remains below the 10 FPS target.

### No-face fake-camera run

The blank-video test is reported separately and is not evidence of face-classification throughput. Across 219 frame intervals over 14.66 seconds:

| Measurement | Result |
|---|---:|
| No-face detector throughput | 14.94 FPS |
| Faces detected / classified | 0 / 0 on all frames |
| Detection median / P95 | 8.2 / 19.7 ms |
| Total frame median / P95 | 9.4 / 23.8 ms |
| Classifier duration | 0 ms |

## Memory, lifecycle, and privacy validation

- **Passed:** GraphModel and MediaPipe initialized in the browser; the selected backend was WASM.
- **Passed:** one actual photographed face was detected and classified; the box was `(193, 91, 109, 109)` in the 640×480 frame.
- **Passed:** final browser crop matched the Python crop fixture SHA-256 and Python probability within `5.96×10⁻⁸`.
- **Passed:** no-face path returned zero detections and zero classifications, with no classifier execution.
- **Passed:** tensor count and bytes remained constant at 130 / 9,512,332 throughout the sustained face run.
- **Passed:** the one-in-flight instrumentation observed a maximum of one outstanding frame.
- **Passed:** two repeated Stop/Start cycles ended the camera tracks and terminated each worker; navigation away from Detector ended the active stream and terminated its worker. Four workers were created and all four produced a ready message and were terminated.
- **Passed:** no `/api/detect` requests were observed during browser inference; there is no per-frame backend request or silent server fallback.
- **Passed:** after the API change, the repeated dynamic-shape warning was absent.
- **Passed:** `node --check web/app.js`, `node --check web/browser_inference_worker.js`, and `git diff --check`.
- **No assertion failures** were observed in the final single-face, parity, no-face, or lifecycle checks.

## Limitations and tests not performed

- No physical webcam, real-device, mobile-browser, permission-denial, or hardware-accelerated GPU test was performed.
- No real multi-face image or video was available; independent multi-face boxes and per-face outputs remain unverified.
- Only one photographed face crop was compared against Python. This does not establish general classifier accuracy.
- The original training `class_indices` mapping remains unverified. The existing browser mapping and labels remain provisional; no label correctness claim is made.
- MediaPipe BlazeFace short-range differs from the original Flask/OpenCV SSD detector; detector parity is not claimed.
- The 10 FPS sustained target was **not achieved** in the tested software-rendered browser environment.
- No model retraining, backend migration, commit, push, or deployment was performed.
