import React from 'react';
import { Users, Lock, Globe, Shield, Zap } from 'lucide-react';
import { Room } from '../lib/supabase';

interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const getIcon = () => {
    switch (room.type) {
      case 'public':
        return <Globe className="w-5 h-5" />;
      case 'private':
        return <Lock className="w-5 h-5" />;
      case 'password':
        return <Shield className="w-5 h-5" />;
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  const getTypeColor = () => {
    switch (room.type) {
      case 'public':
        return 'text-emerald-600 bg-emerald-100';
      case 'private':
        return 'text-purple-600 bg-purple-100';
      case 'password':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const isRoomFull = room.max_users ? room.current_users >= room.max_users : false;
  const isActive = room.current_users > 0;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 hover:border-blue-300 transform hover:scale-105 cursor-pointer group"
         onClick={() => onJoin(room)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${getTypeColor()}`}>
              {getIcon()}
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor()}`}>
              {room.type.toUpperCase()}
            </span>
            {isActive && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                <Zap className="w-3 h-3" />
                LIVE
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{room.name}</h3>
          
          {room.description && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{room.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <Users className="w-4 h-4" />
            <span>
              {room.current_users}
              {room.max_users && `/${room.max_users}`}
            </span>
          </div>
          
          {isRoomFull && (
            <span className="text-red-500 font-medium">FULL</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin(room);
          }}
          disabled={isRoomFull}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
        >
          {room.type === 'password' ? 'Enter' : 'Join'}
        </button>
      </div>
    </div>
  );
}