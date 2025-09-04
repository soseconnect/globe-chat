import React, { useState } from 'react';
import { Copy, Reply, Heart, ThumbsUp, MoreVertical, Check, CheckCheck, Clock, Trash2 } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [loved, setLoved] = useState(false);
  const isTemp = message.id.startsWith('temp-');

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      
      // Show success feedback
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2';
      toast.textContent = 'Message copied!';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        setCopied(false);
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const addReaction = (emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));

    if (emoji === '👍') setLiked(!liked);
    if (emoji === '❤️') setLoved(!loved);

    // Show reaction animation
    const reactionEl = document.createElement('div');
    reactionEl.className = 'fixed pointer-events-none text-3xl z-50 animate-bounce';
    reactionEl.textContent = emoji;
    reactionEl.style.left = '50%';
    reactionEl.style.top = '50%';
    reactionEl.style.transform = 'translate(-50%, -50%)';
    reactionEl.style.animation = 'reactionPop 1s ease-out forwards';
    document.body.appendChild(reactionEl);
    
    setTimeout(() => {
      if (document.body.contains(reactionEl)) {
        document.body.removeChild(reactionEl);
      }
    }, 1000);
  };

  const getDeliveryStatus = () => {
    if (isTemp) {
      return { icon: Clock, color: 'text-gray-400', label: 'Sending...' };
    } else {
      return { icon: CheckCheck, color: 'text-green-500', label: 'Delivered' };
    }
  };

  const deliveryStatus = getDeliveryStatus();

  return (
    <div
      className={`flex gap-3 mb-1 group ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
        showAvatar ? 'mt-4' : 'mt-1'
      } ${isTemp ? 'opacity-70' : 'opacity-100'} transition-all duration-200 hover:bg-gray-50/50 rounded-lg p-2 -m-2`}
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
                isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
            </div>
          )}
        </div>
      )}
      
      <div className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {showName && (
          <div className="text-xs text-gray-500 mb-1 px-1 font-medium flex items-center gap-2">
            {message.user_name}
            {isOnline && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
          </div>
        )}
        
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl relative group/message ${
              isOwnMessage
                ? `bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg ${showAvatar ? 'rounded-tr-md' : ''} ${isLastInGroup ? 'rounded-br-md' : ''}`
                : `bg-white text-gray-900 shadow-lg border border-gray-100 ${showAvatar ? 'rounded-tl-md' : ''} ${isLastInGroup ? 'rounded-bl-md' : ''}`
            } ${isTemp ? 'animate-pulse border-dashed' : ''} hover:shadow-xl transition-all duration-200 cursor-pointer`}
          >
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
            
            {/* Message Actions */}
            {showActions && !isTemp && (
              <div className={`absolute ${isOwnMessage ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction('👍');
                  }}
                  className={`p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 border ${liked ? 'bg-blue-100 border-blue-300' : ''}`}
                  title="Like"
                >
                  <ThumbsUp className={`w-3 h-3 ${liked ? 'text-blue-600' : 'text-gray-600'}`} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction('❤️');
                  }}
                  className={`p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 border ${loved ? 'bg-red-100 border-red-300' : ''}`}
                  title="Love"
                >
                  <Heart className={`w-3 h-3 ${loved ? 'text-red-500' : 'text-red-500'}`} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyMessage();
                  }}
                  className={`p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 border ${copied ? 'bg-green-100' : ''}`}
                  title="Copy message"
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-600" />}
                </button>
                {onReply && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(message);
                    }}
                    className="p-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 border"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3 text-gray-600" />
                  </button>
                )}
              </div>
            )}
            
            {/* Enhanced delivery indicator */}
            {isOwnMessage && (
              <div className="absolute -bottom-1 -right-1">
                <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                  isTemp ? 'bg-gray-400 animate-pulse' : 'bg-green-500'
                }`}>
                  <deliveryStatus.icon className={`w-2.5 h-2.5 text-white`} />
                </div>
              </div>
            )}
          </div>

          {/* Timestamp */}
          {showTime && (
            <div className={`mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
              <span className="text-xs text-gray-500 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full border shadow-sm">
                {formatTime(message.created_at)}
                {isTemp && <span className="ml-1 text-orange-500">(sending...)</span>}
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
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full text-xs hover:bg-gray-50 hover:scale-105 transition-all duration-200 shadow-sm"
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
                isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}