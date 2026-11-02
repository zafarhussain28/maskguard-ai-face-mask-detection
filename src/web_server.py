import os
import cv2
import numpy as np
import threading
import tensorflow as tf
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from tensorflow.keras.models import load_model

# --- Configuration & Paths ---
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
WEB_ROOT = os.path.join(PROJECT_ROOT, "web")
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "mask_detector.keras")
PROTOTXT_PATH = os.path.join(PROJECT_ROOT, "deploy.prototxt")
CAFFEMODEL_PATH = os.path.join(PROJECT_ROOT, "res10_300x300_ssd_iter_140000.caffemodel")
MAX_IMAGE_SIZE = 8 * 1024 * 1024

app = Flask(__name__, static_folder=WEB_ROOT, static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_SIZE
CORS(app)

IMG_SIZE = 224
FACE_CONF_THR = 0.5
MASK_CONF_THR = 0.5

# Model resources are initialized at import time for Gunicorn workers.
mask_model = None
mask_model_inference = None
face_net = None
model_status = {"mask_classifier": False, "face_detector": False}
inference_lock = threading.Lock()

def load_resources():
    global mask_model, mask_model_inference, face_net
    try:
        mask_model = load_model(MODEL_PATH)
        mask_model_inference = tf.function(
            classify_face,
            input_signature=[
                tf.TensorSpec((1, IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32)
            ],
        )
        mask_model_inference(tf.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32))
        model_status["mask_classifier"] = True
    except Exception:
        mask_model = None
        mask_model_inference = None
        app.logger.exception("Failed to load the mask classifier")

    try:
        face_net = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFEMODEL_PATH)
        model_status["face_detector"] = True
    except Exception:
        app.logger.exception("Failed to load the face detector")

def classify_face(face):
    return mask_model(face, training=False)

def detect_and_predict(frame):
    if frame is None: return None
    (h, w) = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104.0, 177.0, 123.0))
    face_net.setInput(blob)
    detections = face_net.forward()

    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence < FACE_CONF_THR:
            continue

        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
        (x1, y1, x2, y2) = box.astype("int")
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        face_roi = frame[y1:y2, x1:x2]
        if face_roi.size == 0: continue
        
        face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
        face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))
        face = face.astype("float32") / 255.0
        face = np.expand_dims(face, axis=0)

        prediction = float(mask_model_inference(face)[0, 0].numpy())
        
        if prediction < MASK_CONF_THR:
            label, color = "Mask", (0, 255, 0)
            conf = (1 - prediction) * 100
        else:
            label, color = "No Mask", (0, 0, 255)
            conf = prediction * 100

        cv2.putText(frame, f"{label}: {conf:.1f}%", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    
    return frame

@app.get("/")
def index():
    return send_from_directory(WEB_ROOT, "index.html")

@app.get("/health")
def health():
    ready = all(model_status.values())
    return jsonify({
        "status": "ok" if ready else "degraded",
        "application": "ready",
        "models": model_status,
    }), 200 if ready else 503

@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "Image exceeds the 8 MB upload limit."}), 413

@app.post("/api/detect")
def detect_image():
    if request.mimetype != "multipart/form-data":
        return jsonify({"error": "Upload an image using multipart/form-data."}), 400

    uploaded_file = request.files.get("image")
    if uploaded_file is None:
        return jsonify({"error": "Missing image file. Add it under the 'image' field."}), 400

    image_bytes = uploaded_file.read()
    if not image_bytes:
        return jsonify({"error": "The uploaded image is empty."}), 400

    try:
        frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    except cv2.error:
        frame = None
    if frame is None:
        return jsonify({"error": "The uploaded file is not a valid image."}), 400

    if not all(model_status.values()):
        return jsonify({"error": "Detection models are unavailable."}), 503

    try:
        with inference_lock:
            annotated_frame = detect_and_predict(frame)
        success, encoded_image = cv2.imencode(
            ".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80]
        )
        if not success:
            raise RuntimeError("JPEG encoding failed")
    except Exception:
        app.logger.exception("Image detection failed")
        return jsonify({"error": "Image processing failed."}), 500

    return app.response_class(encoded_image.tobytes(), mimetype="image/jpeg")

load_resources()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
