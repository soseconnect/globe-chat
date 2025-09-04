import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Settings, ArrowLeft, Share, Mic, MicOff, Video, VideoOff, Smile, Search, Bell, BellOff, Phone, PhoneOff, Volume2, VolumeX, Hash, Zap, Clock, MessageCircle, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react';
import { Room, Message } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { useRoomParticipants } from '../hooks/useRoomParticipants';
import { usePresence } from '../hooks/usePresence';
import { useWebRTC } from '../hooks/useWebRTC';
import { TypingIndicator } from './TypingIndicator';
import { RoomSettings } from './RoomSettings';
import { MessageBubble } from './MessageBubble';
import { EmojiPicker } from './EmojiPicker';
import { VideoCall } from './VideoCall';

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
  const [notifications, setNotifications] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const notificationSoundRef = useRef<HTMLAudioElement>();

  const { messages, loading, connectionStatus, sendMessage, refetch } = useRealtimeMessages(room.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(room.id, userName || '');
  const { participants, participantCount, refetch: refetchParticipants } = useRoomParticipants(room.id, userName || '');
  const { onlineUsers, connectionStatus: presenceStatus } = usePresence(room.id, userName || '');
  const webRTC = useWebRTC(room.id, userName || '');

  // Initialize notification sound
  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    notificationSoundRef.current = new Audio();
    notificationSoundRef.current.volume = 0.3;
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > lastMessageCount) {
      scrollToBottom();
      
      // Play notification sound for new messages from others
      if (messages.length > 0 && notifications && soundEnabled) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.user_name !== userName && !lastMessage.id.startsWith('temp-')) {
          playNotificationSound();
        }
      }
      
      setLastMessageCount(messages.length);
    }
  }, [messages.length, userName, notifications, soundEnabled, lastMessageCount]);

  // Auto-focus input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-refresh data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (connectionStatus === 'disconnected') {
        console.log('🔄 Connection lost, refreshing...');
        refetch();
        refetchParticipants();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [connectionStatus, refetch, refetchParticipants]);

  const playNotificationSound = () => {
    if (!soundEnabled) return;
    
    try {
      // Create a simple notification sound using Web Audio API
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
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

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
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2';
    toast.textContent = 'Room link copied to clipboard!';
    document.body.appendChild(toast);
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
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

  const getOnlineStatus = (participantName: string) => {
    return onlineUsers.some(user => user.user_name === participantName && user.is_online);
  };

  const onlineParticipants = participants.filter(p => getOnlineStatus(p.user_name));
  const offlineParticipants = participants.filter(p => !getOnlineStatus(p.user_name));

  const getConnectionStatusColor = () => {
    if (connectionStatus === 'connected' && presenceStatus === 'connected') {
      return 'text-green-600 bg-green-100';
    } else if (connectionStatus === 'connecting' || presenceStatus === 'connecting') {
      return 'text-yellow-600 bg-yellow-100';
    } else {
      return 'text-red-600 bg-red-100';
    }
  };

  const getConnectionStatusText = () => {
    if (connectionStatus === 'connected' && presenceStatus === 'connected') {
      return 'Connected';
    } else if (connectionStatus === 'connecting' || presenceStatus === 'connecting') {
      return 'Connecting...';
    } else {
      return 'Disconnected';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Connecting to {room.name}</h3>
          <p className="text-gray-600">Setting up real-time chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Enhanced Header with Connection Status */}
      <div className="bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onLeave}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Hash className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{currentRoom.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor().includes('green') ? 'bg-green-500 animate-pulse' : getConnectionStatusColor().includes('yellow') ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className={`font-medium ${getConnectionStatusColor().split(' ')[0]}`}>
                      {getConnectionStatusText()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span className="font-medium text-green-600">{onlineParticipants.length}</span>
                    <span>/</span>
                    <span>{participantCount} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>{messages.length} messages</span>
                  </div>
                  <span className="capitalize bg-gray-100 px-2 py-1 rounded-full text-xs">{currentRoom.type}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getConnectionStatusColor()}`}>
              {connectionStatus === 'connected' && presenceStatus === 'connected' ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span>{getConnectionStatusText()}</span>
            </div>

            {/* Manual Refresh */}
            <button
              onClick={() => {
                refetch();
                refetchParticipants();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Search */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
              title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <button
              onClick={() => setNotifications(!notifications)}
              className={`p-2 rounded-lg transition-colors ${notifications ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
              title={notifications ? 'Disable notifications' : 'Enable notifications'}
            >
              {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* Voice/Video Controls */}
            <div className="hidden sm:flex items-center gap-1 mr-2">
              <button
                onClick={webRTC.toggleAudio}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  webRTC.isAudioEnabled 
                    ? 'bg-green-500 text-white shadow-md hover:bg-green-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border'
                }`}
                title={webRTC.isAudioEnabled ? 'Mute microphone' : 'Enable microphone'}
              >
                {webRTC.isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              
              <button
                onClick={webRTC.toggleVideo}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  webRTC.isVideoEnabled 
                    ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border'
                }`}
                title={webRTC.isVideoEnabled ? 'Stop camera' : 'Start camera'}
              >
                {webRTC.isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowVideoCall(!showVideoCall)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showVideoCall 
                    ? 'bg-red-500 text-white shadow-md hover:bg-red-600' 
                    : 'bg-green-500 text-white shadow-md hover:bg-green-600'
                }`}
                title={showVideoCall ? 'End video call' : 'Start video call'}
              >
                {showVideoCall ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </button>
            </div>

            {/* Share Room */}
            <button
              onClick={copyRoomLink}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Share className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            
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
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="max-w-7xl mx-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages and users..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
              {searchQuery && (
                <p className="text-sm text-gray-500 mt-2">
                  Found {filteredMessages.length} messages
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Video Call Overlay */}
      {showVideoCall && (
        <VideoCall
          webRTC={webRTC}
          participants={onlineParticipants}
          onClose={() => setShowVideoCall(false)}
        />
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col">
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
          >
            <div className="max-w-4xl mx-auto space-y-1">
              {filteredMessages.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    {searchQuery ? 'No messages found' : 'No messages yet'}
                  </h3>
                  <p className="text-gray-500">
                    {searchQuery ? 'Try a different search term' : 'Be the first to start the conversation!'}
                  </p>
                </div>
              ) : (
                filteredMessages.map((message, index) => {
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
                        isOnline={getOnlineStatus(message.user_name)}
                      />
                    </div>
                  );
                })
              )}
              
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
                  className="p-1 hover:bg-blue-200 rounded transition-colors text-blue-600"
                >
                  <X className="w-4 h-4" />
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
                    className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 shadow-sm focus:shadow-md"
                    maxLength={1000}
                    autoComplete="off"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span className={`text-xs ${newMessage.length > 900 ? 'text-red-500' : 'text-gray-400'}`}>
                      {newMessage.length}/1000
                    </span>
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members ({participantCount})
              </h3>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 font-medium">{onlineParticipants.length} online</span>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Active: {onlineParticipants.length}</span>
              <span>Away: {offlineParticipants.length}</span>
              <span>Total: {participantCount}</span>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {/* Online Users */}
            {onlineParticipants.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Online ({onlineParticipants.length})
                </h4>
                <div className="space-y-2">
                  {onlineParticipants.map((participant) => (
                    <div
                      key={participant.user_name}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-green-50 transition-all duration-200 border border-transparent hover:border-green-200 hover:shadow-sm"
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
                        <p className="text-xs text-green-600 font-medium">Active now</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Users */}
            {offlineParticipants.length > 0 && (
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Away ({offlineParticipants.length})
                </h4>
                <div className="space-y-2">
                  {offlineParticipants.map((participant) => (
                    <div
                      key={participant.user_name}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 opacity-75"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {participant.user_name[0].toUpperCase()}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-400 border-2 border-white rounded-full"></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {participant.user_name}
                          </p>
                          {participant.is_admin && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Away</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Voice/Video Controls */}
          <div className="p-4 border-t border-gray-200 bg-gray-50/50">
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={webRTC.toggleAudio}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    webRTC.isAudioEnabled 
                      ? 'bg-green-500 text-white shadow-md hover:bg-green-600' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  {webRTC.isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span className="text-sm">{webRTC.isAudioEnabled ? 'Mute' : 'Audio'}</span>
                </button>
                
                <button 
                  onClick={webRTC.toggleVideo}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    webRTC.isVideoEnabled 
                      ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  {webRTC.isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  <span className="text-sm">{webRTC.isVideoEnabled ? 'Stop' : 'Video'}</span>
                </button>
              </div>
              
              <button 
                onClick={() => setShowVideoCall(!showVideoCall)}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 shadow-md ${
                  showVideoCall 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                }`}
              >
                {showVideoCall ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                <span className="text-sm font-medium">{showVideoCall ? 'End Call' : 'Start Call'}</span>
              </button>

              {webRTC.isConnecting && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Connecting...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Room Stats */}
          <div className="p-4 border-t border-gray-200">
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between items-center">
                <span>Messages today:</span>
                <span className="font-medium text-blue-600">
                  {messages.filter(m => formatDate(m.created_at) === 'Today').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Total messages:</span>
                <span className="font-medium text-green-600">{messages.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Room activity:</span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    onlineParticipants.length > 5 ? 'bg-red-500 animate-pulse' :
                    onlineParticipants.length > 2 ? 'bg-yellow-500 animate-pulse' :
                    onlineParticipants.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium">
                    {onlineParticipants.length > 5 ? 'Very High' :
                     onlineParticipants.length > 2 ? 'High' :
                     onlineParticipants.length > 0 ? 'Active' : 'Quiet'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Connection:</span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getConnectionStatusColor()}`}>
                  <Activity className="w-3 h-3" />
                  <span className="font-medium text-xs">{getConnectionStatusText()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Created:</span>
                <span className="font-medium">{formatDate(room.created_at)}</span>
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