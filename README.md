# 😷 MaskGuard AI: Face Mask Detection System

A browser-based face mask detection prototype using MediaPipe face detection and a TensorFlow.js GraphModel.

> **Try the hosted detector:** [MaskGuard AI — Detector](https://maskguard-ai-face-mask-detection.onrender.com/#detector). Allow camera access and select **Start Camera**. The browser performs inference locally; webcam frames are not sent to Flask or Render. A secure HTTPS origin is required for camera access.

The browser prototype uses a converted version of the repository classifier. Its training class-index mapping is not independently verified, so displayed Mask/No Mask labels are provisional. Browser performance reported here was measured with an automated fake-camera in headless Chromium, not a physical webcam. See [the Phase 4 optimization report](./PHASE_4_INFERENCE_OPTIMIZATION_REPORT.md) for measurements and limitations.

---

## ⚡ Quick Start

### 1. Installation
Ensure you have **Python 3.11** installed, then clone and install dependencies:

```bash
git clone https://github.com/zafarhussain28/maskguard-ai-face-mask-detection.git
cd maskguard-ai-face-mask-detection
pip install -r requirements.txt
```

### 2. Choose Your Interface

#### Option A: Web Dashboard (Recommended)
The Flask application serves the dashboard, browser worker, and local model assets. In the browser prototype, MediaPipe detects faces and TensorFlow.js classifies crops locally; the camera loop does not post frames to `/api/detect`. The Flask endpoint remains available for clients that explicitly use server-side detection.

1. Start the backend:
   ```bash
   python src/web_server.py
   ```
2. Open `http://127.0.0.1:5000` in your browser and select **Start Camera**.

For production, run Gunicorn from the project root:
```bash
gunicorn --chdir src web_server:app
```
The application serves its frontend, browser inference assets, and `/api/detect` endpoint from the same origin. Camera access requires HTTPS when deployed.
The native desktop script below is separate and is not used by the web deployment.

#### Option B: Native Desktop Window
A lightweight script that opens a dedicated OpenCV window.
```bash
python src/detect_mask_video.py
```
*Press **'q'** to quit the stream.*

---

## 📁 Key Components

- **`models/mask_detector.keras`**: Our pre-trained MobileNetV2 classifier.
- **`src/`**: Contains the core logic for detection and the web server.
- **`web/`**: The modern glassmorphism web dashboard.
- **Face Detector**: Uses SSD ResNet-10 for robust face tracking even with masks.

## 🧠 For Developers

If you want to **retrain** the model:
1. Place your data in a `dataset/` folder (subfolders: `Train`, `Validation`, `Test`).
2. Run `python src/train_model.py`.

---

## Browser inference: challenges and solution

The first browser prototype used TensorFlow.js WebGL. In the tested headless environment, WebGL used the SwiftShader software renderer: warm classifier inference averaged about **1,252 ms**, or approximately **0.8 frames per second**. WebGPU was also software-rendered and slower there, so choosing a GPU backend by name alone would not have helped.

The implemented solution benchmarks the unchanged classifier on the same input crop across available TensorFlow.js backends. It prefers the measured faster WASM backend and falls back to WebGL or CPU when WASM is unavailable. The fixed-shape GraphModel uses `execute()` rather than `executeAsync()`. In the same automated one-face run, throughput improved to **9.57 FPS** (about 12× the baseline), but did **not** reach the 10 FPS target. These are headless fake-camera measurements, not guaranteed device performance.

Classifier input semantics were preserved: face crop, RGB channels, 224×224 resize, float32 values divided by 255, NHWC layout, sigmoid output, and the existing 0.5 threshold. An identical exported crop produced a browser/Python probability difference of approximately `5.96×10⁻⁸`. The browser worker serializes inference to one in-flight frame, disposes per-frame tensors, and stops its camera tracks and worker on Stop or navigation. Automated tests found stable tensor counts and no per-frame `/api/detect` requests.

Known limitations: no physical webcam, multi-face, mobile-device, or hardware-accelerated GPU validation was performed. Training class-index metadata was unavailable, so labels remain provisional. MediaPipe BlazeFace also differs from the original Flask/OpenCV detector; detector parity is not claimed.

## Reusing browser inference in another system

This is a reference implementation rather than a drop-in library. To adapt the approach:

1. **Serve the assets.** Include the worker, GraphModel `model.json`, every weight shard referenced by its manifest, and the MediaPipe `.tflite` detector model. Keep the paths in `web/browser_inference_worker.js` aligned with your static-file routes.
2. **Load compatible runtimes.** This implementation uses TensorFlow.js and its WASM backend at 4.22.0 and MediaPipe Tasks Vision 0.10.21. Keep TensorFlow.js core and backend versions aligned. The worker currently downloads these pinned runtime files from jsDelivr; ensure your Content Security Policy/network permits them or host approved copies yourself.
3. **Request camera access on a user action.** Serve over HTTPS (or localhost in development), handle permission/device errors, and stop every media track and worker when stopping or leaving the camera page.
4. **Preserve model preprocessing.** For this model, use RGB, resize to 224×224, convert to float32, divide by 255, and pass NHWC input. Do not apply MobileNetV2 `preprocess_input`.
5. **Verify label semantics.** Recover the training `class_indices` mapping before presenting labels as authoritative; do not infer class meaning from the sigmoid output alone.
6. **Keep inference local and serialized.** Run it in a worker, allow one frame in flight, dispose tensors on every inference path, and report browser inference failures. Do not silently upload camera frames to a server as a fallback.
7. **Benchmark representative devices.** Measure startup, detector-only and face-classification throughput, memory, and lifecycle behavior on the hardware and browsers you intend to support.

Implementation references: [`web/app.js`](./web/app.js), [`web/browser_inference_worker.js`](./web/browser_inference_worker.js), and the model assets under [`web/models/`](./web/models/).

---

## 🛠️ Tech Stack
- **AI Core**: TensorFlow/Keras (MobileNetV2), OpenCV DNN.
- **Backend**: Flask + Python.
- **Frontend**: Vanilla JS + CSS (Glassmorphism design).

---

## 🛠️ Tech Stack

- **Python** (Tested on 3.11)
- **TensorFlow / Keras**
- **OpenCV**
- **NumPy**
