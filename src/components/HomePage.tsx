import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle, Users, RefreshCw as Refresh, Zap, Globe, TrendingUp, Clock, Star, Activity, Wifi, WifiOff, Search, Filter } from 'lucide-react';
import { supabase, Room } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { RoomCard } from './RoomCard';
import { CreateRoomModal } from './CreateRoomModal';
import { PasswordModal } from './PasswordModal';
import { ChatRoom } from './ChatRoom';
import { useParams, useNavigate } from 'react-router-dom';

export function HomePage() {
  const { userName } = useUser();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [filter, setFilter] = useState<'all' | 'public' | 'password' | 'active'>('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRooms();
    loadStats();
    
    // Set up real-time subscriptions with better error handling
    const roomsChannel = supabase
      .channel(`rooms_changes_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        (payload) => {
          console.log('🏠 Room change:', payload);
          loadRooms();
          loadStats();
          setLastUpdate(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
        },
        (payload) => {
          console.log('👥 Participants change:', payload);
          loadRooms();
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        console.log('🔌 Rooms subscription status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 
                          status === 'CONNECTING' ? 'connecting' : 'disconnected');
      });

    // Auto-refresh every 15 seconds
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing rooms...');
      loadRooms();
      loadStats();
      setLastUpdate(new Date());
    }, 15000);

    // Network status monitoring
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('connecting');
      loadRooms();
      loadStats();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      supabase.removeChannel(roomsChannel);
      clearInterval(refreshInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle direct room access via URL
  useEffect(() => {
    if (roomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        handleJoinRoom(room);
      }
    }
  }, [roomId, rooms]);

  const loadRooms = async () => {
    try {
      setRefreshing(true);
      setConnectionStatus('connecting');
      
      // Load public and password-protected rooms
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .in('type', ['public', 'password'])
        .eq('is_active', true)
        .order('current_users', { ascending: false });

      if (error) throw error;

      // Get real participant counts
      const roomsWithCounts = await Promise.all(
        (data || []).map(async (room) => {
          const { count } = await supabase
            .from('room_participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id);

          return {
            ...room,
            current_users: count || 0
          };
        })
      );

      setRooms(roomsWithCounts);
      setTotalUsers(roomsWithCounts.reduce((sum, room) => sum + room.current_users, 0));
      setConnectionStatus('connected');
      console.log(`✅ Loaded ${roomsWithCounts.length} rooms`);
    } catch (error) {
      console.error('❌ Error loading rooms:', error);
      setConnectionStatus('disconnected');
      
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2';
      toast.textContent = 'Failed to load rooms';
      document.body.appendChild(toast);
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });
      
      setTotalMessages(count || 0);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleJoinRoom = (room: Room) => {
    if (room.type === 'password') {
      setSelectedRoom(room);
      setShowPasswordModal(true);
      setPasswordError('');
    } else {
      setCurrentRoom(room);
      navigate(`/room/${room.id}`);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!selectedRoom) return;

    setJoiningRoom(true);
    setPasswordError('');

    try {
      const hashedPassword = btoa(password);
      
      if (hashedPassword !== selectedRoom.password_hash) {
        setPasswordError('Incorrect password');
        return;
      }

      setCurrentRoom(selectedRoom);
      navigate(`/room/${selectedRoom.id}`);
      setShowPasswordModal(false);
      setSelectedRoom(null);
    } catch (error) {
      setPasswordError('Failed to join room');
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    navigate('/');
    loadRooms(); // Refresh room list
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = !searchQuery || 
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.created_by.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && room.current_users > 0) ||
      room.type === filter;
    
    return matchesSearch && matchesFilter;
  });

  const getActivityLevel = () => {
    const activeRooms = rooms.filter(r => r.current_users > 0).length;
    if (activeRooms > 10) return { level: 'Very High', color: 'text-red-600', bg: 'bg-red-100' };
    if (activeRooms > 5) return { level: 'High', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (activeRooms > 2) return { level: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    if (activeRooms > 0) return { level: 'Low', color: 'text-green-600', bg: 'bg-green-100' };
    return { level: 'Quiet', color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const activityLevel = getActivityLevel();

  const getConnectionColor = () => {
    if (connectionStatus === 'connected' && isOnline) {
      return 'text-green-600 bg-green-100';
    } else if (connectionStatus === 'connecting') {
      return 'text-yellow-600 bg-yellow-100';
    } else {
      return 'text-red-600 bg-red-100';
    }
  };

  if (currentRoom) {
    return <ChatRoom room={currentRoom} onLeave={handleLeaveRoom} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Enhanced Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Global Chat
                </h1>
                <div className="flex items-center gap-4 text-gray-600">
                  <p>Connect with people worldwide in real-time</p>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConnectionColor()}`}>
                      {isOnline && connectionStatus === 'connected' ? (
                        <Wifi className="w-3 h-3" />
                      ) : (
                        <WifiOff className="w-3 h-3" />
                      )}
                      <span>
                        {isOnline ? (connectionStatus === 'connected' ? 'Online' : 'Connecting...') : 'Offline'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      Updated {lastUpdate.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {userName?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900">{userName}</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Room</span>
              </button>

              <button
                onClick={() => {
                  loadRooms();
                  loadStats();
                }}
                disabled={refreshing}
                className="p-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-md border"
                title="Refresh rooms"
              >
                <Refresh className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Enhanced Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                <p className="text-gray-600">Active Rooms</p>
                <p className="text-xs text-gray-500">{rooms.filter(r => r.current_users > 0).length} with users</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                <p className="text-gray-600">Online Users</p>
                <p className="text-xs text-green-600 font-medium">Live count</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalMessages}</p>
                <p className="text-gray-600">Total Messages</p>
                <p className="text-xs text-purple-600 font-medium">All time</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${activityLevel.bg}`}>
                <Activity className={`w-6 h-6 ${activityLevel.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${activityLevel.color}`}>{activityLevel.level}</p>
                <p className="text-gray-600">Activity Level</p>
                <p className="text-xs text-gray-500">Real-time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms by name, description, or creator..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              {[
                { key: 'all', label: 'All', icon: Globe, count: rooms.length },
                { key: 'active', label: 'Active', icon: Zap, count: rooms.filter(r => r.current_users > 0).length },
                { key: 'public', label: 'Public', icon: Globe, count: rooms.filter(r => r.type === 'public').length },
                { key: 'password', label: 'Protected', icon: Star, count: rooms.filter(r => r.type === 'password').length }
              ].map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                    filter === key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-50 hover:shadow-sm border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    filter === key ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Room Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {filter === 'all' ? 'All Rooms' : 
               filter === 'active' ? 'Active Rooms' :
               filter === 'public' ? 'Public Rooms' : 'Protected Rooms'}
            </h2>
            <div className="flex items-center gap-4">
              <p className="text-gray-600">{filteredRooms.length} rooms available</p>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getConnectionColor()}`}>
                {isOnline && connectionStatus === 'connected' ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                <span>
                  {isOnline ? (connectionStatus === 'connected' ? 'Live' : 'Syncing...') : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/70 rounded-xl p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="h-20 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onJoin={handleJoinRoom}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No rooms found' : filter === 'all' ? 'No rooms available' : `No ${filter} rooms found`}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? 'Try a different search term' : filter === 'all' ? 'Be the first to create a chat room!' : 'Try a different filter or create a new room'}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Create Room
              </button>
            </div>
          )}
        </div>

        {/* Enhanced Quick Actions */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg hover:from-blue-200 hover:to-purple-200 transition-all duration-200 border border-blue-200 hover:shadow-md transform hover:scale-105"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Create Room</p>
                <p className="text-sm text-gray-600">Start a new conversation</p>
              </div>
            </button>

            <button
              onClick={() => setFilter('active')}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg hover:from-green-200 hover:to-emerald-200 transition-all duration-200 border border-green-200 hover:shadow-md transform hover:scale-105"
            >
              <Zap className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Join Active</p>
                <p className="text-sm text-gray-600">Find busy rooms</p>
              </div>
            </button>

            <button
              onClick={loadRooms}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-lg hover:from-orange-200 hover:to-yellow-200 transition-all duration-200 border border-orange-200 hover:shadow-md transform hover:scale-105"
            >
              <Refresh className="w-5 h-5 text-orange-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Refresh</p>
                <p className="text-sm text-gray-600">Update room list</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadRooms}
      />

      <PasswordModal
        isOpen={showPasswordModal}
        roomName={selectedRoom?.name || ''}
        onClose={() => {
          setShowPasswordModal(false);
          setSelectedRoom(null);
          setPasswordError('');
        }}
        onSubmit={handlePasswordSubmit}
        loading={joiningRoom}
        error={passwordError}
      />
    </div>
  );
}