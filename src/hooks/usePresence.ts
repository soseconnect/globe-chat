import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UserPresence {
  user_name: string;
  is_online: boolean;
  last_seen: string;
  current_room_id?: string;
}

export function usePresence(roomId: string, userName: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();

  const updatePresence = useCallback(async (isOnline: boolean = true) => {
    if (!userName) return;

    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_name: userName,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          current_room_id: isOnline ? roomId : null
        });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [userName, roomId]);

  const loadOnlineUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('current_room_id', roomId)
        .eq('is_online', true);

      if (error) throw error;
      setOnlineUsers(data || []);
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  }, [roomId]);

  useEffect(() => {
    updatePresence(true);
    loadOnlineUsers();

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, 15000);

    // Subscribe to presence changes
    channelRef.current = supabase
      .channel(`presence_${roomId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          loadOnlineUsers();
        }
      )
      .subscribe();

    // Handle page visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updatePresence(false);
    };
  }, [roomId, userName, updatePresence, loadOnlineUsers]);

  return { onlineUsers, updatePresence };
}