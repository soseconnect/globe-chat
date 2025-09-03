import { useState, useEffect, useCallback } from 'react';
import { supabase, RoomParticipant } from '../lib/supabase';

export function useRoomParticipants(roomId: string, userName: string) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadParticipants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const joinRoom = useCallback(async () => {
    if (!userName) return;

    try {
      const { error } = await supabase
        .from('room_participants')
        .upsert([{
          room_id: roomId,
          user_name: userName,
          is_admin: false
        }], {
          onConflict: 'room_id,user_name'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error joining room:', error);
    }
  }, [roomId, userName]);

  const leaveRoom = useCallback(async () => {
    if (!userName) return;

    try {
      await supabase
        .from('room_participants')
        .delete()
        .match({ room_id: roomId, user_name: userName });
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }, [roomId, userName]);

  useEffect(() => {
    joinRoom();
    loadParticipants();

    // Subscribe to participant changes
    const channel = supabase
      .channel(`participants-${roomId}`)
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

    return () => {
      leaveRoom();
      supabase.removeChannel(channel);
    };
  }, [roomId, userName, joinRoom, leaveRoom, loadParticipants]);

  return { participants, loading, refetch: loadParticipants };
}