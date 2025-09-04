import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, UserPresence } from '../lib/supabase';

export function usePresence(roomId: string, userName: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const cleanupRef = useRef<NodeJS.Timeout>();

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
        .eq('current_room_id', roomId);

      if (error) throw error;

      // Filter users who are actually online (last seen within 1 minute)
      const now = new Date();
      const activeUsers = (data || []).filter(user => {
        if (!user.is_online) return false;
        const lastSeen = new Date(user.last_seen);
        return (now.getTime() - lastSeen.getTime()) < 60000; // 1 minute
      });

      setOnlineUsers(activeUsers);
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !userName) return;

    updatePresence(true);
    loadOnlineUsers();

    // Set up heartbeat every 15 seconds
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, 15000);

    // Clean up old presence data every 30 seconds
    cleanupRef.current = setInterval(() => {
      loadOnlineUsers();
    }, 30000);

    // Subscribe to presence changes
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

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
        loadOnlineUsers();
      }
    };

    // Handle page unload
    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      if (cleanupRef.current) {
        clearInterval(cleanupRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(false);
    };
  }, [roomId, userName, updatePresence, loadOnlineUsers]);

  return { onlineUsers, updatePresence };
}