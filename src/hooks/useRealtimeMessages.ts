import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Message } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());

  const loadMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      
      const validMessages = data || [];
      setMessages(validMessages);
      
      // Track message IDs
      messageIdsRef.current = new Set(validMessages.map(msg => msg.id));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    // Reset state when room changes
    setMessages([]);
    setLoading(true);
    messageIdsRef.current.clear();
    
    loadMessages();

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel for real-time updates
    channelRef.current = supabase
      .channel(`messages_${roomId}_${Date.now()}`)
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
          
          // Prevent duplicates
          if (messageIdsRef.current.has(newMessage.id)) return;
          
          messageIdsRef.current.add(newMessage.id);
          
          setMessages(prev => {
            // Remove any temp message with same content
            const filtered = prev.filter(msg => 
              !(msg.id.startsWith('temp-') && 
                msg.content === newMessage.content && 
                msg.user_name === newMessage.user_name)
            );
            
            return [...filtered, newMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
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

    try {
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
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  }, [roomId]);

  return { messages, loading, sendMessage, refetch: loadMessages };
}