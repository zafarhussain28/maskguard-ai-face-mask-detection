/**
 * Application Routing Logic and Interactivity
 */

// Define Page Templates
const pages = {
    home: `
        <div class="hero page-section">
            <div class="hero-container">
                <div class="hero-content">
                    <div class="badge">Next-Gen Surveillance</div>
                    <h1>Intelligent <span class="text-gradient-brand">Face Mask</span> Detection</h1>
                    <p>Protect your community with our state-of-the-art AI system. Fast, reliable, and built for real-world environments.</p>
                    <div class="hero-actions">
                        <a href="#detector" class="btn btn-primary">
                            <i class="fa-solid fa-camera"></i> Launch Detector
                        </a>
                        <a href="#about" class="btn btn-secondary">
                            <i class="fa-solid fa-circle-info"></i> How It Works
                        </a>
                    </div>
                </div>
                <div class="hero-image-container">
                    <div class="glass-frame">
                        <img src="/static/assets/hero.png" alt="Mask Detection AI" class="hero-img">
                        <div class="glow-effect"></div>
                    </div>
                </div>
            </div>
        </div>

        <section class="grid-container page-section" style="animation-delay: 0.2s;">
            <div class="section-header">
                <h2>Why Choose MaskGuard?</h2>
                <p>Our system is built on cutting edge technologies balancing speed and extreme accuracy in challenging environments.</p>
            </div>
            <div class="features-grid">
                <div class="glass-card feature-card">
                    <div class="feature-icon">
                        <i class="fa-solid fa-bolt"></i>
                    </div>
                    <h3>Real-time Processing</h3>
                    <p>Optimized MobileNetV2 architecture allows for frame rates exceeding 30FPS on standard consumer hardware.</p>
                </div>
                <div class="glass-card feature-card">
                    <div class="feature-icon">
                        <i class="fa-solid fa-bullseye"></i>
                    </div>
                    <h3>High Accuracy</h3>
                    <p>Over 99% testing accuracy utilizing specialized data augmentation and transfer learning techniques.</p>
                </div>
                <div class="glass-card feature-card">
                    <div class="feature-icon">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <h3>Robust Face Tracking</h3>
                    <p>Advanced OpenCV DNN face detection reliably locates faces even when heavily occluded by masks.</p>
                </div>
            </div>
        </section>
    `,

    detector: `
        <div class="page-section" style="padding-top: 2rem;">
            <div class="section-header">
                <h2>Live <span class="text-gradient-brand">Detection</span></h2>
                <p>Face detection and mask classification run locally in your browser. Camera frames are not sent to the server.</p>
            </div>
            
            <div class="detector-container">
                <div class="video-frame">
                    <div class="camera-stage">
                        <div class="camera-view">
                            <span class="camera-view-label">Live camera</span>
                            <video id="camera-preview" autoplay muted playsinline></video>
                            <canvas id="detection-overlay" class="detection-overlay" aria-hidden="true"></canvas>
                            <div id="camera-placeholder" class="camera-placeholder">
                                <i class="fa-solid fa-video-slash"></i>
                                <p>Camera is stopped.</p>
                            </div>
                        </div>
                        <div class="camera-view">
                            <span class="camera-view-label">Local detection result</span>
                            <canvas id="detected-frame" class="detection-result-canvas" role="img" aria-label="Latest locally annotated detection frame" hidden></canvas>
                            <div id="result-placeholder" class="camera-placeholder">
                                <i class="fa-solid fa-person-circle-question"></i>
                                <p>Local detection results will appear here.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="controls detector-controls">
                    <div class="detector-status-group">
                        <div class="status-indicator">
                            <div class="dot" id="system-status"></div>
                            <span id="status-text">Camera stopped</span>
                        </div>
                        <p id="detector-message" class="detector-message" role="status" aria-live="polite">Select Start Camera to begin.</p>
                        <p id="last-detection-time" class="detector-message">No successful detections yet.</p>
                        <p class="detector-message mapping-notice">Mask labels use the existing provisional class mapping; training class indices have not been verified.</p>
                        <details id="inference-diagnostics" class="inference-diagnostics" hidden>
                            <summary>Development inference diagnostics</summary>
                            <dl>
                                <div><dt>Faces detected / classified</dt><dd id="diagnostic-face-count">—</dd></div>
                                <div><dt>Face boxes (x, y, w, h)</dt><dd id="diagnostic-face-boxes">—</dd></div>
                                <div><dt>Face detection</dt><dd id="diagnostic-detection-ms">—</dd></div>
                                <div><dt>Face crop / resize</dt><dd id="diagnostic-crop-resize-ms">—</dd></div>
                                <div><dt>RGBA pixel readback</dt><dd id="diagnostic-pixel-read-ms">—</dd></div>
                                <div><dt>RGB conversion / normalization</dt><dd id="diagnostic-normalize-ms">—</dd></div>
                                <div><dt>Tensor creation</dt><dd id="diagnostic-tensor-create-ms">—</dd></div>
                                <div><dt>Graph execution</dt><dd id="diagnostic-graph-ms">—</dd></div>
                                <div><dt>Output readback</dt><dd id="diagnostic-output-ms">—</dd></div>
                                <div><dt>Tensor disposal</dt><dd id="diagnostic-dispose-ms">—</dd></div>
                                <div><dt>Classifier total</dt><dd id="diagnostic-classifier-ms">—</dd></div>
                                <div><dt>Total frame processing</dt><dd id="diagnostic-frame-ms">—</dd></div>
                                <div><dt>Processing rate</dt><dd id="diagnostic-fps">—</dd></div>
                                <div><dt>Backend / initialization</dt><dd id="diagnostic-backend">—</dd></div>
                                <div><dt>Tensor count / bytes</dt><dd id="diagnostic-tensor-memory">—</dd></div>
                            </dl>
                        </details>
                        <button id="export-face-crop" class="btn btn-secondary crop-fixture-button" type="button" disabled hidden>
                            Export first face crop (PNG)
                        </button>
                    </div>
                    
                    <div class="camera-actions">
                        <button class="btn btn-primary" id="start-camera" type="button">
                            <i class="fa-solid fa-play"></i> Start Camera
                        </button>
                        <button class="btn btn-secondary" id="stop-camera" type="button" disabled>
                            <i class="fa-solid fa-stop"></i> Stop Camera
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,

    facts: `
        <div class="grid-container page-section">
            <div class="section-header">
                <h2>Mask <span class="text-gradient-brand">Facts & Studies</span></h2>
                <p>The science behind why face coverings remain an effective tool in enclosed public spaces.</p>
            </div>
            
            <div class="features-grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem; color: var(--brand-accent)"><i class="fa-solid fa-viruses"></i> Droplet Reduction</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Studies have shown that high-quality masks (N95, KN95) filter out up to 95% of airborne particles. Even surgical masks significantly reduce the forward distance of exhalation plumes and droplet spread.</p>
                </div>
                
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem; color: var(--success)"><i class="fa-solid fa-shield-cat"></i> Source Control</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">The primary benefit of universal masking is "source control"—preventing infected persons (who may be asymptomatic) from spreading respiratory droplets into the shared air space.</p>
                </div>

                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem; color: var(--brand-primary)"><i class="fa-solid fa-layer-group"></i> Best Practices</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">A mask is most effective when it fits snugly over both the <strong>nose and mouth</strong> without gaps. A mask improperly worn (e.g., under the nose) severely compromises its filtering capability.</p>
                </div>
            </div>
        </div>
    `,

    about: `
        <div class="grid-container page-section">
            <div class="section-header">
                <h2>About <span class="text-gradient-brand">The Project</span></h2>
                <p>Learn more about the architecture and deep learning processes powering MaskGuard AI.</p>
            </div>
            
            <div class="glass-card" style="max-width: 800px; margin: 0 auto;">
                <h3 style="margin-bottom: 1rem;">Technical Architecture</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">The system is divided into two primary inference stages:</p>
                
                <ol style="color: var(--text-secondary); margin-left: 1.5rem; margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem;">
                    <li><strong>Browser face detection:</strong> Live prototype detection uses MediaPipe's short-range face detector locally in the browser. The Flask API remains available and retains its OpenCV SSD detector.</li>
                    <li><strong>Mask classification:</strong> Face crops are classified locally with the existing MobileNetV2 TensorFlow.js GraphModel. The original Keras model and Flask endpoint remain unchanged.</li>
                </ol>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">The current mask/no-mask class mapping is provisional because the training class-index metadata is not available in this workspace.</p>

                <h3 style="margin-bottom: 1rem;">Model Training</h3>
                <p style="color: var(--text-secondary);">The classifier was trained using a standard dataset of faces with and without masks, utilizing extreme image augmentation (rotation, zooming, shifts, shearing) to combat overfitting and improve generalization on novel faces.</p>
            </div>
        </div>
    `
};

// Routing Logic
const contentDiv = document.getElementById('main-content');
const navLinks = document.querySelectorAll('.nav-link');
let mediaStream = null;
let detectionTimer = null;
let detectionSession = 0;
let inferenceWorker = null;
let inferenceWorkerReadyReject = null;
let inferenceInFlight = false;
let inferenceFrameCallbackId = null;
let inferenceFailed = false;
let inferenceCompletionTimes = [];
let diagnosticCropFixture = null;
const MAX_FRAME_WIDTH = 480;
const CAMERA_READY_CHECK_INTERVAL_MS = 100;
const pageOptions = new URLSearchParams(window.location.search);
const MODEL_OUTPUT_MEANS_MASK = pageOptions.get('maskProbabilityMeansMask') !== 'false';
const DEVELOPMENT_DIAGNOSTICS_ENABLED = pageOptions.get('diagnostics') === '1';
const CAPTURE_FIRST_FACE_CROP = DEVELOPMENT_DIAGNOSTICS_ENABLED
    && pageOptions.get('captureCrop') === '1';

function setDetectorStatus(message, active = false) {
    const statusText = document.getElementById('status-text');
    const detectorMessage = document.getElementById('detector-message');
    const statusDot = document.getElementById('system-status');

    if (statusText) statusText.textContent = active ? 'Camera active' : 'Camera stopped';
    if (detectorMessage) detectorMessage.textContent = message;
    if (statusDot) statusDot.classList.toggle('active', active);
}

function stopInferenceLoop() {
    window.clearTimeout(detectionTimer);
    detectionTimer = null;
    const preview = document.getElementById('camera-preview');
    if (preview && inferenceFrameCallbackId !== null
        && typeof preview.cancelVideoFrameCallback === 'function') {
        preview.cancelVideoFrameCallback(inferenceFrameCallbackId);
    }
    inferenceFrameCallbackId = null;
}

function clearDetectionCanvases() {
    for (const canvasId of ['detection-overlay', 'detected-frame']) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) continue;
        const context = canvas.getContext('2d');
        if (context) context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
    }
    const detectedFrame = document.getElementById('detected-frame');
    if (detectedFrame) detectedFrame.hidden = true;
    const resultPlaceholder = document.getElementById('result-placeholder');
    if (resultPlaceholder) resultPlaceholder.hidden = false;
}

function disposeInferenceWorker() {
    if (!inferenceWorker) return;
    inferenceWorker.postMessage({ type: 'dispose' });
    const workerToStop = inferenceWorker;
    inferenceWorker = null;
    window.setTimeout(() => workerToStop.terminate(), 250);
}

function stopCamera(showStatus = true) {
    detectionSession += 1;
    stopInferenceLoop();
    if (inferenceWorkerReadyReject) {
        inferenceWorkerReadyReject(new Error('Camera startup was cancelled.'));
        inferenceWorkerReadyReject = null;
    }
    disposeInferenceWorker();
    inferenceInFlight = false;
    inferenceFailed = false;
    inferenceCompletionTimes = [];
    diagnosticCropFixture = null;

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    const preview = document.getElementById('camera-preview');
    if (preview) {
        preview.pause();
        preview.srcObject = null;
    }

    const cameraPlaceholder = document.getElementById('camera-placeholder');
    if (cameraPlaceholder) cameraPlaceholder.hidden = false;

    const startButton = document.getElementById('start-camera');
    const stopButton = document.getElementById('stop-camera');
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;
    const exportCropButton = document.getElementById('export-face-crop');
    if (exportCropButton) exportCropButton.disabled = true;

    clearDetectionCanvases();

    if (showStatus) setDetectorStatus('Camera stopped. Select Start Camera when you are ready.');
}

function cameraErrorMessage(error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return 'No camera was found. Connect a camera and try again.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        return 'The camera is unavailable or already in use by another application.';
    }
    return 'Could not start the camera. Check your browser and camera settings, then try again.';
}

function drawDetectionOverlay(canvas, width, height, faces) {
    if (!canvas) return;
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.font = `bold ${Math.max(14, Math.round(width / 34))}px sans-serif`;
    context.textBaseline = 'top';

    for (const face of faces) {
        const color = face.mask ? '#22c55e' : '#ef4444';
        const box = face.boundingBox;
        context.strokeStyle = color;
        context.lineWidth = Math.max(2, width / 240);
        context.strokeRect(box.originX, box.originY, box.width, box.height);

        const label = `${face.label} ${face.confidence.toFixed(1)}%`;
        const textWidth = context.measureText(label).width;
        const labelY = Math.max(0, box.originY - Math.max(22, width / 22));
        context.fillStyle = color;
        context.fillRect(box.originX, labelY, textWidth + 10, Math.max(22, width / 22));
        context.fillStyle = '#ffffff';
        context.fillText(label, box.originX + 5, labelY + 3);
    }
}

function renderInferenceResult(result) {
    const {
        width,
        height,
        faces,
        resultFrame,
        elapsedMs,
        detectedFaceCount,
        classifiedFaceCount,
        detectionMs,
        cropResizeMs,
        pixelReadMs,
        normalizationMs,
        tensorCreationMs,
        graphExecutionMs,
        outputReadMs,
        tensorDisposalMs,
        classificationMs,
        tensorCount,
        tensorBytes
    } = result;
    const overlay = document.getElementById('detection-overlay');
    const detectedFrame = document.getElementById('detected-frame');
    const placeholder = document.getElementById('result-placeholder');
    if (!overlay || !detectedFrame || !resultFrame) {
        if (resultFrame) resultFrame.close();
        return;
    }

    drawDetectionOverlay(overlay, width, height, faces);
    if (detectedFrame.width !== width || detectedFrame.height !== height) {
        detectedFrame.width = width;
        detectedFrame.height = height;
    }
    const context = detectedFrame.getContext('2d');
    context.drawImage(resultFrame, 0, 0, width, height);
    resultFrame.close();
    detectedFrame.hidden = false;
    if (placeholder) placeholder.hidden = true;

    const detectedAt = new Date();
    const lastDetectionTime = document.getElementById('last-detection-time');
    if (lastDetectionTime) {
        lastDetectionTime.textContent = `Last local inference: ${detectedAt.toLocaleTimeString()} (${elapsedMs.toFixed(0)} ms)`;
    }
    updateInferenceDiagnostics({
        detectedFaceCount,
        classifiedFaceCount,
        faces,
        detectionMs,
        cropResizeMs,
        pixelReadMs,
        normalizationMs,
        tensorCreationMs,
        graphExecutionMs,
        outputReadMs,
        tensorDisposalMs,
        classificationMs,
        elapsedMs,
        tensorCount,
        tensorBytes
    });
    const summary = faces.length === 0
        ? 'No faces detected. Processing remains on this device.'
        : `Locally classified ${faces.length} face${faces.length === 1 ? '' : 's'} in ${elapsedMs.toFixed(0)} ms.`;
    setDetectorStatus(summary, true);
}

function updateInferenceDiagnostics(metrics) {
    const completionTime = performance.now();
    inferenceCompletionTimes.push(completionTime);
    inferenceCompletionTimes = inferenceCompletionTimes.filter(
        time => completionTime - time <= 5000
    );
    const firstCompletion = inferenceCompletionTimes[0];
    const completionInterval = completionTime - firstCompletion;
    const processingFps = inferenceCompletionTimes.length > 1
        ? (inferenceCompletionTimes.length - 1) * 1000 / completionInterval
        : 0;
    const diagnosticValues = {
        'diagnostic-face-count': `${metrics.detectedFaceCount} / ${metrics.classifiedFaceCount}`,
        'diagnostic-face-boxes': metrics.faces.length
            ? metrics.faces.map(({ boundingBox }) => {
                const { originX, originY, width, height } = boundingBox;
                return `${originX}, ${originY}, ${width}, ${height}`;
            }).join('; ')
            : 'None',
        'diagnostic-detection-ms': `${metrics.detectionMs.toFixed(1)} ms`,
        'diagnostic-crop-resize-ms': `${metrics.cropResizeMs.toFixed(1)} ms`,
        'diagnostic-pixel-read-ms': `${metrics.pixelReadMs.toFixed(1)} ms`,
        'diagnostic-normalize-ms': `${metrics.normalizationMs.toFixed(1)} ms`,
        'diagnostic-tensor-create-ms': `${metrics.tensorCreationMs.toFixed(1)} ms`,
        'diagnostic-graph-ms': `${metrics.graphExecutionMs.toFixed(1)} ms`,
        'diagnostic-output-ms': `${metrics.outputReadMs.toFixed(1)} ms`,
        'diagnostic-dispose-ms': `${metrics.tensorDisposalMs.toFixed(1)} ms`,
        'diagnostic-classifier-ms': `${metrics.classificationMs.toFixed(1)} ms`,
        'diagnostic-frame-ms': `${metrics.elapsedMs.toFixed(1)} ms`,
        'diagnostic-fps': `${processingFps.toFixed(1)} FPS`,
        'diagnostic-tensor-memory': `${metrics.tensorCount} / ${metrics.tensorBytes}`,
    };
    for (const [id, value] of Object.entries(diagnosticValues)) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
}

function setModelInitializationDiagnostic(backend, initializationMs) {
    const element = document.getElementById('diagnostic-backend');
    if (element) element.textContent = `${backend} / ${initializationMs.toFixed(1)} ms`;
}

function exportDiagnosticFaceCrop() {
    if (!diagnosticCropFixture) return;
    const { width, height, data } = diagnosticCropFixture;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        setDetectorStatus('Could not export the local face-crop fixture.', true);
        return;
    }

    const imageData = context.createImageData(width, height);
    for (let source = 0, target = 0; source < data.length; source += 3) {
        imageData.data[target++] = data[source];
        imageData.data[target++] = data[source + 1];
        imageData.data[target++] = data[source + 2];
        imageData.data[target++] = 255;
    }
    context.putImageData(imageData, 0, 0);
    canvas.toBlob(blob => {
        if (!blob) {
            setDetectorStatus('Could not encode the local face-crop fixture.', true);
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'maskguard-face-crop-224.png';
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

function startInferenceWorker(session) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('/static/browser_inference_worker.js');
        inferenceWorker = worker;
        let initialized = false;
        const initializationTimeout = window.setTimeout(() => {
            reject(new Error('Browser inference initialization timed out.'));
        }, 90000);

        inferenceWorkerReadyReject = error => {
            window.clearTimeout(initializationTimeout);
            reject(error);
        };
        worker.onmessage = event => {
            const message = event.data || {};
            if (session !== detectionSession) {
                if (message.resultFrame) message.resultFrame.close();
                return;
            }
            if (message.type === 'ready') {
                initialized = true;
                window.clearTimeout(initializationTimeout);
                inferenceWorkerReadyReject = null;
                setModelInitializationDiagnostic(message.backend, message.initializationMs);
                resolve(message);
                return;
            }
            if (message.type === 'frame') {
                inferenceInFlight = false;
                if (message.cropFixture) {
                    diagnosticCropFixture = message.cropFixture;
                    const exportCropButton = document.getElementById('export-face-crop');
                    if (exportCropButton) exportCropButton.disabled = false;
                }
                renderInferenceResult(message);
                return;
            }
            if (message.type === 'error') {
                inferenceInFlight = false;
                inferenceFailed = true;
                stopInferenceLoop();
                setDetectorStatus(`Local inference failed: ${message.message} Frames are not being sent to the server.`, true);
                if (!initialized) {
                    window.clearTimeout(initializationTimeout);
                    inferenceWorkerReadyReject = null;
                    reject(new Error(message.message));
                }
            }
        };
        worker.onerror = () => {
            inferenceInFlight = false;
            inferenceFailed = true;
            stopInferenceLoop();
            const error = new Error('Could not start the local inference worker. No frames were sent to the server.');
            if (!initialized) {
                window.clearTimeout(initializationTimeout);
                inferenceWorkerReadyReject = null;
                reject(error);
            } else {
                setDetectorStatus(error.message, true);
            }
        };
        worker.postMessage({
            type: 'initialize',
            maskProbabilityMeansMask: MODEL_OUTPUT_MEANS_MASK,
            includeDiagnosticOutputs: DEVELOPMENT_DIAGNOSTICS_ENABLED,
            captureFirstFaceCrop: CAPTURE_FIRST_FACE_CROP
        });
    });
}

async function dispatchVideoFrame(session, video, timestamp) {
    if (session !== detectionSession || !inferenceWorker || inferenceFailed || inferenceInFlight) return;
    inferenceInFlight = true;
    try {
        const frame = await createImageBitmap(video);
        if (session !== detectionSession || !inferenceWorker || inferenceFailed) {
            frame.close();
            inferenceInFlight = false;
            return;
        }
        inferenceWorker.postMessage(
            { type: 'frame', frame, timestamp },
            [frame]
        );
    } catch (error) {
        inferenceInFlight = false;
        inferenceFailed = true;
        stopInferenceLoop();
        setDetectorStatus(`Could not capture a local video frame: ${error.message}`, true);
    }
}

function startInferenceLoop(session) {
    const preview = document.getElementById('camera-preview');
    const scheduleNext = () => {
        if (session !== detectionSession || !mediaStream || inferenceFailed) return;
        if (typeof preview.requestVideoFrameCallback === 'function') {
            inferenceFrameCallbackId = preview.requestVideoFrameCallback((now, metadata) => {
                dispatchVideoFrame(session, preview, metadata.mediaTime * 1000);
                scheduleNext();
            });
        } else {
            detectionTimer = window.setTimeout(() => {
                dispatchVideoFrame(session, preview, performance.now());
                scheduleNext();
            }, CAMERA_READY_CHECK_INTERVAL_MS);
        }
    };
    scheduleNext();
}

async function startCamera() {
    if (mediaStream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDetectorStatus('Camera access requires a supported browser and a secure HTTPS connection.');
        return;
    }

    const startButton = document.getElementById('start-camera');
    const stopButton = document.getElementById('stop-camera');
    if (startButton) startButton.disabled = true;
    setDetectorStatus('Requesting camera permission...');

    const session = ++detectionSession;
    inferenceCompletionTimes = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'user' },
                width: { ideal: MAX_FRAME_WIDTH, max: MAX_FRAME_WIDTH },
                frameRate: { ideal: 15, max: 15 }
            },
            audio: false
        });

        if (session !== detectionSession || !document.getElementById('camera-preview')) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        mediaStream = stream;
        const preview = document.getElementById('camera-preview');
        preview.srcObject = stream;
        await preview.play();
        if (session !== detectionSession) return;
        const cameraPlaceholder = document.getElementById('camera-placeholder');
        if (cameraPlaceholder) cameraPlaceholder.hidden = true;
        if (stopButton) stopButton.disabled = false;
        setDetectorStatus('Camera is active. Loading local face detector and classifier...', true);
        await startInferenceWorker(session);
        if (session !== detectionSession || !mediaStream) return;
        setDetectorStatus('Local models ready. Frames remain on this device; classifier labels are provisional.', true);
        startInferenceLoop(session);
    } catch (error) {
        if (session !== detectionSession) return;
        stopCamera(false);
        const cameraErrors = [
            'NotAllowedError',
            'SecurityError',
            'NotFoundError',
            'DevicesNotFoundError',
            'NotReadableError',
            'TrackStartError'
        ];
        if (cameraErrors.includes(error.name)) {
            setDetectorStatus(cameraErrorMessage(error));
        } else {
            setDetectorStatus(`Could not start local detection: ${error.message} No camera frames were sent to the server.`);
        }
    }
}

function navigateTo(pageId) {
    // Default to home if invalid
    if (!pages[pageId]) {
        pageId = 'home';
    }

    if (pageId !== 'detector' && document.getElementById('camera-preview')) {
        stopCamera(false);
    }

    // Update Content
    contentDiv.innerHTML = pages[pageId];

    const diagnostics = document.getElementById('inference-diagnostics');
    if (diagnostics) diagnostics.hidden = !DEVELOPMENT_DIAGNOSTICS_ENABLED;
    const exportCropButton = document.getElementById('export-face-crop');
    if (exportCropButton) {
        exportCropButton.hidden = !CAPTURE_FIRST_FACE_CROP;
        exportCropButton.disabled = true;
        exportCropButton.addEventListener('click', exportDiagnosticFaceCrop);
    }

    const startButton = document.getElementById('start-camera');
    const stopButton = document.getElementById('stop-camera');
    if (startButton) startButton.addEventListener('click', startCamera);
    if (stopButton) stopButton.addEventListener('click', () => stopCamera());

    // Update Active Nav Style
    navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${pageId}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Scroll to top
    window.scrollTo(0, 0);
}

// Listen for hash changes
window.addEventListener('hashchange', () => {
    const pageId = window.location.hash.substring(1) || 'home';
    navigateTo(pageId);
});

// Scroll effect for Navbar
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Simulation logic for Detector page
window.toggleSim = function() {
    const dot = document.getElementById('system-status');
    const span = dot.nextElementSibling;
    
    if (dot.classList.contains('active')) {
        dot.classList.remove('active');
        span.textContent = 'System Offline';
    } else {
        dot.classList.add('active');
        span.textContent = 'Simulation Active (Tracking 0/0)';
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const pageId = window.location.hash.substring(1) || 'home';
    navigateTo(pageId);
});
