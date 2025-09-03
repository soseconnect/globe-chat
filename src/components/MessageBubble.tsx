import React, { useState } from 'react';
import { Copy, Reply, MoreVertical, Heart, ThumbsUp, Smile } from 'lucide-react';
import { Message } from '../lib/supabase';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showName: boolean;
  isLastInGroup: boolean;
  formatTime: (timestamp: string) => string;
  onReply?: (message: Message) => void;
}

export function MessageBubble({ 
  message, 
  isOwnMessage, 
  showAvatar, 
  showName, 
  isLastInGroup, 
  formatTime,
  onReply
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [reactions, setReactions] = useState<{[key: string]: number}>({});
  const isTemp = message.id.startsWith('temp-');

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
  };

  const addReaction = (emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));
  };

  return (
    <div
      className={`flex gap-3 mb-1 group ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
        showAvatar ? 'mt-4' : 'mt-1'
      } ${isTemp ? 'opacity-70' : 'opacity-100'} transition-all duration-200`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwnMessage && (
        <div className="w-8 h-8 flex-shrink-0">
          {showAvatar && (
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md ring-2 ring-white">
              {message.user_name[0].toUpperCase()}
            </div>
          )}
        </div>
      )}
      
      <div className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {showName && (
          <div className="text-xs text-gray-500 mb-1 px-1 font-medium">
            {message.user_name}
          </div>
        )}
        
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl relative group/message ${
              isOwnMessage
                ? `bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg ${showAvatar ? 'rounded-tr-md' : ''} ${isLastInGroup ? 'rounded-br-md' : ''}`
                : `bg-white text-gray-900 shadow-lg border border-gray-100 ${showAvatar ? 'rounded-tl-md' : ''} ${isLastInGroup ? 'rounded-bl-md' : ''}`
            } ${isTemp ? 'animate-pulse' : ''} hover:shadow-xl transition-all duration-200`}
          >
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
            
            {/* Message Actions */}
            {showActions && !isTemp && (
              <div className={`absolute ${isOwnMessage ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                <button
                  onClick={() => addReaction('👍')}
                  className="p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
                  title="Like"
                >
                  <ThumbsUp className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={() => addReaction('❤️')}
                  className="p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
                  title="Love"
                >
                  <Heart className="w-3 h-3 text-red-500" />
                </button>
                <button
                  onClick={copyMessage}
                  className="p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
                  title="Copy"
                >
                  <Copy className="w-3 h-3 text-gray-600" />
                </button>
                {onReply && (
                  <button
                    onClick={() => onReply(message)}
                    className="p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3 text-gray-600" />
                  </button>
                )}
              </div>
            )}
            
            {/* Timestamp */}
            <div className={`absolute ${isOwnMessage ? 'left-2' : 'right-2'} -bottom-6 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200 pointer-events-none`}>
              <span className="text-xs text-gray-500 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full border shadow-sm">
                {formatTime(message.created_at)}
              </span>
            </div>
            
            {/* Delivery indicator for own messages */}
            {isOwnMessage && (
              <div className="absolute -bottom-1 -right-1">
                <div className={`w-3 h-3 rounded-full ${isTemp ? 'bg-gray-400' : 'bg-green-500'} border-2 border-white shadow-sm`}></div>
              </div>
            )}
          </div>

          {/* Reactions */}
          {Object.keys(reactions).length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => addReaction(emoji)}
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full text-xs hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <span>{emoji}</span>
                  <span className="text-gray-600">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isOwnMessage && (
        <div className="w-8 h-8 flex-shrink-0">
          {showAvatar && (
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md ring-2 ring-white">
              {message.user_name[0].toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}