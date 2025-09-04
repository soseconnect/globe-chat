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
      // Update database
      await supabase
        .from('typing_indicators')
        .upsert({
          room_id: roomId,
          user_name: userName,
          is_typing: typing,
          last_typed: new Date().toISOString()
        });

      // Broadcast to other users
      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing_update',
        payload: {
          user_name: userName,
          is_typing: typing,
          room_id: roomId,
          timestamp: Date.now()
        }
      });
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

  useEffect(() => {
    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel
    channelRef.current = supabase
      .channel(`typing_${roomId}_${Date.now()}`)
      .on('broadcast', { event: 'typing_update' }, (payload) => {
        const { user_name, is_typing, room_id } = payload.payload;
        
        // Only process if it's for this room and not from current user
        if (room_id !== roomId || user_name === userName) return;

        setTypingUsers(prev => {
          const filtered = prev.filter(user => user !== user_name);
          
          if (is_typing) {
            return [...filtered, user_name];
          }
          
          return filtered;
        });

        // Auto-remove typing indicator after 5 seconds
        if (is_typing) {
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(user => user !== user_name));
          }, 5000);
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
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
          }
        }
      )
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
  }, [roomId, userName]);

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
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  }, [roomId]);

  return { messages, loading, sendMessage, refetch: loadMessages };
}