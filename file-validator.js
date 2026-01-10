// file-validator.js
class FileValidator {
    constructor() {
        this.config = {
            maxSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: {
                pdf: ['application/pdf'],
                images: ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/tiff'],
                office: [
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                ]
            },
            scanForMalware: true,
            validateMagicNumbers: true
        };
    }

    async validateFile(file) {
        const errors = [];
        
        // 1. Size validation
        if (file.size > this.config.maxSize) {
            errors.push(`File too large (max ${this.formatBytes(this.config.maxSize)})`);
        }

        // 2. Extension validation
        if (!this.isAllowedExtension(file.name)) {
            errors.push('File type not allowed');
        }

        // 3. MIME type validation
        if (!this.isAllowedMimeType(file.type)) {
            errors.push('File MIME type not allowed');
        }

        // 4. Magic number validation
        if (this.config.validateMagicNumbers) {
            const isValidMagic = await this.validateMagicNumbers(file);
            if (!isValidMagic) {
                errors.push('File signature mismatch');
            }
        }

        // 5. XSS validation
        if (!XSSProtection.validateFile(file)) {
            errors.push('File contains potentially dangerous content');
        }

        // 6. Malware scanning (basic)
        if (this.config.scanForMalware) {
            const isClean = await this.scanForMalware(file);
            if (!isClean) {
                errors.push('File failed security scan');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            file
        };
    }

    isAllowedExtension(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const allowedExtensions = [
            'pdf', 'jpg', 'jpeg', 'png', 'svg', 'tiff',
            'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
        ];
        return allowedExtensions.includes(ext);
    }

    isAllowedMimeType(mimeType) {
        const allAllowedTypes = Object.values(this.config.allowedTypes).flat();
        return allAllowedTypes.includes(mimeType);
    }

    async validateMagicNumbers(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arr = new Uint8Array(e.target.result).subarray(0, 4);
                const header = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                
                const magicNumbers = {
                    '25504446': 'pdf', // %PDF
                    'FFD8FF': 'jpg',
                    '89504E47': 'png',
                    '3C737667': 'svg', // <svg
                    'D0CF11E0': 'doc/xls/ppt', // MS Office
                    '504B0304': 'docx/xlsx/pptx' // ZIP (Office Open XML)
                };

                const isValid = Object.keys(magicNumbers).some(magic => header.startsWith(magic));
                resolve(isValid);
            };
            reader.readAsArrayBuffer(file.slice(0, 8));
        });
    }

    async scanForMalware(file) {
        // This is a basic check. In production, integrate with VirusTotal API
        // or use client-side scanning libraries
        
        // Check for embedded scripts in PDF
        if (file.type === 'application/pdf') {
            return await this.scanPDF(file);
        }
        
        return true; // Pass by default for non-PDF
    }

    async scanPDF(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                // Basic PDF structure check
                const hasPDFHeader = content.includes('%PDF');
                const hasPDFFooter = content.includes('%%EOF');
                
                // Check for JavaScript in PDF
                const hasJS = /\/JavaScript\s*\//i.test(content) || 
                             /\/JS\s*\//i.test(content) ||
                             /\/AA\s*\//i.test(content); // Auto actions
                
                resolve(hasPDFHeader && hasPDFFooter && !hasJS);
            };
            reader.readAsText(file.slice(0, 1024 * 100)); // First 100KB
        });
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }
}
