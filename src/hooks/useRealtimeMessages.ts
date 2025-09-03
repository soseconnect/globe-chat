import { useState, useEffect, useCallback } from 'react';
import { supabase, Message } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadMessages();

    // Subscribe to new messages with immediate updates
    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages(prev => 
            prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, loadMessages]);

  const sendMessage = useCallback(async (content: string, userName: string) => {
    if (!content.trim()) return;

    try {
      // Optimistic update
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        room_id: roomId,
        user_name: userName,
        content: content.trim(),
        created_at: new Date().toISOString(),
        message_type: 'text'
      };

      setMessages(prev => [...prev, tempMessage]);

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          room_id: roomId,
          user_name: userName,
          content: content.trim(),
          message_type: 'text'
        }])
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real one
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id ? data : msg
        )
      );

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed message
      setMessages(prev => 
        prev.filter(msg => msg.id !== `temp-${Date.now()}`)
      );
    }
  }, [roomId]);

  return { messages, loading, sendMessage, refetch: loadMessages };
}