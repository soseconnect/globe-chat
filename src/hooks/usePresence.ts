import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, UserPresence } from '../lib/supabase';

export function usePresence(roomId: string, userName: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const cleanupRef = useRef<NodeJS.Timeout>();
  const refreshRef = useRef<NodeJS.Timeout>();

  const updatePresence = useCallback(async (isOnline: boolean = true) => {
    if (!userName) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_name: userName,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          current_room_id: isOnline ? roomId : null
        }, {
          onConflict: 'user_name'
        });

      if (error) throw error;
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error updating presence:', error);
      setConnectionStatus('disconnected');
    }
  }, [userName, roomId]);

  const loadOnlineUsers = useCallback(async () => {
    if (!roomId) return;
    
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
      console.log(`👥 ${activeUsers.length} users online in room ${roomId}`);
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  }, [roomId]);

  const setupPresenceSubscription = useCallback(() => {
    if (!roomId || !userName) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `presence_${roomId}_${Date.now()}`;
    console.log(`🔄 Setting up presence subscription: ${channelName}`);

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          console.log('👤 Presence change:', payload);
          loadOnlineUsers();
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Presence subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          setTimeout(setupPresenceSubscription, 2000);
        }
      });
  }, [roomId, userName, loadOnlineUsers]);

  useEffect(() => {
    if (!roomId || !userName) return;

    console.log(`🚀 Initializing presence for room: ${roomId}, user: ${userName}`);
    
    updatePresence(true);
    loadOnlineUsers();
    setupPresenceSubscription();

    // Set up heartbeat every 15 seconds
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, 15000);

    // Refresh online users every 20 seconds
    refreshRef.current = setInterval(() => {
      loadOnlineUsers();
    }, 20000);

    // Clean up old presence data every 30 seconds
    cleanupRef.current = setInterval(async () => {
      try {
        const cutoff = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
        await supabase
          .from('user_presence')
          .update({ is_online: false })
          .lt('last_seen', cutoff);
        
        loadOnlineUsers();
      } catch (error) {
        console.error('Error cleaning up presence:', error);
      }
    }, 30000);

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
      console.log('🧹 Cleaning up presence');
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      if (cleanupRef.current) {
        clearInterval(cleanupRef.current);
      }
      
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(false);
    };
  }, [roomId, userName, updatePresence, loadOnlineUsers, setupPresenceSubscription]);

  return { onlineUsers, connectionStatus, updatePresence };
}