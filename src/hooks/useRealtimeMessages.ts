import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Message } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

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

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel with unique name
    const channelName = `room-messages-${roomId}-${Date.now()}`;
    channelRef.current = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: `user-${Date.now()}` }
        }
      })
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
            // Check if message already exists
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            
            // Remove any temp message with same content
            const filtered = prev.filter(msg => 
              !(msg.id.startsWith('temp-') && 
                msg.content === newMessage.content && 
                msg.user_name === newMessage.user_name)
            );
            
            return [...filtered, newMessage].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, loadMessages]);

  const sendMessage = useCallback(async (content: string, userName: string) => {
    if (!content.trim()) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    try {
      // Optimistic update with unique temp ID
      const tempMessage: Message = {
        id: tempId,
        room_id: roomId,
        user_name: userName,
        content: content.trim(),
        created_at: new Date().toISOString(),
        message_type: 'text'
      };

      setMessages(prev => [...prev, tempMessage]);

      // Send to database
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
          msg.id === tempId ? data : msg
        )
      );

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed temp message
      setMessages(prev => 
        prev.filter(msg => msg.id !== tempId)
      );
    }
  }, [roomId]);

  return { messages, loading, sendMessage, refetch: loadMessages };
}