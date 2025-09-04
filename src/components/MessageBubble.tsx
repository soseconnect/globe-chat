import React, { useState } from 'react';
import { Copy, Reply, Heart, ThumbsUp, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { Message } from '../lib/supabase';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showName: boolean;
  isLastInGroup: boolean;
  formatTime: (timestamp: string) => string;
  onReply?: (message: Message) => void;
  isOnline?: boolean;
}

export function MessageBubble({ 
  message, 
  isOwnMessage, 
  showAvatar, 
  showName, 
  isLastInGroup, 
  formatTime,
  onReply,
  isOnline = false
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [reactions, setReactions] = useState<{[key: string]: number}>({});
  const [showTime, setShowTime] = useState(false);
  const isTemp = message.id.startsWith('temp-');

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    
    // Show toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = 'Message copied!';
    document.body.appendChild(toast);
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 2000);
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
      onClick={() => setShowTime(!showTime)}
    >
      {!isOwnMessage && (
        <div className="w-8 h-8 flex-shrink-0">
          {showAvatar && (
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md ring-2 ring-white">
                {message.user_name[0].toUpperCase()}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
            </div>
          )}
        </div>
      )}
      
      <div className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {showName && (
          <div className="text-xs text-gray-500 mb-1 px-1 font-medium flex items-center gap-2">
            {message.user_name}
            {isOnline && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
          </div>
        )}
        
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl relative group/message ${
              isOwnMessage
                ? `bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg ${showAvatar ? 'rounded-tr-md' : ''} ${isLastInGroup ? 'rounded-br-md' : ''}`
                : `bg-white text-gray-900 shadow-lg border border-gray-100 ${showAvatar ? 'rounded-tl-md' : ''} ${isLastInGroup ? 'rounded-bl-md' : ''}`
            } ${isTemp ? 'animate-pulse' : ''} hover:shadow-xl transition-all duration-200 cursor-pointer`}
          >
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
            
            {/* Message Actions */}
            {showActions && !isTemp && (
              <div className={`absolute ${isOwnMessage ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction('👍');
                  }}
                  className="p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors border"
                  title="Like"
                >
                  <ThumbsUp className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction('❤️');
                  }}
                  className="p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors border"
                  title="Love"
                >
                  <Heart className="w-3 h-3 text-red-500" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyMessage();
                  }}
                  className="p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors border"
                  title="Copy"
                >
                  <Copy className="w-3 h-3 text-gray-600" />
                </button>
                {onReply && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(message);
                    }}
                    className="p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors border"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3 text-gray-600" />
                  </button>
                )}
              </div>
            )}
            
            {/* Delivery indicator for own messages */}
            {isOwnMessage && (
              <div className="absolute -bottom-1 -right-1">
                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                  isTemp ? 'bg-gray-400' : 'bg-green-500'
                }`}>
                  {!isTemp && (
                    <CheckCheck className="w-2 h-2 text-white absolute inset-0.5" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timestamp */}
          {showTime && (
            <div className={`mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
              <span className="text-xs text-gray-500 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full border shadow-sm">
                {formatTime(message.created_at)}
              </span>
            </div>
          )}

          {/* Reactions */}
          {Object.keys(reactions).length > 0 && (
            <div className={`flex gap-1 mt-2 flex-wrap ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => addReaction(emoji)}
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full text-xs hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <span>{emoji}</span>
                  <span className="text-gray-600 font-medium">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isOwnMessage && (
        <div className="w-8 h-8 flex-shrink-0">
          {showAvatar && (
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md ring-2 ring-white">
                {message.user_name[0].toUpperCase()}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}