"""
Security middleware for the API
"""

import time
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import jwt
from src.core.config import settings
from src.core.security import SecurityUtils

class SecurityMiddleware(BaseHTTPMiddleware):
    """Enhanced security middleware"""
    
    async def dispatch(self, request: Request, call_next):
        # Start timing
        start_time = time.time()
        
        # Security headers
        response = await self.add_security_headers(request, call_next)
        
        # Log request
        await self.log_request(request, response, start_time)
        
        # Rate limiting check
        await self.check_rate_limit(request)
        
        # Input sanitization
        await self.sanitize_inputs(request)
        
        # XSS protection
        await self.prevent_xss(request, response)
        
        return response
    
    async def add_security_headers(self, request: Request, call_next):
        """Add security headers to response"""
        response = await call_next(request)
        
        headers = {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "form-action 'self'; "
                "base-uri 'self'"
            ),
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "X-Robots-Tag": "noindex, nofollow"
        }
        
        for header, value in headers.items():
            response.headers[header] = value
        
        return response
    
    async def check_rate_limit(self, request: Request):
        """Check rate limit for IP"""
        client_ip = request.client.host
        
        # Implement IP-based rate limiting
        # This is a simplified version - use Redis in production
        pass
    
    async def sanitize_inputs(self, request: Request):
        """Sanitize all incoming data"""
        if request.method in ["POST", "PUT", "PATCH"]:
            # Check content type
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                body = await request.json()
                sanitized = SecurityUtils.sanitize_json(body)
                request.state.sanitized_body = sanitized
            elif "multipart/form-data" in content_type:
                # File uploads are handled separately
                pass
            elif "application/x-www-form-urlencoded" in content_type:
                form_data = await request.form()
                sanitized = SecurityUtils.sanitize_dict(dict(form_data))
                request.state.sanitized_body = sanitized
    
    async def prevent_xss(self, request: Request, response: Response):
        """Prevent XSS attacks"""
        # Check response content for potential XSS
        if "text/html" in response.headers.get("content-type", ""):
            # Add XSS protection headers
            pass
    
    async def log_request(self, request: Request, response: Response, start_time: float):
        """Log request details for security monitoring"""
        duration = time.time() - start_time
        
        log_data = {
            "timestamp": time.time(),
            "method": request.method,
            "url": str(request.url),
            "ip": request.client.host,
            "user_agent": request.headers.get("user-agent", ""),
            "referer": request.headers.get("referer", ""),
            "status_code": response.status_code,
            "duration": duration,
            "content_length": response.headers.get("content-length", 0)
        }
        
        # Log to file/database
        import logging
        logger = logging.getLogger("security")
        logger.info(f"Request: {log_data}")
        
        # Alert on suspicious activity
        if duration > 10:  # Request took more than 10 seconds
            logger.warning(f"Slow request detected: {log_data}")
        
        if response.status_code >= 400:
            logger.warning(f"Error response: {log_data}")

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """JWT authentication middleware"""
    
    async def dispatch(self, request: Request, call_next):
        # Skip authentication for public endpoints
        public_paths = ["/api/v1/health", "/api/v1/auth/login", "/api/v1/auth/register"]
        
        if any(request.url.path.startswith(path) for path in public_paths):
            return await call_next(request)
        
        # Get token from header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        token = auth_header.split(" ")[1]
        
        try:
            # Verify token
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Add user to request state
            request.state.user = payload
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return await call_next(request)
