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
                <p>Camera frames are processed securely by the MaskGuard detection service.</p>
            </div>
            
            <div class="detector-container">
                <div class="video-frame">
                    <div class="camera-stage">
                        <div class="camera-view">
                            <span class="camera-view-label">Live camera</span>
                            <video id="camera-preview" autoplay muted playsinline></video>
                            <div id="camera-placeholder" class="camera-placeholder">
                                <i class="fa-solid fa-video-slash"></i>
                                <p>Camera is stopped.</p>
                            </div>
                        </div>
                        <div class="camera-view">
                            <span class="camera-view-label">Mask detection</span>
                            <img id="detected-frame" alt="Latest annotated detection frame">
                            <div id="result-placeholder" class="camera-placeholder">
                                <i class="fa-solid fa-person-circle-question"></i>
                                <p>Detection results will appear here.</p>
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
                    <li><strong>Face Detection:</strong> We leverage OpenCV's deep learning-based face detector (Single Shot Detector with ResNet-10 backbone) via the <code>deploy.prototxt</code> and Caffe model. This accurately segments faces from the frame irrespective of angle or lighting.</li>
                    <li><strong>Mask Classification:</strong> The localized face Region of Interest (ROI) is passed to a custom fine-tuned MobileNetV2 network. MobileNetV2 uses lightweight depthwise separable convolutions, making it ideal for high-framerate real-time processing while extracting complex spatial features.</li>
                </ol>

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
let detectionAbortController = null;
let detectionSession = 0;
let detectionImageUrl = null;
const MAX_FRAME_WIDTH = 640;
const FRAME_INTERVAL_MS = 50;
const captureCanvas = document.createElement('canvas');
const captureContext = captureCanvas.getContext('2d', { alpha: false });

function setDetectorStatus(message, active = false) {
    const statusText = document.getElementById('status-text');
    const detectorMessage = document.getElementById('detector-message');
    const statusDot = document.getElementById('system-status');

    if (statusText) statusText.textContent = active ? 'Camera active' : 'Camera stopped';
    if (detectorMessage) detectorMessage.textContent = message;
    if (statusDot) statusDot.classList.toggle('active', active);
}

function stopCamera(showStatus = true) {
    detectionSession += 1;
    window.clearTimeout(detectionTimer);
    detectionTimer = null;
    if (detectionAbortController) detectionAbortController.abort();
    detectionAbortController = null;

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

    if (detectionImageUrl) {
        URL.revokeObjectURL(detectionImageUrl);
        detectionImageUrl = null;
    }
    const detectedFrame = document.getElementById('detected-frame');
    if (detectedFrame) detectedFrame.removeAttribute('src');
    const resultPlaceholder = document.getElementById('result-placeholder');
    if (resultPlaceholder) resultPlaceholder.hidden = false;

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

function captureFrame(video) {
    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    captureCanvas.width = Math.round(video.videoWidth * scale);
    captureCanvas.height = Math.round(video.videoHeight * scale);
    captureContext.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    return new Promise(resolve => captureCanvas.toBlob(resolve, 'image/jpeg', 0.7));
}

async function detectFrames(session) {
    if (session !== detectionSession || !mediaStream) return;

    const preview = document.getElementById('camera-preview');
    if (!preview || preview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        detectionTimer = window.setTimeout(() => detectFrames(session), FRAME_INTERVAL_MS);
        return;
    }

    let requestController = null;
    let retryDelay = FRAME_INTERVAL_MS;
    try {
        const frame = await captureFrame(preview);
        if (!frame) throw new Error('Could not capture a camera frame.');

        const formData = new FormData();
        formData.append('image', frame, 'frame.jpg');
        requestController = new AbortController();
        detectionAbortController = requestController;
        const response = await fetch('/api/detect', {
            method: 'POST',
            body: formData,
            signal: requestController.signal
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || `Detection request failed (${response.status}).`);
        }

        const resultBlob = await response.blob();
        if (session !== detectionSession) return;

        if (detectionImageUrl) URL.revokeObjectURL(detectionImageUrl);
        detectionImageUrl = URL.createObjectURL(resultBlob);
        const detectedFrame = document.getElementById('detected-frame');
        const resultPlaceholder = document.getElementById('result-placeholder');
        if (detectedFrame) detectedFrame.src = detectionImageUrl;
        if (resultPlaceholder) resultPlaceholder.hidden = true;
        setDetectorStatus('Camera active. Detection is running.', true);
    } catch (error) {
        if (error.name === 'AbortError' || session !== detectionSession) return;
        setDetectorStatus(`Detection service error: ${error.message} Retrying...`, true);
        retryDelay = 500;
    } finally {
        if (detectionAbortController === requestController) detectionAbortController = null;
    }

    if (session === detectionSession && mediaStream) {
        detectionTimer = window.setTimeout(() => detectFrames(session), retryDelay);
    }
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
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'user' },
                width: { ideal: MAX_FRAME_WIDTH },
                frameRate: { ideal: 24, max: 30 }
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
        const cameraPlaceholder = document.getElementById('camera-placeholder');
        if (cameraPlaceholder) cameraPlaceholder.hidden = true;
        if (stopButton) stopButton.disabled = false;
        setDetectorStatus('Camera active. Waiting for the first detection...', true);
        detectFrames(session);
    } catch (error) {
        if (session !== detectionSession) return;
        stopCamera(false);
        if (startButton) startButton.disabled = false;
        if (stopButton) stopButton.disabled = true;
        setDetectorStatus(cameraErrorMessage(error));
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
