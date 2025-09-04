import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, RoomParticipant } from '../lib/supabase';

interface EnhancedParticipant extends RoomParticipant {
  is_online: boolean;
  last_seen: string;
}

export function useRoomParticipants(roomId: string, userName: string) {
  const [participants, setParticipants] = useState<EnhancedParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();

  const loadParticipants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('room_participants')
        .select(`
          *,
          user_presence (
            is_online,
            last_seen
          )
        `)
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      
      const enhancedParticipants = (data || []).map(p => ({
        ...p,
        is_online: p.user_presence?.is_online || false,
        last_seen: p.user_presence?.last_seen || p.joined_at
      }));
      
      setParticipants(enhancedParticipants);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

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

  const joinRoom = useCallback(async () => {
    if (!userName) return;

    try {
      // Join room
      await supabase
        .from('room_participants')
        .upsert({
          room_id: roomId,
          user_name: userName,
          is_admin: false,
          joined_at: new Date().toISOString()
        });

      // Update presence
      await updatePresence(true);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  }, [roomId, userName, updatePresence]);

  const leaveRoom = useCallback(async () => {
    if (!userName) return;

    try {
      await supabase
        .from('room_participants')
        .delete()
        .match({ room_id: roomId, user_name: userName });

      await updatePresence(false);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }, [roomId, userName, updatePresence]);

  useEffect(() => {
    joinRoom();
    loadParticipants();

    // Set up presence heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, 30000); // Update every 30 seconds

    // Subscribe to participant changes
    channelRef.current = supabase
      .channel(`participants_${roomId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    // Set up presence tracking
    presenceRef.current = supabase
      .channel(`presence_${roomId}`)
      .on('presence', { event: 'sync' }, () => {
        loadParticipants();
      })
      .on('presence', { event: 'join' }, () => {
        loadParticipants();
      })
      .on('presence', { event: 'leave' }, () => {
        loadParticipants();
      })
      .subscribe();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      if (presenceRef.current) {
        supabase.removeChannel(presenceRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      leaveRoom();
    };
  }, [roomId, userName, joinRoom, leaveRoom, loadParticipants, updatePresence]);

  return { participants, loading, refetch: loadParticipants };
}