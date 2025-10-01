import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useTypingIndicator(roomId: string, userName: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>();
  const refreshRef = useRef<NodeJS.Timeout>();

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!userName || !roomId) return;

    try {
      console.log(`⌨️ ${userName} typing: ${typing}`);
      
      const { error } = await supabase
        .from('typing_indicators')
        .upsert({
          room_id: roomId,
          user_name: userName,
          is_typing: typing,
          last_typed: new Date().toISOString()
        }, {
          onConflict: 'room_id,user_name'
        });
      
      if (error) {
        console.error('❌ Error updating typing status:', error);
        throw error;
      }
    } catch (err) {
      console.error('❌ Failed to update typing status:', err);
    }
  }, [userName, roomId]);

  const loadTypingUsers = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const { data, error } = await supabase
        .from('typing_indicators')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_typing', true)
        .neq('user_name', userName);

      if (error) {
        console.error('❌ Error loading typing users:', error);
        throw error;
      }

      // Filter out stale typing indicators (older than 10 seconds)
      const now = new Date();
      const activeTypers = (data || [])
        .filter(indicator => {
          const lastTyped = new Date(indicator.last_typed);
          return (now.getTime() - lastTyped.getTime()) < 10000;
        })
        .map(indicator => indicator.user_name);

      setTypingUsers(activeTypers);
      
      if (activeTypers.length > 0) {
        console.log(`⌨️ Active typers: ${activeTypers.join(', ')}`);
      }
    } catch (err) {
      console.error('❌ Failed to load typing users:', err);
    }
  }, [roomId, userName]);

  const startTyping = useCallback(() => {
    if (isTyping) return;
    
    setIsTyping(true);
    updateTypingStatus(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 5 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 5000);
  }, [isTyping, updateTypingStatus]);

  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    
    setIsTyping(false);
    updateTypingStatus(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, updateTypingStatus]);

  const setupTypingSubscription = useCallback(() => {
    if (!roomId || !userName) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `typing_${roomId}_${Date.now()}`;
    console.log(`🔄 Setting up typing subscription: ${channelName}`);

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('⌨️ Typing indicator change:', payload);
          loadTypingUsers();
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Typing subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Typing subscription active');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log('❌ Typing subscription failed, will reconnect...');
          setTimeout(setupTypingSubscription, 3000);
        }
      });
  }, [roomId, userName, loadTypingUsers]);

  useEffect(() => {
    if (!roomId || !userName) {
      console.log('⚠️ Missing roomId or userName for typing');
      return;
    }

    console.log(`🚀 Setting up typing indicators for room: ${roomId}`);
    
    loadTypingUsers();
    setupTypingSubscription();

    // Clean up old typing indicators every 10 seconds
    cleanupTimeoutRef.current = setInterval(() => {
      loadTypingUsers();
    }, 10000);

    // Refresh typing users every 5 seconds
    refreshRef.current = setInterval(() => {
      loadTypingUsers();
    }, 5000);

    return () => {
      console.log('🧹 Cleaning up typing indicators');
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current);
      }

      if (refreshRef.current) {
        clearInterval(refreshRef.current);
      }

      // Clean up typing status on unmount
      updateTypingStatus(false);
    };
  }, [roomId, userName, updateTypingStatus, loadTypingUsers, setupTypingSubscription]);

  return { typingUsers, startTyping, stopTyping, isTyping };
}