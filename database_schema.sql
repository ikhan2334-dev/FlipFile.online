-- FlipFile Database Schema
-- PostgreSQL with security features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for optional login)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    session_token VARCHAR(512),
    session_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),
    reset_token VARCHAR(100),
    reset_expires_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_users_email ON users(email),
    INDEX idx_users_session_token ON users(session_token),
    INDEX idx_users_created_at ON users(created_at DESC)
);

-- Files table (encrypted metadata)
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(500) NOT NULL,
    secure_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    hash_sha256 VARCHAR(64) NOT NULL,
    encryption_key_encrypted TEXT NOT NULL, -- Encrypted with master key
    iv TEXT NOT NULL, -- Initialization vector for AES
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accessed_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    virus_scan_status VARCHAR(20) DEFAULT 'pending',
    virus_scan_result JSONB,
    is_encrypted BOOLEAN DEFAULT TRUE,
    is_compressed BOOLEAN DEFAULT FALSE,
    compression_ratio FLOAT,
    metadata JSONB DEFAULT '{}',
    
    -- Security constraints
    CONSTRAINT chk_size_positive CHECK (size_bytes > 0),
    CONSTRAINT chk_expires_future CHECK (expires_at > uploaded_at),
    
    -- Indexes
    INDEX idx_files_user_id ON files(user_id),
    INDEX idx_files_hash ON files(hash_sha256),
    INDEX idx_files_expires_at ON files(expires_at),
    INDEX idx_files_uploaded_at ON files(uploaded_at DESC),
    INDEX idx_files_virus_scan_status ON files(virus_scan_status)
);

-- Processing jobs table
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- 'compress', 'convert', 'unlock', 'extract'
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    parameters JSONB DEFAULT '{}',
    result_path TEXT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    worker_node VARCHAR(100),
    
    -- Indexes
    INDEX idx_jobs_file_id ON processing_jobs(file_id),
    INDEX idx_jobs_status ON processing_jobs(status),
    INDEX idx_jobs_created_at ON processing_jobs(started_at DESC)
);

-- Donations table (for cancer research)
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    donation_to VARCHAR(100) DEFAULT 'Cancer Research',
    payment_method VARCHAR(50),
    payment_id VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    receipt_url TEXT,
    donated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_anonymous BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_donations_user_id ON donations(user_id),
    INDEX idx_donations_donated_at ON donations(donated_at DESC),
    INDEX idx_donations_status ON donations(status)
);

-- Security logs table
CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- 'login', 'file_upload', 'file_download', 'error'
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    event_data JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, error, critical
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_security_logs_created_at ON security_logs(created_at DESC),
    INDEX idx_security_logs_ip_address ON security_logs(ip_address),
    INDEX idx_security_logs_event_type ON security_logs(event_type)
);

-- Rate limiting table
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- IP, user_id, or API key
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Unique constraint
    UNIQUE(identifier, endpoint, window_start),
    
    -- Indexes
    INDEX idx_rate_limits_identifier ON rate_limits(identifier),
    INDEX idx_rate_limits_window_end ON rate_limits(window_end)
);

-- API keys table (for future integrations)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '[]',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_api_keys_user_id ON api_keys(user_id),
    INDEX idx_api_keys_key_hash ON api_keys(key_hash)
);

-- Audit trail table
CREATE TABLE audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    
    -- Indexes
    INDEX idx_audit_trail_table_record ON audit_trail(table_name, record_id),
    INDEX idx_audit_trail_changed_at ON audit_trail(changed_at DESC)
);

-- Functions and Triggers

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-delete expired files
CREATE OR REPLACE FUNCTION delete_expired_files()
RETURNS void AS $$
BEGIN
    DELETE FROM files WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Schedule expired file cleanup (run this periodically)
-- SELECT delete_expired_files();

-- Encrypt sensitive data function
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Implement encryption using pgcrypto
    -- RETURN pgp_sym_encrypt(data, current_setting('app.encryption_key'));
    RETURN data; -- Placeholder
END;
$$ language 'plpgsql';

-- Create partitioned table for security logs (for performance)
CREATE TABLE security_logs_partitioned (
    LIKE security_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE security_logs_y2024m01 PARTITION OF security_logs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Views for reporting
CREATE VIEW file_statistics AS
SELECT
    DATE(uploaded_at) as upload_date,
    COUNT(*) as total_files,
    SUM(size_bytes) as total_size_bytes,
    AVG(size_bytes) as avg_file_size,
    COUNT(DISTINCT user_id) as unique_users
FROM files
GROUP BY DATE(uploaded_at);

CREATE VIEW donation_summary AS
SELECT
    DATE(donated_at) as donation_date,
    COUNT(*) as total_donations,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    COUNT(DISTINCT user_id) as unique_donors
FROM donations
WHERE status = 'completed'
GROUP BY DATE(donated_at);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY users_policy ON users
    USING (id = current_user_id());

CREATE POLICY files_policy ON files
    USING (user_id = current_user_id() OR user_id IS NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flipfile_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO flipfile_app;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_files_user_id_created_at ON files(user_id, uploaded_at DESC);
CREATE INDEX CONCURRENTLY idx_processing_jobs_status_created_at ON processing_jobs(status, started_at);
CREATE INDEX CONCURRENTLY idx_security_logs_ip_address_created_at ON security_logs(ip_address, created_at DESC);
