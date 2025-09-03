import React, { useState } from 'react';
import { Plus, Globe, Lock, Shield, X } from 'lucide-react';
import { supabase, RoomType } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRoomModal({ isOpen, onClose, onCreated }: CreateRoomModalProps) {
  const { userName } = useUser();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'public' as RoomType,
    password: '',
    maxUsers: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName) return;

    setLoading(true);
    
    try {
      const roomData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        password_hash: formData.type === 'password' && formData.password ? 
          btoa(formData.password) : null,
        max_users: formData.maxUsers ? parseInt(formData.maxUsers) : null,
        created_by: userName,
        is_active: true,
        current_users: 0
      };

      const { data, error } = await supabase
        .from('rooms')
        .insert([roomData])
        .select()
        .single();

      if (error) throw error;

      // Add creator as admin participant
      await supabase
        .from('room_participants')
        .insert([{
          room_id: data.id,
          user_name: userName,
          is_admin: true
        }]);

      setFormData({
        name: '',
        description: '',
        type: 'public',
        password: '',
        maxUsers: ''
      });
      
      onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setLoading(false);
    }
  };

  const roomTypes = [
    {
      type: 'public' as RoomType,
      icon: Globe,
      title: 'Public Room',
      description: 'Anyone can find and join this room'
    },
    {
      type: 'private' as RoomType,
      icon: Lock,
      title: 'Private Room',
      description: 'Only accessible via direct link'
    },
    {
      type: 'password' as RoomType,
      icon: Shield,
      title: 'Password Protected',
      description: 'Visible but requires password to join'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Create New Room</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
              maxLength={50}
              placeholder="Enter room name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              rows={3}
              maxLength={200}
              placeholder="Describe your room..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Room Type
            </label>
            <div className="space-y-3">
              {roomTypes.map(({ type, icon: Icon, title, description }) => (
                <label
                  key={type}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.type === type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="roomType"
                    value={type}
                    checked={formData.type === type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as RoomType })}
                    className="sr-only"
                  />
                  <Icon className="w-5 h-5 mr-3 text-gray-600" />
                  <div>
                    <div className="font-medium text-gray-900">{title}</div>
                    <div className="text-sm text-gray-500">{description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {formData.type === 'password' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required={formData.type === 'password'}
                minLength={3}
                placeholder="Enter room password..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Users (optional)
            </label>
            <input
              type="number"
              value={formData.maxUsers}
              onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              min="2"
              max="1000"
              placeholder="Leave empty for unlimited"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}