-- Migration: 001_initial_schema
-- Creates the initial database schema for Safelynx

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE profile_classification AS ENUM ('trusted', 'known', 'unknown', 'flagged');
CREATE TYPE camera_type AS ENUM ('builtin', 'usb', 'rtsp');
CREATE TYPE camera_status AS ENUM ('active', 'inactive', 'error', 'disconnected');
CREATE TYPE recording_status AS ENUM ('recording', 'completed', 'interrupted', 'deleting');

-- Profiles table
-- Stores identified individuals with their face embeddings
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    classification profile_classification NOT NULL DEFAULT 'unknown',
    embedding BYTEA NOT NULL,
    thumbnail_path VARCHAR(512),
    tags JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sighting_count BIGINT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_classification ON profiles(classification) WHERE is_active = TRUE;
CREATE INDEX idx_profiles_last_seen ON profiles(last_seen_at DESC) WHERE is_active = TRUE;
CREATE INDEX idx_profiles_sighting_count ON profiles(sighting_count DESC) WHERE is_active = TRUE;

-- Cameras table
-- Stores camera configurations
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    camera_type camera_type NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    rtsp_url VARCHAR(512),
    location_lat DOUBLE PRECISION,
    location_lon DOUBLE PRECISION,
    location_alt DOUBLE PRECISION,
    location_name VARCHAR(255),
    status camera_status NOT NULL DEFAULT 'inactive',
    resolution_width INTEGER NOT NULL DEFAULT 1280,
    resolution_height INTEGER NOT NULL DEFAULT 720,
    fps INTEGER NOT NULL DEFAULT 30,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_frame_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cameras_enabled ON cameras(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX idx_cameras_status ON cameras(status);

-- Sightings table
-- Records each observation of a profile
CREATE TABLE sightings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    snapshot_path VARCHAR(512) NOT NULL,
    bbox_x INTEGER NOT NULL,
    bbox_y INTEGER NOT NULL,
    bbox_width INTEGER NOT NULL,
    bbox_height INTEGER NOT NULL,
    confidence REAL NOT NULL,
    location_lat DOUBLE PRECISION,
    location_lon DOUBLE PRECISION,
    recording_id UUID,
    recording_timestamp_ms BIGINT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sightings_profile ON sightings(profile_id, detected_at DESC);
CREATE INDEX idx_sightings_camera ON sightings(camera_id, detected_at DESC);
CREATE INDEX idx_sightings_detected_at ON sightings(detected_at DESC);
CREATE INDEX idx_sightings_location ON sightings(location_lat, location_lon) 
    WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL;

-- Recordings table
-- Stores video recording metadata
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    file_path VARCHAR(512) NOT NULL UNIQUE,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    frame_count BIGINT NOT NULL DEFAULT 0,
    status recording_status NOT NULL DEFAULT 'recording',
    has_detections BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recordings_camera ON recordings(camera_id, started_at DESC);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_started_at ON recordings(started_at DESC);
CREATE INDEX idx_recordings_has_detections ON recordings(has_detections) WHERE has_detections = TRUE;

-- Add foreign key for sightings -> recordings
ALTER TABLE sightings 
    ADD CONSTRAINT fk_sightings_recording 
    FOREIGN KEY (recording_id) 
    REFERENCES recordings(id) 
    ON DELETE SET NULL;

-- Settings table
-- Stores application configuration
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (config) VALUES ('{}');

-- Instance sync table
-- Tracks sync state between instances
CREATE TABLE instance_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    last_sync_at TIMESTAMPTZ,
    sync_database_url VARCHAR(512) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_instance_sync_url ON instance_sync(sync_database_url);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cameras_updated_at
    BEFORE UPDATE ON cameras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
