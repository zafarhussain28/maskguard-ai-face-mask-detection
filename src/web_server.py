import os
import cv2
import numpy as np
import threading
import time
import uuid
import tensorflow as tf
from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from tensorflow.keras.models import load_model

# --- Configuration & Paths ---
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
WEB_ROOT = os.path.join(PROJECT_ROOT, "web")
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "mask_detector.keras")
PROTOTXT_PATH = os.path.join(PROJECT_ROOT, "deploy.prototxt")
CAFFEMODEL_PATH = os.path.join(PROJECT_ROOT, "res10_300x300_ssd_iter_140000.caffemodel")
MAX_IMAGE_SIZE = 8 * 1024 * 1024
MAX_IMAGE_DIMENSION = 1920
MAX_IMAGE_PIXELS = 4_000_000
MAX_FACES_PER_FRAME = 10

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
        tf.config.threading.set_intra_op_parallelism_threads(1)
        tf.config.threading.set_inter_op_parallelism_threads(1)
        cv2.setNumThreads(1)
        mask_model = load_model(MODEL_PATH)
        mask_model_inference = tf.function(
            classify_face,
            input_signature=[
                tf.TensorSpec((1, IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32)
            ],
        )
        mask_model_inference(tf.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32))
        model_status["mask_classifier"] = True
    except Exception as error:
        mask_model = None
        mask_model_inference = None
        app.logger.error("Failed to load the mask classifier (%s)", type(error).__name__)

    try:
        face_net = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFEMODEL_PATH)
        model_status["face_detector"] = True
    except Exception as error:
        app.logger.error("Failed to load the face detector (%s)", type(error).__name__)

    app.logger.info(
        "Inference runtime configuration: tensorflow_intra_op_threads=%d "
        "tensorflow_inter_op_threads=%d opencv_threads=%d cpu_count=%s",
        tf.config.threading.get_intra_op_parallelism_threads(),
        tf.config.threading.get_inter_op_parallelism_threads(),
        cv2.getNumThreads(),
        os.cpu_count(),
    )

def classify_face(face):
    return mask_model(face, training=False)

def log_detection_stage(request_id, stage, stage_start=None, **details):
    elapsed_ms = (time.perf_counter() - g.detection_started) * 1000
    fields = " ".join(f"{key}={value}" for key, value in details.items())
    message = "Detection stage request_id=%s stage=%s elapsed_ms=%.2f"
    arguments = [request_id, stage, elapsed_ms]
    if stage_start is not None:
        message += " stage_ms=%.2f"
        arguments.append((time.perf_counter() - stage_start) * 1000)
    if fields:
        message += " " + fields
    app.logger.info(message, *arguments)

def detect_and_predict(frame, timings=None):
    if timings is None:
        timings = {}
    if frame is None:
        return None, 0, 0

    (h, w) = frame.shape[:2]
    g.detection_stage = "face_detector_input"
    detector_input_start = time.perf_counter()
    blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104.0, 177.0, 123.0))
    face_net.setInput(blob)
    timings["face_detector_input_ms"] = (
        time.perf_counter() - detector_input_start
    ) * 1000
    request_id = g.detection_request_id
    g.detection_stage = "face_detector_forward"
    detector_start = time.perf_counter()
    log_detection_stage(request_id, "face_detector_started")
    detections = face_net.forward()
    detector_forward_seconds = time.perf_counter() - detector_start
    timings["face_detector_forward_ms"] = detector_forward_seconds * 1000
    log_detection_stage(
        request_id,
        "face_detector_completed",
        detector_start,
        detector_input_ms=f"{timings['face_detector_input_ms']:.2f}",
    )
    detected_faces = 0
    classified_faces = 0
    bounding_box_seconds = 0.0
    crop_preprocessing_seconds = 0.0
    classifier_seconds = 0.0
    frame_scale = np.array([w, h, w, h])

    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence < FACE_CONF_THR:
            continue
        detected_faces += 1
        timings["detected_faces"] = detected_faces
        if classified_faces >= MAX_FACES_PER_FRAME:
            timings["face_limit_reached"] = True
            continue

        box_start = time.perf_counter()
        g.detection_stage = "face_bounding_box"
        box = detections[0, 0, i, 3:7] * frame_scale
        (x1, y1, x2, y2) = box.astype("int")
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        face_roi = frame[y1:y2, x1:x2]
        bounding_box_seconds += time.perf_counter() - box_start
        timings["face_bounding_boxes_ms"] = bounding_box_seconds * 1000
        timings["detected_faces"] = detected_faces
        if face_roi.size == 0:
            continue
        
        g.detection_stage = "face_crop_preprocessing"
        preprocess_start = time.perf_counter()
        face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
        face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))
        face = face.astype("float32") / 255.0
        face = np.expand_dims(face, axis=0)
        crop_preprocessing_seconds += time.perf_counter() - preprocess_start
        timings["face_crop_preprocessing_ms"] = crop_preprocessing_seconds * 1000
        log_detection_stage(
            request_id,
            "face_preprocessing_completed",
            preprocess_start,
            face_index=detected_faces,
            classified_faces=classified_faces,
        )

        classifier_start = time.perf_counter()
        g.detection_stage = "tensorflow_classifier"
        log_detection_stage(
            request_id,
            "classifier_started",
            face_index=detected_faces,
        )
        prediction = float(mask_model_inference(face)[0, 0].numpy())
        classifier_seconds += time.perf_counter() - classifier_start
        classified_faces += 1
        timings["tensorflow_classifier_ms"] = classifier_seconds * 1000
        timings["classified_faces"] = classified_faces
        log_detection_stage(
            request_id,
            "classifier_completed",
            classifier_start,
            face_index=detected_faces,
            classified_faces=classified_faces,
        )
        
        if prediction < MASK_CONF_THR:
            label, color = "Mask", (0, 255, 0)
            conf = (1 - prediction) * 100
        else:
            label, color = "No Mask", (0, 0, 255)
            conf = prediction * 100

        cv2.putText(frame, f"{label}: {conf:.1f}%", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    
    return frame, detected_faces, classified_faces, {
        "face_detector_forward_ms": detector_forward_seconds * 1000,
        "face_bounding_boxes_ms": bounding_box_seconds * 1000,
        "face_crop_preprocessing_ms": crop_preprocessing_seconds * 1000,
        "tensorflow_classifier_ms": classifier_seconds * 1000,
        "face_limit_reached": timings.get("face_limit_reached", False),
    }

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

@app.before_request
def start_detection_diagnostics():
    if request.path == "/api/detect":
        g.detection_request_id = uuid.uuid4().hex
        g.detection_started = time.perf_counter()
        g.detection_timings = {}
        g.detection_input_bytes = 0
        log_detection_stage(g.detection_request_id, "request_received")

@app.after_request
def log_detection_timing(response):
    if hasattr(g, "detection_request_id"):
        request_id = g.detection_request_id
        timings = getattr(g, "detection_timings", {})
        timings["total_ms"] = (time.perf_counter() - g.detection_started) * 1000
        response.headers["X-Request-ID"] = request_id
        app.logger.info(
            "Detection stage request_id=%s stage=response_completed "
            "elapsed_ms=%.2f status=%d input_bytes=%d detected_faces=%d "
            "classified_faces=%d face_limit_reached=%s timings_ms=%s",
            request_id,
            timings["total_ms"],
            response.status_code,
            getattr(g, "detection_input_bytes", 0),
            timings.get("detected_faces", 0),
            timings.get("classified_faces", 0),
            timings.get("face_limit_reached", False),
            timings,
        )
    return response

@app.post("/api/detect")
def detect_image():
    request_id = g.detection_request_id
    g.detection_stage = "request_validation"
    try:
        return process_detection_request(request_id)
    except Exception:
        app.logger.exception(
            "Detection request failed request_id=%s stage=%s",
            request_id,
            g.detection_stage,
        )
        return jsonify({"error": "Image processing failed."}), 500

def process_detection_request(request_id):
    if request.mimetype != "multipart/form-data":
        return jsonify({"error": "Upload an image using multipart/form-data."}), 400

    extraction_start = time.perf_counter()
    g.detection_stage = "multipart_extraction"
    uploaded_file = request.files.get("image")
    if uploaded_file is None:
        g.detection_timings["multipart_extraction_ms"] = (
            time.perf_counter() - extraction_start
        ) * 1000
        log_detection_stage(
            request_id,
            "multipart_image_missing",
            extraction_start,
        )
        return jsonify({"error": "Missing image file. Add it under the 'image' field."}), 400

    image_bytes = uploaded_file.read()
    g.detection_input_bytes = len(image_bytes)
    g.detection_timings["multipart_extraction_ms"] = (
        time.perf_counter() - extraction_start
    ) * 1000
    log_detection_stage(
        request_id,
        "multipart_image_extracted",
        extraction_start,
        input_bytes=g.detection_input_bytes,
    )
    if not image_bytes:
        return jsonify({"error": "The uploaded image is empty."}), 400

    decode_start = time.perf_counter()
    g.detection_stage = "image_decode"
    try:
        frame = cv2.imdecode(
            np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR
        )
    except cv2.error:
        g.detection_timings["image_decode_ms"] = (
            time.perf_counter() - decode_start
        ) * 1000
        app.logger.exception(
            "Image decoding raised an OpenCV exception request_id=%s",
            request_id,
        )
        return jsonify({"error": "The uploaded file is not a valid image."}), 400
    g.detection_timings["image_decode_ms"] = (time.perf_counter() - decode_start) * 1000
    if frame is None:
        log_detection_stage(request_id, "image_decode_failed", decode_start)
        return jsonify({"error": "The uploaded file is not a valid image."}), 400

    frame_dimensions = (int(frame.shape[1]), int(frame.shape[0]))
    log_detection_stage(
        request_id,
        "image_decoded",
        decode_start,
        width=frame_dimensions[0],
        height=frame_dimensions[1],
    )
    if (
        frame_dimensions[0] > MAX_IMAGE_DIMENSION
        or frame_dimensions[1] > MAX_IMAGE_DIMENSION
        or frame_dimensions[0] * frame_dimensions[1] > MAX_IMAGE_PIXELS
    ):
        return jsonify({"error": "Image dimensions exceed the detection limit."}), 413

    if not all(model_status.values()):
        app.logger.error(
            "Detection models unavailable request_id=%s", request_id
        )
        return jsonify({"error": "Detection models are unavailable."}), 503

    inference_lock_start = time.perf_counter()
    g.detection_stage = "inference_lock"
    if not inference_lock.acquire(blocking=False):
        g.detection_timings["inference_lock_wait_ms"] = (
            time.perf_counter() - inference_lock_start
        ) * 1000
        log_detection_stage(
            request_id,
            "inference_busy",
            inference_lock_start,
        )
        return jsonify({"error": "Detection service is busy. Please retry shortly."}), 429

    try:
        g.detection_stage = "face_detection_and_classification"
        annotated_frame, detected_faces, classified_faces, inference_timings = (
            detect_and_predict(frame, g.detection_timings)
        )
        g.detection_timings.update(inference_timings)
        g.detection_timings["detected_faces"] = detected_faces
        g.detection_timings["classified_faces"] = classified_faces
    finally:
        inference_lock.release()

    encoding_start = time.perf_counter()
    g.detection_stage = "jpeg_encoding"
    log_detection_stage(request_id, "jpeg_encoding_started")
    success, encoded_image = cv2.imencode(
        ".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80]
    )
    g.detection_timings["jpeg_encoding_ms"] = (
        time.perf_counter() - encoding_start
    ) * 1000
    if not success:
        raise RuntimeError("JPEG encoding failed")
    encoded_bytes = encoded_image.tobytes()
    log_detection_stage(
        request_id,
        "jpeg_encoding_completed",
        encoding_start,
        output_bytes=len(encoded_bytes),
    )

    g.detection_stage = "response_creation"
    return app.response_class(encoded_bytes, mimetype="image/jpeg")

load_resources()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
