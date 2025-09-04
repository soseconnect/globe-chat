import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, realtimeState } from '../lib/supabase';

export function useTypingIndicator(roomId: string, userName: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>();

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!userName || !roomId) return;

    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          room_id: roomId,
          user_name: userName,
          is_typing: typing,
          last_typed: new Date().toISOString()
        }, {
          onConflict: 'room_id,user_name'
        });
      
      console.log(`${userName} typing status: ${typing}`);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [userName, roomId]);

  const startTyping = useCallback(() => {
    if (isTyping) return;
    
    setIsTyping(true);
    updateTypingStatus(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 3000);
  }, [isTyping, updateTypingStatus]);

  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    
    setIsTyping(false);
    updateTypingStatus(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, updateTypingStatus]);

  const loadTypingUsers = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const { data, error } = await supabase
        .from('typing_indicators')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_typing', true)
        .neq('user_name', userName);

      if (error) throw error;

      // Filter out stale typing indicators (older than 5 seconds)
      const now = new Date();
      const activeTypers = (data || [])
        .filter(indicator => {
          const lastTyped = new Date(indicator.last_typed);
          return (now.getTime() - lastTyped.getTime()) < 5000;
        })
        .map(indicator => indicator.user_name);

      setTypingUsers(activeTypers);
    } catch (error) {
      console.error('Error loading typing users:', error);
    }
  }, [roomId, userName]);

  useEffect(() => {
    if (!roomId || !userName) return;

    console.log('Setting up typing indicators for room:', roomId);

    loadTypingUsers();

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new typing subscription
    const channelName = `typing:${roomId}:${Date.now()}`;
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
          console.log('Typing indicator change:', payload);
          const indicator = payload.new || payload.old;
          
          if (!indicator || indicator.user_name === userName) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (indicator.is_typing) {
              setTypingUsers(prev => {
                if (!prev.includes(indicator.user_name)) {
                  return [...prev, indicator.user_name];
                }
                return prev;
              });
            } else {
              setTypingUsers(prev => prev.filter(user => user !== indicator.user_name));
            }
          } else if (payload.eventType === 'DELETE') {
            setTypingUsers(prev => prev.filter(user => user !== indicator.user_name));
          }
        }
      )
      .subscribe((status) => {
        console.log('Typing subscription status:', status);
      });

    // Clean up old typing indicators every 5 seconds
    cleanupTimeoutRef.current = setInterval(() => {
      loadTypingUsers();
    }, 5000);

    realtimeState.channels.set(channelName, channelRef.current);

    return () => {
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

      // Clean up typing status on unmount
      updateTypingStatus(false);
    };
  }, [roomId, userName, updateTypingStatus, loadTypingUsers]);

  return { typingUsers, startTyping, stopTyping, isTyping };
}