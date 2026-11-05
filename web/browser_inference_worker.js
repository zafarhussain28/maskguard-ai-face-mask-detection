const TENSORFLOW_JS_SCRIPT =
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const TENSORFLOW_WASM_BACKEND_SCRIPT =
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js';
const TENSORFLOW_WASM_PATH =
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/';
const MEDIAPIPE_MODULE =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm';
const MEDIAPIPE_WASM_PATH =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const CLASSIFIER_MODEL_PATH = '/static/models/maskguard_graph/model.json';
const FACE_DETECTOR_MODEL_PATH = '/static/models/mediapipe/blaze_face_short_range.tflite';
const CLASSIFIER_INPUT_SIZE = 224;
const FACE_DETECTION_CONFIDENCE = 0.5;

let tf = null;
let classifier = null;
let faceDetector = null;
let cropCanvas = null;
let cropContext = null;
let resultCanvas = null;
let resultContext = null;
let maskProbabilityMeansMask = true;
let includeDiagnosticOutputs = false;
let captureFirstFaceCrop = false;
let lastVideoTimestamp = -1;

self.onmessage = async event => {
    const message = event.data || {};
    if (message.type === 'initialize') {
        try {
            const initializationStartedAt = performance.now();
            await initialize(
                message.maskProbabilityMeansMask,
                message.includeDiagnosticOutputs,
                message.captureFirstFaceCrop
            );
            self.postMessage({
                type: 'ready',
                backend: tf.getBackend(),
                inputShape: classifier.inputs[0].shape,
                outputShape: [1, 1],
                initializationMs: performance.now() - initializationStartedAt
            });
        } catch (error) {
            console.error('Browser inference initialization failed:', error);
            self.postMessage({
                type: 'error',
                message: 'Could not load the local inference models or browser runtimes.'
            });
        }
        return;
    }

    if (message.type === 'frame') {
        try {
            await processFrame(message.frame, message.timestamp);
        } catch (error) {
            console.error('Browser inference frame failed:', error);
            self.postMessage({
                type: 'error',
                message: 'Local face detection or classification failed.'
            });
            if (message.frame) message.frame.close();
        }
        return;
    }

    if (message.type === 'dispose') {
        disposeModels();
        self.postMessage({ type: 'disposed' });
    }
};

async function initialize(
    configuredMaskMapping,
    includeOutputsForDiagnostics,
    shouldCaptureFirstFaceCrop
) {
    maskProbabilityMeansMask = configuredMaskMapping !== false;
    includeDiagnosticOutputs = includeOutputsForDiagnostics === true;
    captureFirstFaceCrop = shouldCaptureFirstFaceCrop === true;
    const visionPromise = import(MEDIAPIPE_MODULE);
    importScripts(TENSORFLOW_JS_SCRIPT);
    tf = self.tf;
    let backendReady = false;
    try {
        importScripts(TENSORFLOW_WASM_BACKEND_SCRIPT);
        tf.wasm.setWasmPaths(TENSORFLOW_WASM_PATH);
        backendReady = await tf.setBackend('wasm');
        if (backendReady) await tf.ready();
    } catch (error) {
        backendReady = false;
        console.warn('TensorFlow.js WASM backend unavailable; trying WebGL.', error);
    }
    if (!backendReady) {
        console.info('TensorFlow.js WASM backend did not initialize; trying WebGL.');
    }
    if (!backendReady) {
        try {
            backendReady = await tf.setBackend('webgl');
            if (backendReady) await tf.ready();
        } catch (error) {
            backendReady = false;
            console.warn('TensorFlow.js WebGL backend unavailable; trying CPU.', error);
        }
    }
    if (!backendReady) {
        console.info('TensorFlow.js WebGL backend did not initialize; trying CPU.');
    }
    if (!backendReady) {
        backendReady = await tf.setBackend('cpu');
        if (!backendReady) throw new Error('TensorFlow.js CPU backend is unavailable.');
        await tf.ready();
    }
    const vision = await visionPromise;

    classifier = await tf.loadGraphModel(CLASSIFIER_MODEL_PATH);
    const inputShape = classifier.inputs[0].shape;
    if (
        inputShape.length !== 4
        || inputShape[1] !== CLASSIFIER_INPUT_SIZE
        || inputShape[2] !== CLASSIFIER_INPUT_SIZE
        || inputShape[3] !== 3
    ) {
        throw new Error('Unexpected classifier input shape.');
    }

    const warmup = tf.zeros([1, CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE, 3]);
    let warmupOutputs;
    try {
        warmupOutputs = classifier.execute(warmup);
        const outputTensor = firstTensor(warmupOutputs);
        if (!outputTensor || outputTensor.shape.length !== 2 || outputTensor.shape[1] !== 1) {
            throw new Error('Unexpected classifier output shape.');
        }
        await outputTensor.data();
    } finally {
        tf.dispose([warmup, warmupOutputs]);
    }

    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
    faceDetector = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL_PATH },
        runningMode: 'VIDEO',
        minDetectionConfidence: FACE_DETECTION_CONFIDENCE,
        minSuppressionThreshold: 0.3
    });

    cropCanvas = new OffscreenCanvas(CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE);
    cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });
    resultCanvas = new OffscreenCanvas(1, 1);
    resultContext = resultCanvas.getContext('2d');
    if (!cropContext || !resultContext) {
        throw new Error('Offscreen canvas is unavailable.');
    }
}

function firstTensor(outputs) {
    if (Array.isArray(outputs)) return outputs[0];
    if (outputs && typeof outputs === 'object' && !('data' in outputs)) {
        return Object.values(outputs)[0];
    }
    return outputs;
}

function resizeResultCanvas(width, height) {
    if (resultCanvas.width !== width || resultCanvas.height !== height) {
        resultCanvas.width = width;
        resultCanvas.height = height;
    }
}

function getClippedBoundingBox(detection, width, height) {
    const box = detection.boundingBox;
    if (!box) return null;
    const left = Math.max(0, Math.floor(box.originX));
    const top = Math.max(0, Math.floor(box.originY));
    const right = Math.min(width, Math.ceil(box.originX + box.width));
    const bottom = Math.min(height, Math.ceil(box.originY + box.height));
    if (right <= left || bottom <= top) return null;
    return { originX: left, originY: top, width: right - left, height: bottom - top };
}

function copyNormalizedFaceCrop(frame, box, batch, faceIndex, captureCrop) {
    const startedAt = performance.now();
    const cropResizeStartedAt = performance.now();
    cropContext.clearRect(0, 0, CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE);
    cropContext.drawImage(
        frame,
        box.originX,
        box.originY,
        box.width,
        box.height,
        0,
        0,
        CLASSIFIER_INPUT_SIZE,
        CLASSIFIER_INPUT_SIZE
    );
    const cropResizeMs = performance.now() - cropResizeStartedAt;
    const pixelReadStartedAt = performance.now();
    const pixels = cropContext.getImageData(
        0,
        0,
        CLASSIFIER_INPUT_SIZE,
        CLASSIFIER_INPUT_SIZE
    ).data;
    const pixelReadMs = performance.now() - pixelReadStartedAt;
    const batchOffset = faceIndex * CLASSIFIER_INPUT_SIZE * CLASSIFIER_INPUT_SIZE * 3;
    const normalizationStartedAt = performance.now();
    const cropFixture = captureCrop
        ? new Uint8Array(batchOffset + pixels.length / 4 * 3)
        : null;
    for (let source = 0, target = batchOffset; source < pixels.length; source += 4) {
        batch[target++] = pixels[source] / 255;
        batch[target++] = pixels[source + 1] / 255;
        batch[target++] = pixels[source + 2] / 255;
        if (cropFixture) {
            const fixtureOffset = (source / 4) * 3;
            cropFixture[fixtureOffset] = pixels[source];
            cropFixture[fixtureOffset + 1] = pixels[source + 1];
            cropFixture[fixtureOffset + 2] = pixels[source + 2];
        }
    }
    const normalizationMs = performance.now() - normalizationStartedAt;
    return {
        cropFixture,
        cropResizeMs,
        pixelReadMs,
        normalizationMs,
        elapsedMs: performance.now() - startedAt
    };
}

function drawAnnotatedFaces(faces) {
    const fontSize = Math.max(14, Math.round(resultCanvas.width / 34));
    resultContext.font = `bold ${fontSize}px sans-serif`;
    resultContext.textBaseline = 'top';
    for (const face of faces) {
        const box = face.boundingBox;
        const color = face.mask ? '#22c55e' : '#ef4444';
        resultContext.strokeStyle = color;
        resultContext.lineWidth = Math.max(2, resultCanvas.width / 240);
        resultContext.strokeRect(box.originX, box.originY, box.width, box.height);
        const label = `${face.label} ${face.confidence.toFixed(1)}%`;
        const textWidth = resultContext.measureText(label).width;
        const labelHeight = Math.max(22, resultCanvas.width / 22);
        const labelY = Math.max(0, box.originY - labelHeight);
        resultContext.fillStyle = color;
        resultContext.fillRect(box.originX, labelY, textWidth + 10, labelHeight);
        resultContext.fillStyle = '#ffffff';
        resultContext.fillText(label, box.originX + 5, labelY + 3);
    }
}

async function processFrame(frame, timestamp) {
    if (!frame || !faceDetector || !classifier) {
        if (frame) frame.close();
        throw new Error('Local inference is not ready.');
    }
    const startedAt = performance.now();
    const width = frame.width;
    const height = frame.height;
    resizeResultCanvas(width, height);
    resultContext.drawImage(frame, 0, 0, width, height);

    const safeTimestamp = Math.max(Number(timestamp) || performance.now(), lastVideoTimestamp + 0.001);
    lastVideoTimestamp = safeTimestamp;
    const detectionStartedAt = performance.now();
    const detectorResult = faceDetector.detectForVideo(frame, safeTimestamp);
    const detectionMs = performance.now() - detectionStartedAt;
    const boxes = (detectorResult.detections || [])
        .map(detection => getClippedBoundingBox(detection, width, height))
        .filter(Boolean);

    const faces = [];
    let classificationMs = 0;
    let cropAndNormalizeMs = 0;
    let cropResizeMs = 0;
    let pixelReadMs = 0;
    let normalizationMs = 0;
    let tensorCreationMs = 0;
    let graphExecutionMs = 0;
    let outputReadMs = 0;
    let tensorDisposalMs = 0;
    let cropFixture = null;
    if (boxes.length) {
        const batch = new Float32Array(
            boxes.length * CLASSIFIER_INPUT_SIZE * CLASSIFIER_INPUT_SIZE * 3
        );
        boxes.forEach((box, index) => {
            const cropResult = copyNormalizedFaceCrop(
                frame,
                box,
                batch,
                index,
                captureFirstFaceCrop && index === 0
            );
            cropAndNormalizeMs += cropResult.elapsedMs;
            cropResizeMs += cropResult.cropResizeMs;
            pixelReadMs += cropResult.pixelReadMs;
            normalizationMs += cropResult.normalizationMs;
            if (cropResult.cropFixture) {
                cropFixture = {
                    width: CLASSIFIER_INPUT_SIZE,
                    height: CLASSIFIER_INPUT_SIZE,
                    data: cropResult.cropFixture
                };
                captureFirstFaceCrop = false;
            }
        });
        const tensorCreationStartedAt = performance.now();
        const input = tf.tensor4d(
            batch,
            [boxes.length, CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE, 3],
            'float32'
        );
        tensorCreationMs = performance.now() - tensorCreationStartedAt;
        let outputs;
        try {
            const classificationStartedAt = performance.now();
            const graphExecutionStartedAt = performance.now();
            outputs = classifier.execute(input);
            graphExecutionMs = performance.now() - graphExecutionStartedAt;
            const outputReadStartedAt = performance.now();
            const probabilities = await firstTensor(outputs).data();
            outputReadMs = performance.now() - outputReadStartedAt;
            classificationMs = performance.now() - classificationStartedAt;
            boxes.forEach((boundingBox, index) => {
                const probability = Number(probabilities[index]);
                const mask = maskProbabilityMeansMask
                    ? probability < 0.5
                    : probability >= 0.5;
                const face = {
                    boundingBox,
                    mask,
                    label: mask ? 'Mask' : 'No Mask',
                    confidence: (mask ? 1 - probability : probability) * 100
                };
                if (includeDiagnosticOutputs) face.probability = probability;
                faces.push(face);
            });
        } finally {
            const tensorDisposalStartedAt = performance.now();
            tf.dispose([input, outputs]);
            tensorDisposalMs = performance.now() - tensorDisposalStartedAt;
        }
        drawAnnotatedFaces(faces);
    }

    const resultFrame = resultCanvas.transferToImageBitmap();
    frame.close();
    const tensorMemory = tf.memory();
    const transferables = [resultFrame];
    if (cropFixture) transferables.push(cropFixture.data.buffer);
    self.postMessage({
        type: 'frame',
        width,
        height,
        faces,
        detectedFaceCount: boxes.length,
        classifiedFaceCount: faces.length,
        cropFixture,
        resultFrame,
        detectionMs,
        classificationMs,
        cropAndNormalizeMs,
        cropResizeMs,
        pixelReadMs,
        normalizationMs,
        tensorCreationMs,
        graphExecutionMs,
        outputReadMs,
        tensorDisposalMs,
        elapsedMs: performance.now() - startedAt,
        tensorCount: tensorMemory.numTensors,
        tensorBytes: tensorMemory.numBytes
    }, transferables);
}

function disposeModels() {
    if (faceDetector) faceDetector.close();
    faceDetector = null;
    if (classifier) classifier.dispose();
    classifier = null;
    if (cropCanvas) {
        cropCanvas.width = 0;
        cropCanvas.height = 0;
    }
    if (resultCanvas) {
        resultCanvas.width = 0;
        resultCanvas.height = 0;
    }
    cropCanvas = null;
    cropContext = null;
    resultCanvas = null;
    resultContext = null;
    tf = null;
}
