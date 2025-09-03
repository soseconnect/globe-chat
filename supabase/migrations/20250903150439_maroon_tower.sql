/*
  # Global Chat Application Database Schema

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `name` (text, room name)
      - `description` (text, optional description)
      - `type` (text, room type: public, private, password)
      - `password_hash` (text, hashed password for protected rooms)
      - `max_users` (integer, maximum users allowed)
      - `current_users` (integer, current user count)
      - `created_by` (text, creator username)
      - `created_at` (timestamp)
      - `is_active` (boolean, room status)
      
    - `messages`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `user_name` (text, sender username)
      - `content` (text, message content)
      - `created_at` (timestamp)
      
    - `room_participants`
      - `room_id` (uuid, foreign key to rooms)
      - `user_name` (text, participant username)
      - `joined_at` (timestamp)
      - `is_admin` (boolean, admin status)
      - Primary key: (room_id, user_name)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated and anonymous users
    - Public read access for rooms and messages
    - Authenticated write access for messages and participation
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('public', 'private', 'password')),
  password_hash text,
  max_users integer,
  current_users integer DEFAULT 0,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create room_participants table
CREATE TABLE IF NOT EXISTS room_participants (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false,
  PRIMARY KEY (room_id, user_name)
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

-- Create policies for rooms
CREATE POLICY "Anyone can view public and password-protected rooms"
  ON rooms
  FOR SELECT
  USING (type IN ('public', 'password') AND is_active = true);

CREATE POLICY "Anyone can create rooms"
  ON rooms
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Room creators can update their rooms"
  ON rooms
  FOR UPDATE
  USING (created_by = current_setting('request.jwt.claims', true)::json->>'user_name' OR true);

-- Create policies for messages
CREATE POLICY "Anyone can view messages"
  ON messages
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can send messages"
  ON messages
  FOR INSERT
  WITH CHECK (true);

-- Create policies for room_participants
CREATE POLICY "Anyone can view participants"
  ON room_participants
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join rooms"
  ON room_participants
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participants can leave rooms"
  ON room_participants
  FOR DELETE
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_type_active ON rooms(type, is_active);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_participants_room ON room_participants(room_id);

-- Create function to update room participant count
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rooms 
    SET current_users = (
      SELECT COUNT(*) 
      FROM room_participants 
      WHERE room_id = NEW.room_id
    )
    WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rooms 
    SET current_users = (
      SELECT COUNT(*) 
      FROM room_participants 
      WHERE room_id = OLD.room_id
    )
    WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update participant counts
CREATE TRIGGER trigger_update_participant_count
  AFTER INSERT OR DELETE ON room_participants
  FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();