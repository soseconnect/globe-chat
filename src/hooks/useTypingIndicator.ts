import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface TypingUser {
  user_name: string;
  last_typed: Date;
}

export function useTypingIndicator(roomId: string, userName: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTypedRef = useRef<Date>();

  // Broadcast typing status
  const broadcastTyping = useCallback(async (typing: boolean) => {
    if (!userName) return;

    try {
      const channel = supabase.channel(`typing-${roomId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_name: userName,
          is_typing: typing,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error broadcasting typing:', error);
    }
  }, [roomId, userName]);

  // Handle typing start
  const startTyping = useCallback(() => {
    if (isTyping) return;
    
    setIsTyping(true);
    broadcastTyping(true);
    lastTypedRef.current = new Date();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTyping(false);
    }, 3000);
  }, [isTyping, broadcastTyping]);

  // Handle typing stop
  const stopTyping = useCallback(() => {
    if (!isTyping) return;
    
    setIsTyping(false);
    broadcastTyping(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, broadcastTyping]);

  useEffect(() => {
    // Subscribe to typing indicators
    const channel = supabase
      .channel(`typing-${roomId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_name, is_typing, timestamp } = payload.payload;
        
        // Ignore own typing
        if (user_name === userName) return;

        setTypingUsers(prev => {
          const filtered = prev.filter(user => user.user_name !== user_name);
          
          if (is_typing) {
            return [...filtered, { user_name, last_typed: new Date(timestamp) }];
          }
          
          return filtered;
        });
      })
      .subscribe();

    // Clean up old typing indicators
    const cleanupInterval = setInterval(() => {
      setTypingUsers(prev => 
        prev.filter(user => 
          Date.now() - user.last_typed.getTime() < 5000
        )
      );
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, userName]);

  return {
    typingUsers: typingUsers.map(user => user.user_name),
    startTyping,
    stopTyping
  };
}