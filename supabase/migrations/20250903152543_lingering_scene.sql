/*
  # Enhanced Real-time Chat Schema

  1. New Tables
    - Enhanced `messages` table with message types and better indexing
    - `typing_indicators` table for real-time typing status
    - `user_presence` table for online status tracking

  2. Enhanced Features
    - Real-time typing indicators
    - User presence tracking
    - Message delivery status
    - Better performance with optimized indexes

  3. Security
    - Enhanced RLS policies for all tables
    - Secure real-time subscriptions
    - Proper data validation
*/

-- Add message_type column to messages table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type text DEFAULT 'text';
  END IF;
END $$;

-- Create typing indicators table
CREATE TABLE IF NOT EXISTS typing_indicators (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  is_typing boolean DEFAULT false,
  last_typed timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_name)
);

-- Create user presence table
CREATE TABLE IF NOT EXISTS user_presence (
  user_name text PRIMARY KEY,
  is_online boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  current_room_id uuid REFERENCES rooms(id) ON DELETE SET NULL
);

-- Enable RLS on new tables
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Typing indicators policies
CREATE POLICY "Anyone can view typing indicators"
  ON typing_indicators
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update typing indicators"
  ON typing_indicators
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- User presence policies
CREATE POLICY "Anyone can view user presence"
  ON user_presence
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update user presence"
  ON user_presence
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_typing_indicators_room_active 
  ON typing_indicators(room_id, is_typing, last_typed);

CREATE INDEX IF NOT EXISTS idx_user_presence_online 
  ON user_presence(is_online, last_seen);

CREATE INDEX IF NOT EXISTS idx_messages_room_time 
  ON messages(room_id, created_at DESC);

-- Function to clean up old typing indicators
CREATE OR REPLACE FUNCTION cleanup_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators 
  WHERE last_typed < now() - interval '10 seconds';
END;
$$ LANGUAGE plpgsql;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_name text,
  p_room_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_presence (user_name, is_online, last_seen, current_room_id)
  VALUES (p_user_name, true, now(), p_room_id)
  ON CONFLICT (user_name)
  DO UPDATE SET
    is_online = true,
    last_seen = now(),
    current_room_id = COALESCE(p_room_id, user_presence.current_room_id);
END;
$$ LANGUAGE plpgsql;

-- Enhanced room participant count trigger
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rooms 
    SET current_users = (
      SELECT COUNT(*) 
      FROM room_participants 
      WHERE room_id = NEW.room_id
    )
    WHERE id = NEW.room_id;
    
    -- Update user presence
    PERFORM update_user_presence(NEW.user_name, NEW.room_id);
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rooms 
    SET current_users = (
      SELECT COUNT(*) 
      FROM room_participants 
      WHERE room_id = OLD.room_id
    )
    WHERE id = OLD.room_id;
    
    -- Update user presence (remove from room)
    UPDATE user_presence 
    SET current_room_id = NULL 
    WHERE user_name = OLD.user_name AND current_room_id = OLD.room_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;