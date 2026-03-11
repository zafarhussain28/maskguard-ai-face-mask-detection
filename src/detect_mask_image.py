"""
detect_mask_image.py
====================
Detect faces in a single image and classify each face as
"Mask" or "No Mask" using the trained CNN model.

Uses an OpenCV DNN-based face detector (SSD + ResNet-10) instead of
Haar cascades so it can detect faces even when a mask covers the nose.

Usage:
    python src/detect_mask_image.py --image path/to/image.jpg

The annotated result is displayed on-screen and saved to the output/ folder.
"""

import os
import sys
import argparse
import cv2
import numpy as np
from tensorflow.keras.models import load_model

# ─── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT    = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH      = os.path.join(PROJECT_ROOT, "models", "mask_detector.keras")
PROTOTXT_PATH   = os.path.join(PROJECT_ROOT, "deploy.prototxt")
CAFFEMODEL_PATH = os.path.join(PROJECT_ROOT,
                               "res10_300x300_ssd_iter_140000.caffemodel")
OUTPUT_DIR      = os.path.join(PROJECT_ROOT, "output")
IMG_SIZE        = 224
FACE_CONF_THR   = 0.5
MASK_CONF_THR   = 0.5


def load_resources():
    """Load the mask classifier and the DNN face detector."""
    if not os.path.exists(MODEL_PATH):
        sys.exit(f"[ERROR] Model not found at {MODEL_PATH}. "
                 "Train first with train_model.py")
    if not os.path.exists(PROTOTXT_PATH) or not os.path.exists(CAFFEMODEL_PATH):
        sys.exit("[ERROR] DNN face detector files not found.")

    mask_model = load_model(MODEL_PATH)
    face_net   = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFEMODEL_PATH)
    return mask_model, face_net


def detect_faces(image, face_net):
    """
    Use the SSD face detector to find faces in *image*.
    Returns a list of (x1, y1, x2, y2) bounding boxes.
    """
    (h, w) = image.shape[:2]
    blob = cv2.dnn.blobFromImage(
        image, 1.0, (300, 300),
        (104.0, 177.0, 123.0),
    )
    face_net.setInput(blob)
    detections = face_net.forward()

    boxes = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence < FACE_CONF_THR:
            continue

        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
        (x1, y1, x2, y2) = box.astype("int")

        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if (x2 - x1) < 30 or (y2 - y1) < 30:
            continue

        boxes.append((x1, y1, x2, y2))

    return boxes


def detect_and_classify(image, mask_model, face_net):
    """Detect faces and classify each as Mask / No Mask."""

    boxes = detect_faces(image, face_net)

    for (x1, y1, x2, y2) in boxes:
        face_roi = image[y1:y2, x1:x2]
        face_rgb = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
        face_rgb = cv2.resize(face_rgb, (IMG_SIZE, IMG_SIZE))
        face_rgb = face_rgb.astype("float32") / 255.0
        face_rgb = np.expand_dims(face_rgb, axis=0)

        prediction = mask_model.predict(face_rgb, verbose=0)[0][0]

        if prediction < MASK_CONF_THR:
            label      = "Mask"
            confidence = (1 - prediction) * 100
            colour     = (0, 255, 0)
        else:
            label      = "No Mask"
            confidence = prediction * 100
            colour     = (0, 0, 255)

        text = f"{label}: {confidence:.1f}%"
        cv2.rectangle(image, (x1, y1), (x2, y2), colour, 2)
        text_y = y1 - 10 if y1 - 10 > 10 else y1 + 20
        cv2.putText(image, text, (x1, text_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, colour, 2)

    return image


def main():
    parser = argparse.ArgumentParser(description="Detect face masks in an image.")
    parser.add_argument("--image", "-i", required=True, help="Path to input image")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        sys.exit(f"[ERROR] Image not found: {args.image}")

    print("[INFO] Loading model and DNN face detector …")
    mask_model, face_net = load_resources()

    image = cv2.imread(args.image)
    if image is None:
        sys.exit(f"[ERROR] Could not read image: {args.image}")

    print("[INFO] Detecting faces and classifying …")
    result = detect_and_classify(image, mask_model, face_net)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    basename = os.path.basename(args.image)
    output_path = os.path.join(OUTPUT_DIR, f"result_{basename}")
    cv2.imwrite(output_path, result)
    print(f"[INFO] Result saved to {output_path}")

    cv2.imshow("Face Mask Detection", result)
    print("[INFO] Press any key to close the window.")
    cv2.waitKey(0)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
