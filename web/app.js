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
                        <img src="assets/hero.png" alt="Mask Detection AI" class="hero-img">
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
                <p>Ensuring real-time safety through intelligent visual monitoring. The stream below is processed via our Flask backend.</p>
            </div>
            
            <div class="detector-container">
                <div class="video-frame">
                    <img id="video-stream" src="http://localhost:5000/video_feed" 
                         alt="Camera Feed" 
                         style="width: 100%; height: 100%; object-fit: cover; display: none;"
                         onload="this.style.display='block'; document.getElementById('placeholder').style.display='none'; document.getElementById('system-status').classList.add('active'); document.getElementById('status-text').textContent='System Active';"
                         onerror="this.style.display='none'; document.getElementById('placeholder').style.display='flex'; document.getElementById('system-status').classList.remove('active'); document.getElementById('status-text').textContent='System Offline';">
                    
                    <div id="placeholder" class="video-placeholder">
                        <i class="fa-solid fa-video-slash"></i>
                        <p>Camera feed offline.</p>
                        <p style="font-size: 0.9rem; opacity: 0.7; margin-top: 10px;">Please ensure 'python src/web_server.py' is running.</p>
                    </div>
                </div>
                
                <div class="controls">
                    <div class="status-indicator">
                        <div class="dot" id="system-status"></div>
                        <span id="status-text">Checking System...</span>
                    </div>
                    
                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-primary" onclick="window.location.reload()">
                            <i class="fa-solid fa-arrows-rotate"></i> Refresh Stream
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

function navigateTo(pageId) {
    // Default to home if invalid
    if (!pages[pageId]) {
        pageId = 'home';
    }

    // Update Content
    contentDiv.innerHTML = pages[pageId];

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
