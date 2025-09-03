import React from 'react';
import { Message } from '../lib/supabase';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showName: boolean;
  isLastInGroup: boolean;
  formatTime: (timestamp: string) => string;
}

export function MessageBubble({ 
  message, 
  isOwnMessage, 
  showAvatar, 
  showName, 
  isLastInGroup, 
  formatTime 
}: MessageBubbleProps) {
  const isTemp = message.id.startsWith('temp-');

  return (
    <div
      className={`flex gap-3 mb-1 ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
        showAvatar ? 'mt-4' : 'mt-1'
      } ${isTemp ? 'opacity-70' : 'opacity-100'} transition-opacity duration-200`}
    >
      {!isOwnMessage && (
        <div className="w-8 h-8 flex-shrink-0">
          {showAvatar && (
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md">
              {message.user_name[0].toUpperCase()}
            </div>
          )}
        </div>
      )}
      
      <div className={`flex flex-col max-w-xs sm:max-w-md ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {showName && (
          <div className="text-xs text-gray-500 mb-1 px-1 font-medium">
            {message.user_name}
          </div>
        )}
        
        <div
          className={`px-4 py-2 rounded-2xl relative group animate-in slide-in-from-bottom-2 duration-300 ${
            isOwnMessage
              ? `bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md ${showAvatar ? 'rounded-tr-md' : ''} ${isLastInGroup ? 'rounded-br-md' : ''}`
              : `bg-white text-gray-900 shadow-md border border-gray-100 ${showAvatar ? 'rounded-tl-md' : ''} ${isLastInGroup ? 'rounded-bl-md' : ''}`
          } ${isTemp ? 'animate-pulse' : ''}`}
        >
          <p className="text-sm leading-relaxed break-words">{message.content}</p>
          
          {/* Timestamp on hover */}
          <div className={`absolute ${isOwnMessage ? 'left-2' : 'right-2'} -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}>
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
      </div>

      {isOwnMessage && (
        <div className="w-8 h-8 flex-shrink-0">
          {showAvatar && (
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md">
              {message.user_name[0].toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}