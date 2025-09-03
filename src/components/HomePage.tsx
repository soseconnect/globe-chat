import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle, Users, RefreshCw as Refresh, Zap, Globe } from 'lucide-react';
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

  useEffect(() => {
    loadRooms();
    
    // Subscribe to room changes
    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        () => {
          loadRooms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
        },
        () => {
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      // Load public and password-protected rooms with real participant counts
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .in('type', ['public', 'password'])
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate current users count with real-time accuracy
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
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
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

  if (currentRoom) {
    return <ChatRoom room={currentRoom} onLeave={handleLeaveRoom} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Global Chat
                </h1>
                <p className="text-gray-600">Connect with people worldwide</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {userName?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900">{userName}</span>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Room</span>
              </button>

              <button
                onClick={loadRooms}
                className="p-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-md border"
              >
                <Refresh className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                <p className="text-gray-600">Active Rooms</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {rooms.reduce((sum, room) => sum + room.current_users, 0)}
                </p>
                <p className="text-gray-600">Online Users</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"></div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">24/7</p>
                <p className="text-gray-600">Always Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Room Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Available Rooms</h2>
            <p className="text-gray-600">{rooms.length} rooms available</p>
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
          ) : rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No rooms available</h3>
              <p className="text-gray-600 mb-6">Be the first to create a chat room!</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Room
              </button>
            </div>
          )}
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