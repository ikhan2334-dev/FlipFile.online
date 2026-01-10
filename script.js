// ========== FLIPFILE CORE FUNCTIONALITY ==========
// Main Application Object
const FlipFile = {
    // Configuration
    config: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedFileTypes: [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/svg+xml',
            'image/tiff',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        deleteAfterMinutes: 5,
        sessionDuration: 30, // minutes
        maxFilesPerSession: 7,
        donationThreshold: 7
    },
    
    // State Management
    state: {
        currentFiles: [],
        processedCount: 0,
        currentTool: null,
        isProcessing: false,
        userConsent: {
            analytics: false,
            cookies: false
        }
    },
    
    // Initialize the application
    init: function() {
        this.initDragAndDrop();
        this.initEventListeners();
        this.initFileProcessing();
        this.initLanguageSelector();
        this.initSession();
        this.initPerformanceMonitoring();
        this.initServiceWorker();
        
        console.log('FlipFile initialized successfully');
    },
    
    // ========== DRAG AND DROP FUNCTIONALITY ==========
    initDragAndDrop: function() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');
        
        if (!dropZone || !fileInput || !selectFileBtn) return;
        
        // Highlight drop zone when dragging over
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.highlightDropZone, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.unhighlightDropZone, false);
        });
        
        // Handle dropped files
        dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
        
        // Handle file selection via button
        selectFileBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    },
    
    highlightDropZone: function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('active');
    },
    
    unhighlightDropZone: function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('active');
    },
    
    handleDrop: function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.unhighlightDropZone.call(e.currentTarget, e);
        
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFiles(files);
    },
    
    // ========== FILE HANDLING ==========
    handleFiles: function(files) {
        if (files.length === 0) return;
        
        // Clear previous files
        this.state.currentFiles = [];
        
        // Process each file
        Array.from(files).forEach(file => {
            this.validateAndAddFile(file);
        });
        
        // Show file info if we have valid files
        if (this.state.currentFiles.length > 0) {
            this.showFileInfo();
        }
    },
    
    validateAndAddFile: function(file) {
        // Check file size
        if (file.size > this.config.maxFileSize) {
            this.showError(`File "${file.name}" exceeds maximum size of 100MB`);
            return;
        }
        
        // Check file type
        if (!this.config.allowedFileTypes.includes(file.type)) {
            this.showError(`File type "${file.type}" is not supported`);
            return;
        }
        
        // Add to current files
        this.state.currentFiles.push({
            file: file,
            id: this.generateFileId(),
            name: file.name,
            size: file.size,
            type: file.type,
            uploadTime: new Date(),
            status: 'pending'
        });
        
        console.log(`File added: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    },
    
    generateFileId: function() {
        return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    showFileInfo: function() {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileList = document.getElementById('fileList');
        
        if (!fileInfo || !fileName || !fileList) return;
        
        // Update file name
        if (this.state.currentFiles.length === 1) {
            fileName.textContent = this.state.currentFiles[0].name;
        } else {
            fileName.textContent = `${this.state.currentFiles.length} files selected`;
        }
        
        // Update file list
        fileList.innerHTML = '';
        this.state.currentFiles.forEach(fileData => {
            const li = document.createElement('li');
            li.innerHTML = `
                <i class="fas fa-file" style="color: ${this.getFileTypeColor(fileData.type)}"></i>
                <span>${fileData.name}</span>
                <small>(${(fileData.size / 1024 / 1024).toFixed(2)} MB)</small>
            `;
            fileList.appendChild(li);
        });
        
        // Show file info section
        fileInfo.style.display = 'block';
        
        // Scroll to file info
        fileInfo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    
    getFileTypeColor: function(fileType) {
        const colorMap = {
            'application/pdf': '#FF3131', // Red
            'image/jpeg': '#27D3F5', // Blue
            'image/jpg': '#27D3F5',
            'image/png': '#6CF527', // Green
            'image/svg+xml': '#F08000', // Orange
            'application/msword': '#2B579A', // Word blue
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '#2B579A',
            'application/vnd.ms-excel': '#217346', // Excel green
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '#217346',
            'application/vnd.ms-powerpoint': '#D24726' // PowerPoint orange
        };
        
        return colorMap[fileType] || '#666';
    },
    
    // ========== FILE PROCESSING ==========
    initFileProcessing: function() {
        const processBtn = document.getElementById('processBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (processBtn) {
            processBtn.addEventListener('click', this.processFiles.bind(this));
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.cancelProcessing.bind(this));
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', this.downloadProcessedFile.bind(this));
        }
    },
    
    processFiles: async function() {
        if (this.state.isProcessing) return;
        
        if (this.state.currentFiles.length === 0) {
            this.showError('Please select files to process');
            return;
        }
        
        this.state.isProcessing = true;
        this.state.processedCount++;
        
        // Update UI
        this.updateProcessButton(true);
        this.showProgressBar();
        
        // Check if we should show donation prompt
        if (this.state.processedCount >= this.config.donationThreshold) {
            this.showDonationPrompt();
        }
        
        // Show ad during processing (simulated)
        this.showAdvertisement();
        
        try {
            // Process each file
            for (let i = 0; i < this.state.currentFiles.length; i++) {
                const fileData = this.state.currentFiles[i];
                await this.processSingleFile(fileData, i);
            }
            
            // Complete processing
            this.completeProcessing();
            
        } catch (error) {
            console.error('Processing error:', error);
            this.showError('An error occurred during processing. Please try again.');
            this.cancelProcessing();
        }
    },
    
    processSingleFile: async function(fileData, index) {
        return new Promise((resolve) => {
            const totalTime = 3000; // 3 seconds per file
            const interval = 100; // Update every 100ms
            const steps = totalTime / interval;
            let currentStep = 0;
            
            // Update progress bar
            const updateProgress = () => {
                if (!this.state.isProcessing) {
                    clearInterval(progressInterval);
                    return;
                }
                
                currentStep++;
                const overallProgress = ((index * totalTime + currentStep * interval) / 
                    (this.state.currentFiles.length * totalTime)) * 100;
                
                this.updateProgressBar(overallProgress, [
                    'Analyzing file structure...',
                    'Optimizing file size...',
                    'Applying security measures...',
                    'Finalizing processing...'
                ][Math.floor(currentStep / (steps / 4)) % 4]);
                
                if (currentStep >= steps) {
                    clearInterval(progressInterval);
                    fileData.status = 'processed';
                    resolve();
                }
            };
            
            const progressInterval = setInterval(updateProgress, interval);
        });
    },
    
    updateProgressBar: function(percentage, text) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const processBtn = document.getElementById('processBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = text || `Processing... ${percentage.toFixed(0)}%`;
        }
        
        if (processBtn && percentage >= 100) {
            processBtn.style.display = 'none';
        }
        
        if (downloadBtn && percentage >= 100) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Processed File';
        }
    },
    
    showProgressBar: function() {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = 'Starting processing...';
        }
        this.updateProgressBar(0);
    },
    
    completeProcessing: function() {
        this.state.isProcessing = false;
        
        // Show success message
        this.showSuccess('Files processed successfully! Ready for download.');
        
        // Log processing completion
        console.log(`Processing complete. Total files processed: ${this.state.processedCount}`);
        
        // Schedule file deletion
        setTimeout(() => {
            this.deleteProcessedFiles();
        }, this.config.deleteAfterMinutes * 60 * 1000);
    },
    
    cancelProcessing: function() {
        this.state.isProcessing = false;
        this.updateProcessButton(false);
        
        // Reset progress bar
        this.updateProgressBar(0, 'Processing cancelled');
        
        // Hide file info after delay
        setTimeout(() => {
            const fileInfo = document.getElementById('fileInfo');
            if (fileInfo) {
                fileInfo.style.display = 'none';
            }
        }, 2000);
        
        // Clear current files
        this.state.currentFiles = [];
    },
    
    updateProcessButton: function(isProcessing) {
        const processBtn = document.getElementById('processBtn');
        if (!processBtn) return;
        
        if (isProcessing) {
            processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            processBtn.disabled = true;
        } else {
            processBtn.innerHTML = '<i class="fas fa-play"></i> Process Files';
            processBtn.disabled = false;
        }
    },
    
    // ========== TOOL SPECIFIC FUNCTIONS ==========
    processAsConverter: async function(fileData) {
        // Simulate PDF conversion
        console.log(`Converting ${fileData.type} to PDF...`);
        
        // In a real implementation, you would use:
        // - pdf-lib for PDF manipulation
        // - pdf.js for PDF rendering
        // - jspdf for PDF generation
        
        return new Promise(resolve => setTimeout(resolve, 1000));
    },
    
    processAsCompressor: async function(fileData) {
        // Simulate PDF compression
        console.log(`Compressing ${fileData.name}...`);
        
        // In a real implementation, you would:
        // 1. Extract images from PDF
        // 2. Compress images
        // 3. Rebuild PDF with compressed images
        
        return new Promise(resolve => setTimeout(resolve, 1500));
    },
    
    processAsUnlocker: async function(fileData) {
        // Simulate PDF unlocking
        console.log(`Processing ${fileData.name} for unlock/lock...`);
        
        // Note: Actual PDF unlocking requires password
        // This is just a simulation
        
        return new Promise(resolve => setTimeout(resolve, 800));
    },
    
    processAsColorExtractor: async function(fileData) {
        // Simulate color extraction
        console.log(`Extracting colors from ${fileData.name}...`);
        
        // In a real implementation, you would:
        // 1. Load image
        // 2. Use canvas to analyze pixels
        // 3. Extract dominant colors
        
        return new Promise(resolve => setTimeout(resolve, 1200));
    },
    
    // ========== DOWNLOAD FUNCTIONALITY ==========
    downloadProcessedFile: function() {
        if (this.state.currentFiles.length === 0) {
            this.showError('No files to download');
            return;
        }
        
        // Create a simulated download
        const fileName = this.state.currentFiles.length === 1 
            ? `processed_${this.state.currentFiles[0].name}`
            : 'processed_files.zip';
        
        // Create a blob with sample data (in real app, this would be actual processed files)
        const content = `FlipFile - Processed Files\n\n`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show download confirmation
        this.showSuccess('Download started!');
        
        // Log download
        console.log(`File downloaded: ${fileName}`);
        
        // Reset for next file
        setTimeout(() => {
            this.cancelProcessing();
        }, 2000);
    },
    
    deleteProcessedFiles: function() {
        console.log('Automatically deleting processed files for security...');
        this.state.currentFiles = [];
        
        // Update UI
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) {
            fileInfo.style.display = 'none';
        }
    },
    
    // ========== MONETIZATION & ADS ==========
    showAdvertisement: function() {
        // In a real implementation, this would show Google AdSense ads
        const adPlaceholder = document.querySelector('.ad-placeholder');
        if (adPlaceholder) {
            adPlaceholder.innerHTML = `
                <div style="animation: fadeIn 1s;">
                    <p style="color: var(--primary-blue); font-weight: bold;">Advertisement</p>
                    <p style="font-size: 14px; color: #666; margin: 10px 0;">
                        Thanks for using our free service! Ads help keep FlipFile running.
                    </p>
                    <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-top: 10px;">
                        <small>Ad would display here (Google AdSense)</small>
                    </div>
                </div>
            `;
            
            // Simulate ad removal after 5 seconds
            setTimeout(() => {
                adPlaceholder.innerHTML = `
                    <p>Google AdSense Advertisement</p>
                    <p style="font-size: 14px; color: #666; margin-top: 10px;">
                        (Ad will display here during file processing)
                    </p>
                `;
            }, 5000);
        }
    },
    
    showDonationPrompt: function() {
        if (this.state.processedCount === this.config.donationThreshold) {
            const donationBox = document.querySelector('.donation-box');
            if (donationBox) {
                donationBox.style.animation = 'pulseGlow 2s infinite';
                
                // Create notification
                this.showNotification(
                    'Consider supporting Cancer Research',
                    'You\'ve processed 7 documents. Optional donation helps fund cancer research.',
                    'info'
                );
            }
        }
    },
    
    // ========== LANGUAGE & TRANSLATION ==========
    initLanguageSelector: function() {
        // Google Translate is initialized in HTML
        // Additional language handling can be added here
        
        const languageBtn = document.querySelector('.language-btn');
        if (languageBtn) {
            languageBtn.addEventListener('click', () => {
                const translateSelect = document.querySelector('.goog-te-combo');
                if (translateSelect) {
                    translateSelect.click();
                }
            });
        }
    },
    
    // ========== SESSION MANAGEMENT ==========
    initSession: function() {
        // Load session data from localStorage
        const savedSession = localStorage.getItem('flipfile_session');
        if (savedSession) {
            try {
                const sessionData = JSON.parse(savedSession);
                this.state.processedCount = sessionData.processedCount || 0;
                
                // Check if session is expired (30 minutes)
                const sessionAge = Date.now() - (sessionData.timestamp || 0);
                if (sessionAge > this.config.sessionDuration * 60 * 1000) {
                    this.resetSession();
                }
            } catch (e) {
                console.error('Error loading session:', e);
                this.resetSession();
            }
        }
        
        // Save session periodically
        setInterval(() => this.saveSession(), 60000); // Every minute
    },
    
    saveSession: function() {
        const sessionData = {
            processedCount: this.state.processedCount,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('flipfile_session', JSON.stringify(sessionData));
        } catch (e) {
            console.error('Error saving session:', e);
        }
    },
    
    resetSession: function() {
        this.state.processedCount = 0;
        localStorage.removeItem('flipfile_session');
    },
    
    // ========== PERFORMANCE OPTIMIZATION ==========
    initPerformanceMonitoring: function() {
        // Monitor FPS
        let frameCount = 0;
        let lastTime = performance.now();
        
        const checkFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime >= lastTime + 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                
                if (fps < 50) {
                    console.warn(`Low FPS detected: ${fps}. Optimizing...`);
                    // Implement performance optimizations
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(checkFPS);
        };
        
        requestAnimationFrame(checkFPS);
        
        // Lazy load images
        this.initLazyLoading();
        
        // Preload critical resources
        this.preloadResources();
    },
    
    initLazyLoading: function() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    },
    
    preloadResources: function() {
        // Preload critical CSS/JS
        const resources = [
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
            'https://fonts.googleapis.com/css2?family=Saira+Stencil+One&family=Alata&family=Averia+Serif+Libre&family=Aldrich&display=swap'
        ];
        
        resources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = resource.includes('.css') ? 'preload' : 'preconnect';
            link.href = resource;
            link.as = 'style';
            document.head.appendChild(link);
        });
    },
    
    // ========== SERVICE WORKER FOR OFFLINE SUPPORT ==========
    initServiceWorker: function() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker registered:', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }
    },
    
    // ========== UTILITY FUNCTIONS ==========
    showError: function(message) {
        this.showNotification(message, 'Please try again.', 'error');
    },
    
    showSuccess: function(message) {
        this.showNotification('Success!', message, 'success');
    },
    
    showNotification: function(title, message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                                 type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            </div>
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 15px;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            border-left: 5px solid ${type === 'error' ? '#FF3131' : 
                                 type === 'success' ? '#6CF527' : '#27D3F5'};
        `;
        
        document.body.appendChild(notification);
        
        // Add close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    },
    
    // ========== SECURITY FUNCTIONS ==========
    encryptFile: async function(file, password) {
        // Simulated encryption - in real implementation, use Web Crypto API
        console.log(`Encrypting file with password...`);
        return new Promise(resolve => setTimeout(() => resolve(file), 500));
    },
    
    decryptFile: async function(file, password) {
        // Simulated decryption
        console.log(`Decrypting file...`);
        return new Promise(resolve => setTimeout(() => resolve(file), 500));
    },
    
    // ========== ANALYTICS ==========
    trackEvent: function(category, action, label) {
        // In a real implementation, integrate with Google Analytics
        console.log(`Analytics: ${category} - ${action} - ${label}`);
        
        // Simulate analytics tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                'event_category': category,
                'event_label': label
            });
        }
    }
};

// ========== SERVICE WORKER SCRIPT ==========
// Create service-worker.js file content
const serviceWorkerScript = `
// FlipFile Service Worker
const CACHE_NAME = 'flipfile-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Saira+Stencil+One&family=Alata&display=swap'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch new
                return response || fetch(event.request);
            })
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
`;

// ========== PDF PROCESSING LIBRARY INTEGRATION ==========
// Note: In a real implementation, you would include these libraries via CDN
// and use them for actual PDF processing

class PDFProcessor {
    constructor() {
        this.pdfjsLib = null;
        this.pdfLib = null;
        this.jsPDF = null;
    }
    
    async init() {
        // Load PDF.js dynamically
        if (typeof pdfjsLib !== 'undefined') {
            this.pdfjsLib = pdfjsLib;
        }
        
        // Load pdf-lib dynamically
        if (typeof PDFLib !== 'undefined') {
            this.pdfLib = PDFLib;
        }
        
        // Load jsPDF dynamically
        if (typeof jspdf !== 'undefined') {
            this.jsPDF = jspdf.jsPDF;
        }
        
        return this;
    }
    
    async compressPDF(file, options = {}) {
        // Simulated compression
        console.log('Compressing PDF with options:', options);
        return new Promise(resolve => setTimeout(() => resolve(file), 1000));
    }
    
    async convertToPDF(file, targetType) {
        // Simulated conversion
        console.log(`Converting ${file.type} to ${targetType}`);
        return new Promise(resolve => setTimeout(() => resolve(file), 1000));
    }
    
    async extractColors(imageFile) {
        // Simulated color extraction
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    dominant: ['#FF3131', '#27D3F5', '#6CF527'],
                    palette: ['#FF3131', '#27D3F5', '#6CF527', '#F08000', '#FFD700']
                });
            }, 800);
        });
    }
}

// ========== INITIALIZE APPLICATION ==========
document.addEventListener('DOMContentLoaded', () => {
    // Initialize FlipFile
    FlipFile.init();
    
    // Initialize PDF Processor
    const pdfProcessor = new PDFProcessor();
    pdfProcessor.init().then(() => {
        console.log('PDF Processor initialized');
    });
    
    // Add additional animations
    initScrollAnimations();
    
    // Add keyboard shortcuts
    initKeyboardShortcuts();
});

// ========== ADDITIONAL ANIMATIONS ==========
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements
    document.querySelectorAll('.tool-card, .seo-card').forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(element);
    });
}

// ========== KEYBOARD SHORTCUTS ==========
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + O to open file dialog
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            document.getElementById('fileInput').click();
        }
        
        // Ctrl/Cmd + P to process files
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            const processBtn = document.getElementById('processBtn');
            if (processBtn && !processBtn.disabled) {
                processBtn.click();
            }
        }
        
        // Escape to cancel
        if (e.key === 'Escape') {
            const cancelBtn = document.getElementById('cancelBtn');
            if (cancelBtn) {
                cancelBtn.click();
            }
        }
    });
}

// ========== PERFORMANCE UTILITIES ==========
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ========== FILE UTILITIES ==========
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

// ========== EXPORT FOR MODULE USAGE ==========
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlipFile, PDFProcessor };
}

// ========== POLYFILLS FOR OLDER BROWSERS ==========
if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        if (typeof start !== 'number') {
            start = 0;
        }
        if (start + search.length > this.length) {
            return false;
        } else {
            return this.indexOf(search, start) !== -1;
        }
    };
}

// ========== ERROR HANDLING ==========
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    FlipFile.showError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    FlipFile.showError('An error occurred while processing your request.');
});

// ========== OFFLINE DETECTION ==========
window.addEventListener('online', () => {
    FlipFile.showNotification('Back Online', 'Your connection has been restored.', 'success');
});

window.addEventListener('offline', () => {
    FlipFile.showNotification('Offline Mode', 'You are currently offline. Some features may be limited.', 'warning');
});
