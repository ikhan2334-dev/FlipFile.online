// Update your existing drag and drop handler
class EnhancedDropZone {
    constructor() {
        this.processor = new SmartFileProcessor();
        this.memoryMonitor = new MemoryMonitor();
        this.init();
    }

    init() {
        const dropZone = document.getElementById('dropZone');
        
        if (!dropZone) return;

        // Enhanced event listeners
        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        dropZone.addEventListener('drop', this.handleDrop.bind(this));
        
        // File input change
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
        
        // Monitor memory
        this.memoryMonitor.startMonitoring();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Check memory before allowing drop
        if (this.memoryMonitor.isMemoryCritical()) {
            this.showMemoryWarning();
            return;
        }
        
        dropZone.classList.add('active');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('active');
    }

    async handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('active');
        
        // Check memory
        if (this.memoryMonitor.isMemoryCritical()) {
            this.showMemoryWarning('Cannot process files - browser memory is too low');
            return;
        }
        
        const files = e.dataTransfer.files;
        await this.processFiles(files);
    }

    async handleFileSelect(e) {
        const files = e.target.files;
        await this.processFiles(files);
    }

    async processFiles(files) {
        if (files.length === 0) return;
        
        // Process first file (for now - could extend to multiple)
        const file = files[0];
        
        try {
            const result = await this.processor.processFile(file);
            this.handleSuccess(result, file);
        } catch (error) {
            this.handleError(error, file);
        }
    }

    handleSuccess(result, file) {
        // Remove processing modal
        const modal = document.querySelector('.processing-modal');
        if (modal) modal.remove();
        
        // Show success message
        this.showSuccess(`Successfully processed ${file.name}`);
        
        // Trigger download or next steps
        this.downloadResult(result, file);
    }

    handleError(error, file) {
        console.error('Processing error:', error);
        
        // Remove processing modal
        const modal = document.querySelector('.processing-modal');
        if (modal) modal.remove();
        
        // Show error
        this.showError(`Failed to process ${file.name}: ${error.message}`);
    }

    showMemoryWarning(message = 'Low memory detected. Processing large files may fail.') {
        // Create or update memory warning
        let warning = document.querySelector('.memory-warning');
        
        if (!warning) {
            warning = document.createElement('div');
            warning.className = 'memory-warning';
            warning.innerHTML = `
                <p><i class="fas fa-memory"></i> ${message}</p>
                <button class="close-warning"><i class="fas fa-times"></i></button>
            `;
            document.body.appendChild(warning);
            
            warning.querySelector('.close-warning').addEventListener('click', () => {
                warning.classList.add('hidden');
            });
        } else {
            warning.querySelector('p').textContent = message;
            warning.classList.remove('hidden');
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            warning.classList.add('hidden');
        }, 5000);
    }

    showSuccess(message) {
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.innerHTML = `
            <p><i class="fas fa-check-circle"></i> ${message}</p>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <p><i class="fas fa-exclamation-circle"></i> ${message}</p>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    downloadResult(result, originalFile) {
        // Create download link
        const blob = new Blob([result], { type: originalFile.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `processed_${originalFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Memory monitoring
class MemoryMonitor {
    constructor() {
        this.memoryLimit = 500 * 1024 * 1024; // 500MB
        this.criticalThreshold = 0.9; // 90% of limit
        this.interval = null;
    }

    startMonitoring() {
        // Check memory every 5 seconds
        this.interval = setInterval(() => {
            this.checkMemory();
        }, 5000);
    }

    checkMemory() {
        if (performance.memory) {
            const usedJSHeapSize = performance.memory.usedJSHeapSize;
            
            if (usedJSHeapSize > this.memoryLimit * this.criticalThreshold) {
                this.triggerMemoryWarning(usedJSHeapSize);
            }
        }
    }

    isMemoryCritical() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize > this.memoryLimit * this.criticalThreshold;
        }
        return false;
    }

    triggerMemoryWarning(usedMemory) {
        const percentage = (usedMemory / this.memoryLimit) * 100;
        console.warn(`Memory usage critical: ${Math.round(percentage)}%`);
        
        // Dispatch event for other components to handle
        const event = new CustomEvent('memorywarning', {
            detail: { percentage, usedMemory }
        });
        window.dispatchEvent(event);
    }

    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
