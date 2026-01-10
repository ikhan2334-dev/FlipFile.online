// security-headers.js
class SecurityHeaders {
    static applyHeaders() {
        // Content Security Policy
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://translate.google.com https://www.google-analytics.com",
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
            "img-src 'self' data: https: http:",
            "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com",
            "connect-src 'self' https://api.flipfile.online https://www.google-analytics.com",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "block-all-mixed-content",
            "upgrade-insecure-requests"
        ].join('; ');

        // Set meta tag for CSP
        const meta = document.createElement('meta');
        meta.httpEquiv = "Content-Security-Policy";
        meta.content = csp;
        document.head.appendChild(meta);

        // Additional security measures
        this.applySecurityFeatures();
    }

    static applySecurityFeatures() {
        // Disable right-click on sensitive areas
        const sensitiveAreas = document.querySelectorAll('.drop-zone, .file-info');
        sensitiveAreas.forEach(area => {
            area.addEventListener('contextmenu', e => e.preventDefault());
        });

        // Prevent image dragging
        document.addEventListener('dragstart', e => {
            if (e.target.tagName === 'IMG') e.preventDefault();
        });

        // Sanitize user inputs
        this.initInputSanitization();
    }

    static sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    static initInputSanitization() {
        // Sanitize all user inputs
        document.addEventListener('input', e => {
            if (e.target.matches('input[type="text"], input[type="search"], textarea')) {
                e.target.value = this.sanitizeInput(e.target.value);
            }
        });
    }
}

// XSS Protection
class XSSProtection {
    static validateFile(file) {
        const dangerousExtensions = [
            '.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.html',
            '.htm', '.vbs', '.ps1', '.jar', '.py'
        ];
        
        const fileName = file.name.toLowerCase();
        return !dangerousExtensions.some(ext => fileName.endsWith(ext));
    }

    static scanContent(content, type) {
        // Basic XSS pattern detection
        const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /eval\(/gi,
            /document\./gi,
            /window\./gi,
            /alert\(/gi
        ];

        if (type === 'text') {
            return !xssPatterns.some(pattern => pattern.test(content));
        }
        
        return true;
    }
}
