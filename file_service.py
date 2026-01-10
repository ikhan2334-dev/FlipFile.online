"""
File service with enhanced security features
"""

import os
import uuid
import hashlib
import tempfile
from typing import Optional, BinaryIO, Dict, Any
from datetime import datetime, timedelta
from fastapi import UploadFile, HTTPException, status
import magic
from cryptography.fernet import Fernet
from src.core.config import settings
from src.utils.file_utils import FileUtils
from src.utils.security_utils import SecurityUtils
import aiofiles
import asyncio

class FileService:
    """Secure file handling service"""
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        self.encryption_key = settings.ENCRYPTION_KEY.encode()
        self.cipher = Fernet(self.encryption_key)
        
        # Allowed file types with MIME validation
        self.allowed_types = {
            'pdf': ['application/pdf'],
            'images': ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'],
            'office': [
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ]
        }
    
    async def validate_and_save(self, file: UploadFile, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Validate and securely save uploaded file"""
        
        # 1. Validate file size
        await self._validate_file_size(file)
        
        # 2. Validate file type
        await self._validate_file_type(file)
        
        # 3. Scan for malware
        await self._scan_for_malware(file)
        
        # 4. Validate file content
        await self._validate_file_content(file)
        
        # 5. Generate secure filename
        secure_filename = self._generate_secure_filename(file.filename)
        
        # 6. Create unique file ID
        file_id = str(uuid.uuid4())
        
        # 7. Calculate file hash (for deduplication and verification)
        file_hash = await self._calculate_file_hash(file)
        
        # 8. Encrypt file content
        encrypted_path = await self._encrypt_and_save(file, file_id)
        
        # 9. Store metadata
        metadata = {
            'id': file_id,
            'original_name': file.filename,
            'secure_name': secure_filename,
            'mime_type': file.content_type,
            'size': file.size,
            'hash': file_hash,
            'uploaded_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(minutes=settings.FILE_RETENTION_MINUTES),
            'user_id': user_id,
            'encrypted_path': encrypted_path,
            'is_encrypted': True,
            'is_compressed': False,
            'virus_scan_status': 'clean'
        }
        
        # 10. Store metadata in database (simplified)
        await self._store_metadata(metadata)
        
        return metadata
    
    async def _validate_file_size(self, file: UploadFile):
        """Validate file size"""
        # Seek to end to get actual size
        await file.seek(0, 2)
        file_size = await file.tell()
        await file.seek(0)
        
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE / 1024 / 1024}MB"
            )
    
    async def _validate_file_type(self, file: UploadFile):
        """Validate file type using MIME and extension"""
        # Get actual MIME type using magic
        content = await file.read(2048)  # Read first 2KB
        await file.seek(0)
        
        mime = magic.from_buffer(content, mime=True)
        
        # Check if MIME type is allowed
        all_allowed = sum(self.allowed_types.values(), [])
        if mime not in all_allowed:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type {mime} is not supported"
            )
        
        # Validate extension matches MIME type
        extension = file.filename.split('.')[-1].lower()
        if not self._is_valid_extension(extension, mime):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File extension does not match content type"
            )
    
    async def _scan_for_malware(self, file: UploadFile):
        """Scan file for malware using ClamAV or VirusTotal"""
        # For now, implement basic checks
        content = await file.read()
        await file.seek(0)
        
        # Basic malware pattern detection
        suspicious_patterns = [
            b'eval(',
            b'base64_decode(',
            b'shell_exec(',
            b'passthru(',
            b'system(',
            b'exec(',
            b'<script>',
            b'javascript:'
        ]
        
        for pattern in suspicious_patterns:
            if pattern in content:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="File contains suspicious content"
                )
        
        # In production, integrate with:
        # 1. ClamAV (local)
        # 2. VirusTotal API
        # 3. Custom ML models
    
    async def _validate_file_content(self, file: UploadFile):
        """Validate file content structure"""
        # PDF validation
        if file.content_type == 'application/pdf':
            await self._validate_pdf(file)
        
        # Image validation
        elif file.content_type.startswith('image/'):
            await self._validate_image(file)
        
        # Office document validation
        elif 'office' in file.content_type or 'document' in file.content_type:
            await self._validate_office_document(file)
    
    async def _validate_pdf(self, file: UploadFile):
        """Validate PDF structure"""
        content = await file.read(1024)
        await file.seek(0)
        
        # Check PDF header
        if not content.startswith(b'%PDF'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file"
            )
        
        # Check for embedded JavaScript (security risk)
        if b'/JavaScript' in content or b'/JS' in content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="PDF contains JavaScript which is not allowed for security reasons"
            )
    
    async def _validate_image(self, file: UploadFile):
        """Validate image file"""
        # Check for valid image headers
        content = await file.read(12)
        await file.seek(0)
        
        # JPEG
        if content.startswith(b'\xff\xd8'):
            return True
        
        # PNG
        elif content.startswith(b'\x89PNG\r\n\x1a\n'):
            return True
        
        # GIF
        elif content.startswith(b'GIF87a') or content.startswith(b'GIF89a'):
            return True
        
        # SVG (text-based)
        elif b'<svg' in content[:100]:
            return True
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file"
        )
    
    def _generate_secure_filename(self, original_name: str) -> str:
        """Generate secure filename to prevent path traversal"""
        # Remove path components
        basename = os.path.basename(original_name)
        
        # Remove special characters
        safe_name = SecurityUtils.sanitize_filename(basename)
        
        # Add timestamp and random string
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        random_str = uuid.uuid4().hex[:8]
        
        return f"{timestamp}_{random_str}_{safe_name}"
    
    async def _calculate_file_hash(self, file: UploadFile) -> str:
        """Calculate SHA-256 hash of file"""
        sha256 = hashlib.sha256()
        
        # Read file in chunks
        chunk_size = 8192
        while chunk := await file.read(chunk_size):
            sha256.update(chunk)
        
        await file.seek(0)
        return sha256.hexdigest()
    
    async def _encrypt_and_save(self, file: UploadFile, file_id: str) -> str:
        """Encrypt and save file securely"""
        # Create secure directory
        secure_dir = os.path.join(self.temp_dir, 'encrypted', file_id[:2], file_id[2:4])
        os.makedirs(secure_dir, exist_ok=True)
        
        # Generate file path
        file_path = os.path.join(secure_dir, f"{file_id}.enc")
        
        # Read and encrypt file in chunks
        chunk_size = 64 * 1024  # 64KB chunks
        
        async with aiofiles.open(file_path, 'wb') as f:
            while chunk := await file.read(chunk_size):
                encrypted_chunk = self.cipher.encrypt(chunk)
                await f.write(encrypted_chunk)
        
        await file.seek(0)
        return file_path
    
    async def decrypt_and_read(self, file_id: str) -> bytes:
        """Decrypt and read file"""
        # Get metadata
        metadata = await self._get_metadata(file_id)
        
        if not metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Check if file has expired
        if datetime.utcnow() > metadata['expires_at']:
            await self.delete_file(file_id)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="File has expired and been deleted"
            )
        
        # Decrypt file
        encrypted_path = metadata['encrypted_path']
        
        async with aiofiles.open(encrypted_path, 'rb') as f:
            encrypted_data = await f.read()
        
        try:
            decrypted_data = self.cipher.decrypt(encrypted_data)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt file"
            )
        
        return decrypted_data
    
    async def delete_file(self, file_id: str) -> bool:
        """Permanently delete file with secure wipe"""
        # Get metadata
        metadata = await self._get_metadata(file_id)
        
        if not metadata:
            return False
        
        # Securely wipe file
        encrypted_path = metadata['encrypted_path']
        
        if os.path.exists(encrypted_path):
            # Overwrite with random data before deletion
            await self._secure_wipe(encrypted_path)
            
            # Delete file
            os.remove(encrypted_path)
            
            # Remove directory if empty
            try:
                os.removedirs(os.path.dirname(encrypted_path))
            except OSError:
                pass
        
        # Delete metadata
        await self._delete_metadata(file_id)
        
        return True
    
    async def _secure_wipe(self, file_path: str):
        """Securely wipe file by overwriting with random data"""
        file_size = os.path.getsize(file_path)
        
        # Overwrite 3 times (DoD 5220.22-M standard)
        for _ in range(3):
            random_data = os.urandom(file_size)
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(random_data)
    
    def _is_valid_extension(self, extension: str, mime_type: str) -> bool:
        """Check if extension matches MIME type"""
        extension_map = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        }
        
        return extension_map.get(extension) == mime_type
    
    async def _store_metadata(self, metadata: Dict[str, Any]):
        """Store file metadata (simplified - implement with database)"""
        # In production, store in PostgreSQL/Redis
        pass
    
    async def _get_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata (simplified - implement with database)"""
        # In production, retrieve from database
        pass
    
    async def _delete_metadata(self, file_id: str):
        """Delete file metadata (simplified - implement with database)"""
        # In production, delete from database
        pass
