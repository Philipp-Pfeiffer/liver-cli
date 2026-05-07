-- Migration 003: Add updated_at column to drinks table for drink update tracking
ALTER TABLE drinks ADD COLUMN updated_at TEXT;
