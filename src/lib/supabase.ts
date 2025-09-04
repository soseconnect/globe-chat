import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 100,
    },
  },
  auth: {
    persistSession: false
  }
});

export type RoomType = 'public' | 'private' | 'password';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  description?: string;
  password_hash?: string;
  max_users?: number;
  current_users: number;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  user_name: string;
  content: string;
  created_at: string;
  message_type?: 'text' | 'system';
}

export interface RoomParticipant {
  room_id: string;
  user_name: string;
  joined_at: string;
  is_admin: boolean;
}

export interface TypingIndicator {
  room_id: string;
  user_name: string;
  is_typing: boolean;
  last_typed: string;
}

export interface UserPresence {
  user_name: string;
  is_online: boolean;
  last_seen: string;
  current_room_id?: string;
}

// Global state for real-time updates
export const realtimeState = {
  channels: new Map(),
  subscriptions: new Set(),
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5
};

// Connection health checker
export const checkConnection = async () => {
  try {
    const { data, error } = await supabase.from('rooms').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};