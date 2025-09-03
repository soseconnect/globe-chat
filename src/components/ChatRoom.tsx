import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Settings, ArrowLeft, Share, Mic, MicOff, Video, VideoOff, Smile, Search, Bell, BellOff, MoreVertical, Zap, Activity } from 'lucide-react';
import { Room, Message } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { useRoomParticipants } from '../hooks/useRoomParticipants';
import { TypingIndicator } from './TypingIndicator';
import { RoomSettings } from './RoomSettings';
import { MessageBubble } from './MessageBubble';
import { EmojiPicker } from './EmojiPicker';

interface ChatRoomProps {
  room: Room;
  onLeave: () => void;
}

export function ChatRoom({ room, onLeave }: ChatRoomProps) {
  const { userName } = useUser();
  const [newMessage, setNewMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(room);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { messages, loading, sendMessage } = useRealtimeMessages(room.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(room.id, userName || '');
  const { participants } = useRoomParticipants(room.id, userName || '');

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Auto-focus input when component mounts
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Sound notification for new messages
  useEffect(() => {
    if (messages.length > 0 && notifications) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.user_name !== userName && !lastMessage.id.startsWith('temp-')) {
        // Create notification sound
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    }
  }, [messages, userName, notifications]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userName) return;

    let messageContent = newMessage.trim();
    
    // Add reply context if replying
    if (replyingTo) {
      messageContent = `@${replyingTo.user_name}: ${messageContent}`;
      setReplyingTo(null);
    }

    setNewMessage('');
    stopTyping();
    
    await sendMessage(messageContent, userName);
    
    // Immediate focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSubmit(e);
    } else if (e.key === 'Escape') {
      setReplyingTo(null);
    }
  };

  const copyRoomLink = async () => {
    const link = `${window.location.origin}/room/${room.id}`;
    await navigator.clipboard.writeText(link);
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = 'Room link copied!';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 2000);
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const filteredMessages = searchQuery 
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.user_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Enhanced Header */}
      <div className="bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onLeave}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div>
              <h1 className="text-xl font-bold text-gray-900">{currentRoom.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <Users className="w-4 h-4" />
                  <span>{participants.length} online</span>
                </div>
                <span className="capitalize">{currentRoom.type} room</span>
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-green-600" />
                  <span className="text-green-600 font-medium">Live</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <button
              onClick={() => setNotifications(!notifications)}
              className={`p-2 rounded-lg transition-colors ${notifications ? 'text-blue-600' : 'text-gray-400'}`}
            >
              {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* Voice/Video Controls */}
            <div className="hidden sm:flex items-center gap-1 mr-2">
              <button
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  isVoiceEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isVoiceEnabled ? 'Mute' : 'Unmute'}
              >
                {isVoiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  isVideoEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
              >
                {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>

            {(currentRoom.type === 'private' || currentRoom.type === 'password') && (
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Share className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
            
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 pb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col">
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
          >
            <div className="max-w-4xl mx-auto space-y-1">
              {filteredMessages.map((message, index) => {
                const isOwnMessage = message.user_name === userName;
                const prevMessage = filteredMessages[index - 1];
                const nextMessage = filteredMessages[index + 1];
                
                const showAvatar = !prevMessage || prevMessage.user_name !== message.user_name;
                const showName = showAvatar && !isOwnMessage;
                const isLastInGroup = !nextMessage || nextMessage.user_name !== message.user_name;
                const showDate = !prevMessage || 
                  formatDate(prevMessage.created_at) !== formatDate(message.created_at);
                
                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="text-center my-6">
                        <span className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-gray-500 border shadow-sm">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                    )}
                    
                    <MessageBubble
                      message={message}
                      isOwnMessage={isOwnMessage}
                      showAvatar={showAvatar}
                      showName={showName}
                      isLastInGroup={isLastInGroup}
                      formatTime={formatTime}
                      onReply={handleReply}
                    />
                  </div>
                );
              })}
              
              <TypingIndicator typingUsers={typingUsers} />
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Reply Preview */}
          {replyingTo && (
            <div className="bg-blue-50 border-t border-blue-200 px-4 py-3">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-700">Replying to {replyingTo.user_name}</p>
                    <p className="text-sm text-blue-600 truncate max-w-xs">{replyingTo.content}</p>
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-blue-200 rounded transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Message Input */}
          <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 shadow-lg relative">
            <form onSubmit={handleMessageSubmit} className="max-w-4xl mx-auto">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder={replyingTo ? `Reply to ${replyingTo.user_name}...` : "Type your message..."}
                    className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 shadow-sm focus:shadow-md"
                    maxLength={1000}
                    autoComplete="off"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">{newMessage.length}/1000</span>
                  </div>
                </div>

                {/* Emoji Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-3 text-gray-600 hover:bg-gray-100 rounded-2xl transition-colors"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <EmojiPicker
                    isOpen={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiSelect={handleEmojiSelect}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-2xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Enhanced Participants Sidebar */}
        <div className="hidden lg:block w-80 bg-white/95 backdrop-blur-md border-l border-gray-200 shadow-lg">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participants ({participants.length})
            </h3>
            <p className="text-xs text-gray-500 mt-1">All users are online and active</p>
          </div>
          
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.user_name}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200 hover:shadow-sm"
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md">
                    {participant.user_name[0].toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {participant.user_name}
                      {participant.user_name === userName && ' (You)'}
                    </p>
                    {participant.is_admin && (
                      <span className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-2 py-0.5 rounded-full border">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-500">Active now</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Voice/Video Controls */}
          <div className="p-4 border-t border-gray-200 bg-gray-50/50">
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    isVoiceEnabled 
                      ? 'bg-green-500 text-white shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  {isVoiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span className="text-sm">{isVoiceEnabled ? 'Mute' : 'Voice'}</span>
                </button>
                
                <button 
                  onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    isVideoEnabled 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  <span className="text-sm">{isVideoEnabled ? 'Stop' : 'Video'}</span>
                </button>
              </div>
              
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-md">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Start Call</span>
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-3">
              WebRTC features coming soon
            </p>
          </div>

          {/* Room Stats */}
          <div className="p-4 border-t border-gray-200">
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Messages today:</span>
                <span className="font-medium">{messages.filter(m => formatDate(m.created_at) === 'Today').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Room created:</span>
                <span className="font-medium">{formatDate(room.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Room type:</span>
                <span className="font-medium capitalize">{room.type}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <RoomSettings
        room={currentRoom}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onRoomUpdated={setCurrentRoom}
        onRoomDeleted={onLeave}
      />
    </div>
  );
}