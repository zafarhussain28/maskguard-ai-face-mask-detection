"""
detect_mask_video.py
====================
Real-time face mask detection using the webcam.

Uses an OpenCV DNN-based face detector (SSD + ResNet-10) instead of
Haar cascades.  The DNN detector reliably finds faces even when a
mask covers the nose and mouth.

For each frame the script:
  1. Detects faces with the DNN face detector
  2. Classifies each face as Mask / No Mask using the trained CNN
  3. Draws a green (Mask) or red (No Mask) bounding box with confidence

Usage:
    python src/detect_mask_video.py

Press 'q' to quit the video stream.
"""

import os
import sys
import cv2
import numpy as np
from tensorflow.keras.models import load_model

# ─── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH     = os.path.join(PROJECT_ROOT, "models", "mask_detector.keras")
PROTOTXT_PATH  = os.path.join(PROJECT_ROOT, "deploy.prototxt")
CAFFEMODEL_PATH = os.path.join(PROJECT_ROOT,
                               "res10_300x300_ssd_iter_140000.caffemodel")
IMG_SIZE        = 224
FACE_CONF_THR   = 0.5        # min confidence to consider a face detection
MASK_CONF_THR   = 0.5        # threshold for mask vs no-mask


def load_resources():
    """Load the mask classifier and the DNN face detector."""
    if not os.path.exists(MODEL_PATH):
        sys.exit(f"[ERROR] Model not found at {MODEL_PATH}. "
                 "Train first with train_model.py")
    if not os.path.exists(PROTOTXT_PATH) or not os.path.exists(CAFFEMODEL_PATH):
        sys.exit("[ERROR] DNN face detector files not found. "
                 "Make sure deploy.prototxt and "
                 "res10_300x300_ssd_iter_140000.caffemodel are in the project root.")

    mask_model = load_model(MODEL_PATH)
    face_net   = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFEMODEL_PATH)
    return mask_model, face_net


def detect_faces(frame, face_net):
    """
    Use the SSD face detector to find faces in *frame*.
    Returns a list of (x1, y1, x2, y2) bounding boxes.
    """
    (h, w) = frame.shape[:2]

    # Build a 300×300 blob with mean subtraction
    blob = cv2.dnn.blobFromImage(
        frame, 1.0, (300, 300),
        (104.0, 177.0, 123.0),   # ImageNet mean values
    )
    face_net.setInput(blob)
    detections = face_net.forward()

    boxes = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence < FACE_CONF_THR:
            continue

        # Scale the bounding box back to the frame size
        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
        (x1, y1, x2, y2) = box.astype("int")

        # Clamp to frame boundaries
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)

        # Ignore tiny detections
        if (x2 - x1) < 30 or (y2 - y1) < 30:
            continue

        boxes.append((x1, y1, x2, y2))

    return boxes


def classify_face(face_roi, mask_model):
    """
    Preprocess a face ROI and return (label, confidence, colour).

    Class indices (alphabetical from flow_from_directory):
        Mask     → 0
        Non Mask → 1
    """
    face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
    face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))
    face = face.astype("float32") / 255.0
    face = np.expand_dims(face, axis=0)

    prediction = mask_model.predict(face, verbose=0)[0][0]

    if prediction < MASK_CONF_THR:
        label      = "Mask"
        confidence = (1 - prediction) * 100
        colour     = (0, 255, 0)      # green
    else:
        label      = "No Mask"
        confidence = prediction * 100
        colour     = (0, 0, 255)      # red

    return label, confidence, colour


def main():
    print("[INFO] Loading model and DNN face detector …")
    mask_model, face_net = load_resources()

    print("[INFO] Starting webcam stream … Press 'q' to quit.")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        sys.exit("[ERROR] Cannot open webcam.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARNING] Failed to grab frame. Exiting …")
            break

        # --- Detect faces with DNN ---
        boxes = detect_faces(frame, face_net)

        for (x1, y1, x2, y2) in boxes:
            face_roi = frame[y1:y2, x1:x2]
            if face_roi.shape[0] == 0 or face_roi.shape[1] == 0:
                continue

            label, confidence, colour = classify_face(face_roi, mask_model)
            text = f"{label}: {confidence:.1f}%"

            # --- Draw bounding box & label ---
            cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)
            text_y = y1 - 10 if y1 - 10 > 10 else y1 + 20
            cv2.putText(frame, text, (x1, text_y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, colour, 2)

        # --- Show frame ---
        cv2.imshow("Face Mask Detection - Press 'q' to quit", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Stream stopped.")


if __name__ == "__main__":
    main()
