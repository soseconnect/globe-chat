import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Message } from '../lib/supabase';

export function useRealtimeMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setError(null);
      console.log(`📥 Loading messages for room: ${roomId}`);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) {
        console.error('❌ Error loading messages:', error);
        throw error;
      }
      
      setMessages(data || []);
      setConnectionStatus('connected');
      console.log(`✅ Loaded ${data?.length || 0} messages`);
    } catch (err) {
      console.error('❌ Failed to load messages:', err);
      setError('Failed to load messages');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!roomId) return;

    // Clean up existing subscription
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `messages_${roomId}_${Date.now()}`;
    console.log(`🔄 Setting up real-time subscription: ${channelName}`);

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
          console.log('📨 New message received:', payload);
          const newMessage = payload.new as Message;
          
          setMessages(prev => {
            // Check if message already exists
            if (prev.some(msg => msg.id === newMessage.id)) {
              console.log('⚠️ Message already exists, skipping');
              return prev;
            }
            
            // Remove any temporary message with same content and user
            const filtered = prev.filter(msg => 
              !(msg.id.startsWith('temp-') && 
                msg.content === newMessage.content && 
                msg.user_name === newMessage.user_name &&
                Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 10000)
            );
            
            const updated = [...filtered, newMessage].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            
            console.log(`📊 Messages updated: ${updated.length} total`);
            return updated;
          });
          
          setConnectionStatus('connected');
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Messages subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setError(null);
          console.log('✅ Real-time subscription active');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          console.log('❌ Subscription failed, will reconnect...');
          
          // Reconnect after delay
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Reconnecting messages subscription...');
            setupRealtimeSubscription();
          }, 3000);
        } else if (status === 'CONNECTING') {
          setConnectionStatus('connecting');
        }
      });

  }, [roomId]);

  const sendMessage = useCallback(async (content: string, userName: string) => {
    if (!content.trim() || !userName || !roomId) {
      console.log('⚠️ Invalid message data');
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    
    // Optimistic update - add message immediately
    const tempMessage: Message = {
      id: tempId,
      room_id: roomId,
      user_name: userName,
      content: content.trim(),
      created_at: now,
      message_type: 'text'
    };

    console.log(`📤 Sending message: "${content.substring(0, 50)}..."`);
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

      if (error) {
        console.error('❌ Error sending message:', error);
        throw error;
      }

      console.log(`✅ Message sent successfully`);

      // Replace temp message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? data : msg
      ));

    } catch (err) {
      console.error('❌ Failed to send message:', err);
      
      // Remove failed temp message
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Show error notification
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2';
      toast.textContent = 'Failed to send message. Please try again.';
      document.body.appendChild(toast);
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 4000);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      console.log('⚠️ No roomId provided');
      return;
    }

    console.log(`🚀 Initializing messages for room: ${roomId}`);
    
    // Reset state
    setMessages([]);
    setLoading(true);
    setError(null);
    setConnectionStatus('connecting');
    isInitializedRef.current = false;

    // Initialize
    const initialize = async () => {
      await loadMessages();
      setupRealtimeSubscription();
      isInitializedRef.current = true;
    };

    initialize();

    // Auto-refresh every 30 seconds as backup
    refreshIntervalRef.current = setInterval(() => {
      if (connectionStatus === 'disconnected') {
        console.log('🔄 Auto-refreshing messages due to disconnection...');
        loadMessages();
      }
    }, 30000);

    return () => {
      console.log('🧹 Cleaning up messages subscription');
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      isInitializedRef.current = false;
    };
  }, [roomId, loadMessages, setupRealtimeSubscription, connectionStatus]);

  return { 
    messages, 
    loading, 
    error, 
    connectionStatus,
    sendMessage, 
    refetch: loadMessages 
  };
}