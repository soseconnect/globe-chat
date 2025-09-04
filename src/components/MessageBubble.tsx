import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, RoomParticipant, realtimeState } from '../lib/supabase';

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

      // Get participants with presence data in one query
      const { data: participantsData, error: participantsError } = await supabase
        .from('room_participants')
        .select(`
          *,
          user_presence!inner(
            is_online,
            last_seen
          )
        `)
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (participantsError) {
        console.warn('Participants query error:', participantsError);

        // Fallback: get participants and presence separately
        const { data: participants } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', roomId);

        const { data: presence } = await supabase
          .from('user_presence')
          .select('*');

        const enhancedParticipants = (participants || []).map(p => {
          const userPresence = presence?.find(pr => pr.user_name === p.user_name);
          const isOnline = userPresence?.is_online &&
            userPresence?.current_room_id === roomId &&
            (new Date().getTime() - new Date(userPresence.last_seen).getTime()) < 60000;

          return {
            ...p,
            is_online: isOnline || false,
            last_seen: userPresence?.last_seen || p.joined_at
          };
        });

        setParticipants(enhancedParticipants);
        return;
      }

      // Process joined data
      const enhancedParticipants = (participantsData || []).map(p => {
        const presence = (p as any).user_presence;
        const isOnline = presence?.is_online &&
          (new Date().getTime() - new Date(presence.last_seen).getTime()) < 60000;

        return {
          room_id: p.room_id,
          user_name: p.user_name,
          joined_at: p.joined_at,
          is_admin: p.is_admin,
          is_online: isOnline || false,
          last_seen: presence?.last_seen || p.joined_at
        };
      });

      setParticipants(enhancedParticipants);
      console.log(`Loaded ${enhancedParticipants.length} participants for room ${roomId}`);
    } catch (err) {
      console.error('Error loading participants:', err);
      setError(err instanceof Error ? err : new Error('Failed to load participants'));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const updatePresence = useCallback(async (isOnline: boolean = true) => {
    if (!userName) return;

    try {
      setError(null);
      await supabase
        .from('user_presence')
        .upsert({
          user_name: userName,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          current_room_id: isOnline ? roomId : null
        }, {
          onConflict: 'user_name'
        });

      console.log(`Updated presence for ${userName}: ${isOnline ? 'online' : 'offline'}`);
    } catch (err) {
      console.error('Error updating presence:', err);
      setError(err instanceof Error ? err : new Error('Failed to update presence'));
    }
  }, [userName, roomId]);

  const joinRoom = useCallback(async () => {
    if (!userName || !roomId || isJoinedRef.current) return;

    try {
      setError(null);

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

        console.log(`${userName} joined room ${roomId}`);
      }

      await updatePresence(true);
      isJoinedRef.current = true;
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err instanceof Error ? err : new Error('Failed to join room'));
    }
  }, [roomId, userName, updatePresence]);

  const leaveRoom = useCallback(async () => {
    if (!userName || !roomId) return;

    try {
      await supabase
        .from('room_participants')
        .delete()
        .match({ room_id: roomId, user_name: userName });

      await updatePresence(false);
      isJoinedRef.current = false;
      console.log(`${userName} left room ${roomId}`);
    } catch (err) {
      console.error('Error leaving room:', err);
      setError(err instanceof Error ? err : new Error('Failed to leave room'));
    }
  }, [roomId, userName, updatePresence]);

  const setupSubscriptions = useCallback(() => {
    if (!roomId || !userName) return;

    // Clean up existing subscriptions
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);

    // Participants subscription
    const participantsChannelName = `participants:${roomId}:${Date.now()}`;
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
        () => loadParticipants()
      )
      .subscribe((status) => {
        console.log('Participants subscription status:', status);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          reconnectTimeoutRef.current = setTimeout(setupSubscriptions, 2000);
        }
      });

    // Presence subscription
    const presenceChannelName = `presence:${roomId}:${Date.now()}`;
    presenceChannelRef.current = supabase
      .channel(presenceChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => loadParticipants()
      )
      .subscribe();

    realtimeState.channels.set(participantsChannelName, channelRef.current);
    realtimeState.channels.set(presenceChannelName, presenceChannelRef.current);
  }, [roomId, userName, loadParticipants]);

  useEffect(() => {
    if (!roomId || !userName) return;

    console.log('Initializing participants for room:', roomId);

    setParticipants([]);
    setLoading(true);
    isJoinedRef.current = false;

    const initialize = async () => {
      await joinRoom();
      await loadParticipants();
      setupSubscriptions();
    };

    initialize();

    heartbeatRef.current = setInterval(() => updatePresence(true), 15000);

    const handleVisibilityChange = () => {
      updatePresence(!document.hidden);
      if (!document.hidden) loadParticipants();
    };

    const handleBeforeUnload = () => updatePresence(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('Cleaning up participants subscription');

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      leaveRoom();
    };
  }, [roomId, userName, joinRoom, leaveRoom, loadParticipants, updatePresence, setupSubscriptions]);

  return { participants, loading, error, refetch: loadParticipants };
}
export { MessageBubble };
