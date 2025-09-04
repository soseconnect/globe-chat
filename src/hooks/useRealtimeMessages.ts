import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Message } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const isSubscribedRef = useRef(false);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) throw error;
      
      const validMessages = data || [];
      setMessages(validMessages);
      messageIdsRef.current = new Set(validMessages.map(msg => msg.id));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const setupRealtimeSubscription = useCallback(() => {
    if (isSubscribedRef.current || !roomId) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `messages_${roomId}_${Date.now()}`;
    
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
          
          // Prevent duplicates
          if (messageIdsRef.current.has(newMessage.id)) return;
          
          messageIdsRef.current.add(newMessage.id);
          
          setMessages(prev => {
            // Remove any temp message with same content and user
            const filtered = prev.filter(msg => 
              !(msg.id.startsWith('temp-') && 
                msg.content === newMessage.content && 
                msg.user_name === newMessage.user_name &&
                Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000)
            );
            
            return [...filtered, newMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        }
      });

  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    // Reset state
    setMessages([]);
    setLoading(true);
    messageIdsRef.current.clear();
    isSubscribedRef.current = false;

    // Load initial messages
    loadMessages().then(() => {
      // Setup real-time subscription after initial load
      setupRealtimeSubscription();
    });

    return () => {
      isSubscribedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, loadMessages, setupRealtimeSubscription]);

  const sendMessage = useCallback(async (content: string, userName: string) => {
    if (!content.trim() || !userName) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    
    // Optimistic update
    const tempMessage: Message = {
      id: tempId,
      room_id: roomId,
      user_name: userName,
      content: content.trim(),
      created_at: now,
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
      
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = 'Failed to send message';
      document.body.appendChild(toast);
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    }
  }, [roomId]);

  return { messages, loading, sendMessage, refetch: loadMessages };
}