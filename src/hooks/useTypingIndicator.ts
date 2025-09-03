import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useTypingIndicator(roomId: string, userName: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!userName || !channelRef.current) return;

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_name: userName,
          is_typing: typing,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [userName]);

  const startTyping = useCallback(() => {
    if (isTyping) return;
    
    setIsTyping(true);
    updateTypingStatus(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  }, [isTyping, updateTypingStatus]);

  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    
    setIsTyping(false);
    updateTypingStatus(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, updateTypingStatus]);

  useEffect(() => {
    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel
    const channelName = `typing-${roomId}-${Date.now()}`;
    channelRef.current = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_name, is_typing, timestamp } = payload.payload;
        
        // Ignore own typing
        if (user_name === userName) return;

        setTypingUsers(prev => {
          const filtered = prev.filter(user => user !== user_name);
          
          if (is_typing) {
            return [...filtered, user_name];
          }
          
          return filtered;
        });

        // Auto-remove typing indicator after 3 seconds
        if (is_typing) {
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(user => user !== user_name));
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, userName, updateTypingStatus]);

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
}