import os
import cv2
import numpy as np
import threading
from flask import Flask, render_template, Response
from flask_cors import CORS
from tensorflow.keras.models import load_model

app = Flask(__name__)
CORS(app)  # Enable CORS for the frontend to access the stream

# --- Configuration & Paths ---
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "mask_detector.keras")
PROTOTXT_PATH = os.path.join(PROJECT_ROOT, "deploy.prototxt")
CAFFEMODEL_PATH = os.path.join(PROJECT_ROOT, "res10_300x300_ssd_iter_140000.caffemodel")

IMG_SIZE = 224
FACE_CONF_THR = 0.5
MASK_CONF_THR = 0.5

# Global Resources
mask_model = None
face_net = None
video_capture = None
current_frame = None
lock = threading.Lock()
is_running = True

def load_resources():
    global mask_model, face_net
    print("[INFO] Loading models...")
    mask_model = load_model(MODEL_PATH)
    face_net = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFEMODEL_PATH)
    print("[SUCCESS] Models loaded.")

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

        prediction = mask_model.predict(face, verbose=0)[0][0]
        
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

def camera_thread_func():
    global video_capture, current_frame, is_running
    print("[INFO] Starting background camera thread...")
    video_capture = cv2.VideoCapture(0)
    
    if not video_capture.isOpened():
        print("[ERROR] Could not open webcam. Ensure it's not used by other apps.")
        is_running = False
        return

    print("[SUCCESS] Webcam initialized in background.")
    
    while is_running:
        success, frame = video_capture.read()
        if not success:
            print("[WARNING] Could not read from webcam.")
            break
        
        # Process frame
        processed_frame = detect_and_predict(frame)
        
        # Encode
        _, buffer = cv2.imencode('.jpg', processed_frame)
        
        with lock:
            current_frame = buffer.tobytes()

    video_capture.release()
    print("[INFO] Camera thread stopped.")

def generate_frames():
    while is_running:
        with lock:
            if current_frame is None:
                continue
            frame_bytes = current_frame
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        # Slow down the generator to match frame rate and reduce CPU load
        import time
        time.sleep(0.03)

@app.route('/video_feed')
def video_feed():
    if not is_running:
        return "Camera initialization failed", 500
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/')
def index():
    print("[INFO] Health check hit on root.")
    return "MaskGuard AI Streaming Server Active"

if __name__ == "__main__":
    load_resources()
    
    # Start background thread
    t = threading.Thread(target=camera_thread_func)
    t.daemon = True
    t.start()
    
    app.run(host='0.0.0.0', port=5000, threaded=True)
