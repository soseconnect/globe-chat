import React, { useState } from 'react';
import { Reply, Copy, Heart, ThumbsUp, MoreHorizontal } from 'lucide-react';
import { Message } from '../lib/supabase';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showName: boolean;
  isLastInGroup: boolean;
  formatTime: (timestamp: string) => string;
  onReply: (message: Message) => void;
  isOnline: boolean;
}

export function MessageBubble({
  message,
  isOwnMessage,
  showAvatar,
  showName,
  isLastInGroup,
  formatTime,
  onReply,
  isOnline
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [reactions, setReactions] = useState<{ [key: string]: number }>({});

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    
    // Show toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2';
    toast.textContent = 'Message copied!';
    document.body.appendChild(toast);
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 2000);
  };

  const handleReaction = (emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));
    
    // Show reaction animation
    const reactionEl = document.createElement('div');
    reactionEl.className = 'fixed pointer-events-none z-50 text-2xl';
    reactionEl.textContent = emoji;
    reactionEl.style.left = '50%';
    reactionEl.style.top = '50%';
    reactionEl.style.animation = 'reactionPop 1s ease-out forwards';
    document.body.appendChild(reactionEl);
    
    setTimeout(() => {
      if (document.body.contains(reactionEl)) {
        document.body.removeChild(reactionEl);
      }
    }, 1000);
  };

  return (
    <div 
      className={`flex gap-3 px-4 py-2 hover:bg-gray-50/50 transition-colors group message-enter ${
        isOwnMessage ? 'flex-row-reverse' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {showAvatar && !isOwnMessage && (
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md">
            {message.user_name[0].toUpperCase()}
          </div>
          {isOnline && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : ''}`}>
        {/* Name and Time */}
        {showName && (
          <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
            <span className="text-sm font-semibold text-gray-900">
              {message.user_name}
              {isOwnMessage && ' (You)'}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(message.created_at)}
            </span>
            {isOnline && !isOwnMessage && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className="relative">
          <div
            className={`inline-block max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
              isOwnMessage
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white ml-auto'
                : 'bg-white border border-gray-200 text-gray-900'
            } ${isLastInGroup ? 'mb-3' : 'mb-1'}`}
          >
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
              {message.content}
            </p>
            
            {/* Reactions */}
            {Object.keys(reactions).length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {Object.entries(reactions).map(([emoji, count]) => (
                  <span
                    key={emoji}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-xs"
                  >
                    {emoji} {count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message Actions */}
          {showActions && (
            <div className={`absolute top-0 flex items-center gap-1 transition-all duration-200 ${
              isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'
            }`}>
              <button
                onClick={() => handleReaction('👍')}
                className="p-1.5 bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50 transition-colors"
                title="Like"
              >
                <ThumbsUp className="w-3 h-3 text-gray-600" />
              </button>
              <button
                onClick={() => handleReaction('❤️')}
                className="p-1.5 bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50 transition-colors"
                title="Love"
              >
                <Heart className="w-3 h-3 text-red-500" />
              </button>
              <button
                onClick={() => onReply(message)}
                className="p-1.5 bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50 transition-colors"
                title="Reply"
              >
                <Reply className="w-3 h-3 text-gray-600" />
              </button>
              <button
                onClick={handleCopyMessage}
                className="p-1.5 bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50 transition-colors"
                title="Copy"
              >
                <Copy className="w-3 h-3 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Time for own messages */}
        {isOwnMessage && !showName && (
          <div className="text-xs text-gray-500 mt-1">
            {formatTime(message.created_at)}
          </div>
        )}
      </div>
    </div>
  );
}