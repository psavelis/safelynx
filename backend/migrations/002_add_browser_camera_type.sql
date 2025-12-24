-- Migration: 002_add_browser_camera_type
-- Adds browser camera type for WebRTC-based cameras

-- Add 'browser' to camera_type enum
ALTER TYPE camera_type ADD VALUE IF NOT EXISTS 'browser';
