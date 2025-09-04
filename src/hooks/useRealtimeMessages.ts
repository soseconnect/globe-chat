import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Message, realtimeState } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setError(null);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(1000);

      if (error) throw error;
      
      setMessages(data || []);
      console.log(`Loaded ${data?.length || 0} messages for room ${roomId}`);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!roomId || channelRef.current) return;

    const channelName = `messages:${roomId}:${Date.now()}`;
    console.log('Setting up real-time subscription:', channelName);

    channelRef.current = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: roomId }
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
          console.log('New message received:', payload);
          const newMessage = payload.new as Message;
          
          setMessages(prev => {
            // Remove any temporary message with same content and user
            const filtered = prev.filter(msg => 
              !(msg.id.startsWith('temp-') && 
                msg.content === newMessage.content && 
                msg.user_name === newMessage.user_name)
            );
            
            // Check if message already exists
            if (filtered.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            
            return [...filtered, newMessage].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
        realtimeState.isConnected = status === 'SUBSCRIBED';
        
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
              setupRealtimeSubscription();
            }
          }, 2000);
        }
      });

    realtimeState.channels.set(channelName, channelRef.current);
  }, [roomId]);

  const sendMessage = useCallback(async (content: string, userName: string) => {
    if (!content.trim() || !userName || !roomId) return;

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
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? data : msg
      ));

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed temp message
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Show error notification
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

  useEffect(() => {
    if (!roomId) return;

    console.log('Initializing messages for room:', roomId);
    
    // Reset state
    setMessages([]);
    setLoading(true);
    setError(null);
    isInitializedRef.current = false;

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Load initial messages then setup real-time
    loadMessages().then(() => {
      isInitializedRef.current = true;
      setupRealtimeSubscription();
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (channelRef.current) {
        console.log('Cleaning up messages subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, loadMessages, setupRealtimeSubscription]);

  return { messages, loading, error, sendMessage, refetch: loadMessages };
}