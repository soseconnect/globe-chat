import React from 'react';
import { Users, Lock, Globe, Shield, Zap, Clock, MessageCircle } from 'lucide-react';
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
        return 'text-emerald-600 bg-emerald-100 border-emerald-200';
      case 'private':
        return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'password':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      default:
        return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  const isRoomFull = room.max_users ? room.current_users >= room.max_users : false;
  const isActive = room.current_users > 0;
  const activityLevel = room.current_users > 5 ? 'high' : room.current_users > 2 ? 'medium' : 'low';

  const getActivityColor = () => {
    switch (activityLevel) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const timeAgo = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just created';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  return (
    <div 
      className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-gray-200 hover:border-blue-300 transform hover:scale-105 cursor-pointer group relative overflow-hidden"
      onClick={() => onJoin(room)}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className={`p-1.5 rounded-lg border ${getTypeColor()}`}>
                {getIcon()}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor()}`}>
                {room.type.toUpperCase()}
              </span>
              {isActive && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getActivityColor()}`}>
                  <Zap className="w-3 h-3" />
                  {activityLevel.toUpperCase()}
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{room.name}</h3>
            
            {room.description && (
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{room.description}</p>
            )}

            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{timeAgo(room.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                <span>by {room.created_by}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <Users className="w-4 h-4" />
              <span className="font-medium">
                {room.current_users}
                {room.max_users && `/${room.max_users}`}
              </span>
            </div>
            
            {isRoomFull && (
              <span className="text-red-500 font-medium text-xs bg-red-100 px-2 py-1 rounded-full">FULL</span>
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
    </div>
  );
}