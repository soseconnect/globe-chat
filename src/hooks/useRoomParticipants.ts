import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, RoomParticipant } from '../lib/supabase';

interface EnhancedParticipant extends RoomParticipant {
  is_online: boolean;
  last_seen: string;
}

export function useRoomParticipants(roomId: string, userName: string) {
  const [participants, setParticipants] = useState<EnhancedParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const isJoinedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const loadParticipants = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setError(null);
      console.log(`👥 Loading participants for room: ${roomId}`);

      // Get participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (participantsError) {
        console.error('❌ Error loading participants:', participantsError);
        throw participantsError;
      }

      // Get presence data
      const { data: presenceData, error: presenceError } = await supabase
        .from('user_presence')
        .select('*');

      if (presenceError) {
        console.warn('⚠️ Error loading presence:', presenceError);
      }

      // Combine data
      const enhancedParticipants = (participantsData || []).map(p => {
        const userPresence = presenceData?.find(pr => pr.user_name === p.user_name);
        const isOnline = userPresence?.is_online && 
          userPresence?.current_room_id === roomId &&
          (new Date().getTime() - new Date(userPresence.last_seen).getTime()) < 120000; // 2 minutes
        
        return {
          ...p,
          is_online: isOnline || false,
          last_seen: userPresence?.last_seen || p.joined_at
        };
      });

      setParticipants(enhancedParticipants);
      console.log(`✅ Loaded ${enhancedParticipants.length} participants`);
    } catch (err) {
      console.error('❌ Error loading participants:', err);
      setError(err instanceof Error ? err : new Error('Failed to load participants'));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const updatePresence = useCallback(async (isOnline: boolean = true) => {
    if (!userName) return;

    try {
      console.log(`👤 Updating presence for ${userName}: ${isOnline ? 'online' : 'offline'}`);
      
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
      
      if (error) {
        console.error('❌ Error updating presence:', error);
        throw error;
      }
      
      console.log(`✅ Presence updated for ${userName}`);
    } catch (err) {
      console.error('❌ Failed to update presence:', err);
      setError(err instanceof Error ? err : new Error('Failed to update presence'));
    }
  }, [userName, roomId]);

  const joinRoom = useCallback(async () => {
    if (!userName || !roomId || isJoinedRef.current) return;

    try {
      console.log(`🚪 ${userName} joining room ${roomId}`);
      
      // Check if already a participant
      const { data: existing } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_name', userName)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('room_participants')
          .insert({
            room_id: roomId,
            user_name: userName,
            is_admin: false
          });
          
        if (error) {
          console.error('❌ Error joining room:', error);
          throw error;
        }
        
        console.log(`✅ ${userName} joined room ${roomId}`);
      } else {
        console.log(`ℹ️ ${userName} already in room ${roomId}`);
      }

      await updatePresence(true);
      isJoinedRef.current = true;
    } catch (err) {
      console.error('❌ Failed to join room:', err);
      setError(err instanceof Error ? err : new Error('Failed to join room'));
    }
  }, [roomId, userName, updatePresence]);

  const leaveRoom = useCallback(async () => {
    if (!userName || !roomId) return;

    try {
      console.log(`🚪 ${userName} leaving room ${roomId}`);
      
      const { error } = await supabase
        .from('room_participants')
        .delete()
        .match({ room_id: roomId, user_name: userName });

      if (error) {
        console.error('❌ Error leaving room:', error);
        throw error;
      }

      await updatePresence(false);
      isJoinedRef.current = false;
      console.log(`✅ ${userName} left room ${roomId}`);
    } catch (err) {
      console.error('❌ Failed to leave room:', err);
    }
  }, [roomId, userName, updatePresence]);

  const setupSubscriptions = useCallback(() => {
    if (!roomId || !userName) return;

    console.log(`🔄 Setting up participants subscriptions for room: ${roomId}`);

    // Clean up existing subscriptions
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    // Participants subscription
    const participantsChannelName = `participants_${roomId}_${Date.now()}`;
    channelRef.current = supabase
      .channel(participantsChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('👥 Participants change:', payload);
          loadParticipants();
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Participants subscription status: ${status}`);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(setupSubscriptions, 3000);
        }
      });

    // Presence subscription
    const presenceChannelName = `presence_${roomId}_${Date.now()}`;
    presenceChannelRef.current = supabase
      .channel(presenceChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          console.log('👤 Presence change:', payload);
          loadParticipants();
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Presence subscription status: ${status}`);
      });
  }, [roomId, userName, loadParticipants]);

  useEffect(() => {
    if (!roomId || !userName) {
      console.log('⚠️ Missing roomId or userName');
      return;
    }

    console.log(`🚀 Initializing participants for room: ${roomId}, user: ${userName}`);
    
    // Reset state
    setParticipants([]);
    setLoading(true);
    setError(null);
    isJoinedRef.current = false;

    // Initialize
    const initialize = async () => {
      await joinRoom();
      await loadParticipants();
      setupSubscriptions();
    };

    initialize();

    // Set up presence heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, 30000);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence(false);
      } else {
        updatePresence(true);
        loadParticipants();
      }
    };

    // Handle page unload
    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('🧹 Cleaning up participants subscription');
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      leaveRoom();
    };
  }, [roomId, userName, joinRoom, leaveRoom, loadParticipants, updatePresence, setupSubscriptions]);

  const participantCount = participants.length;

  return { 
    participants, 
    participantCount,
    loading, 
    error, 
    refetch: loadParticipants 
  };
}