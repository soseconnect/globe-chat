import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, RoomParticipant, UserPresence } from '../lib/supabase';

interface EnhancedParticipant extends RoomParticipant {
  is_online: boolean;
  last_seen: string;
}

export function useRoomParticipants(roomId: string, userName: string) {
  const [participants, setParticipants] = useState<EnhancedParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const isJoinedRef = useRef(false);

  const loadParticipants = useCallback(async () => {
    try {
      // Get participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;

      // Get presence data
      const { data: presenceData, error: presenceError } = await supabase
        .from('user_presence')
        .select('*')
        .in('user_name', (participantsData || []).map(p => p.user_name));

      if (presenceError) throw presenceError;

      // Combine data
      const enhancedParticipants = (participantsData || []).map(p => {
        const presence = presenceData?.find(pr => pr.user_name === p.user_name);
        return {
          ...p,
          is_online: presence?.is_online || false,
          last_seen: presence?.last_seen || p.joined_at
        };
      });
      
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
    if (!userName || isJoinedRef.current) return;

    try {
      // Check if already a participant
      const { data: existing } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_name', userName)
        .single();

      if (!existing) {
        await supabase
          .from('room_participants')
          .insert({
            room_id: roomId,
            user_name: userName,
            is_admin: false
          });
      }

      await updatePresence(true);
      isJoinedRef.current = true;
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
      isJoinedRef.current = false;
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }, [roomId, userName, updatePresence]);

  useEffect(() => {
    if (!roomId || !userName) return;

    // Join room and load participants
    joinRoom();
    loadParticipants();

    // Set up presence heartbeat
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, 15000);

    // Subscribe to participant changes
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

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
      .subscribe();

    // Subscribe to presence changes
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    presenceChannelRef.current = supabase
      .channel(`presence_${roomId}_${Date.now()}`)
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
      
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      leaveRoom();
    };
  }, [roomId, userName, joinRoom, leaveRoom, loadParticipants, updatePresence]);

  return { participants, loading, refetch: loadParticipants };
}