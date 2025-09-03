import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Message } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const lastMessageIdRef = useRef<string>('');

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
      
      // Store last message ID to prevent duplicates
      if (data && data.length > 0) {
        lastMessageIdRef.current = data[data.length - 1].id;
      }
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
      .channel(channelName)
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
          
          // Prevent duplicate messages
          if (newMessage.id === lastMessageIdRef.current) return;
          
          setMessages(prev => {
            // Check if message already exists
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            
            // Remove any temp message with same content and user
            const filtered = prev.filter(msg => 
              !(msg.id.startsWith('temp-') && 
                msg.content === newMessage.content && 
                msg.user_name === newMessage.user_name)
            );
            
            lastMessageIdRef.current = newMessage.id;
            return [...filtered, newMessage];
          });
        }
      )
      .subscribe();

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
      // Optimistic update
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
      const { error } = await supabase
        .from('messages')
        .insert([{
          room_id: roomId,
          user_name: userName,
          content: content.trim(),
          message_type: 'text'
        }]);

      if (error) throw error;

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