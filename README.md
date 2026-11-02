# 😷 MaskGuard AI: Face Mask Detection System

A high-performance deep learning system that detects face masks in **real-time** using your webcam. 

This repository is **pre-configured** with trained models (~99% accuracy) so you can run it immediately without training.

---

## ⚡ Quick Start

### 1. Installation
Ensure you have **Python 3.11** installed, then clone and install dependencies:

```bash
git clone https://github.com/yourusername/mask-detection-system.git
cd mask-detection-system
pip install -r requirements.txt
```

### 2. Choose Your Interface

#### Option A: Web Dashboard (Recommended)
The Flask application serves the dashboard and processes browser camera frames.
Camera access requires HTTPS when deployed.

1. Start the backend:
   ```bash
   python src/web_server.py
   ```
2. Open `http://127.0.0.1:5000` in your browser and select **Start Camera**.

For production, run Gunicorn from the project root:
```bash
gunicorn --chdir src web_server:app
```
The application serves its frontend and `/api/detect` endpoint from the same origin.
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
