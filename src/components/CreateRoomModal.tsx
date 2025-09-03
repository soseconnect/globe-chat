import React, { useState } from 'react';
import { Plus, Globe, Lock, Shield, X, Sparkles } from 'lucide-react';
import { supabase, RoomType } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const roomTemplates = [
  { name: 'General Chat', description: 'Open discussion for everyone', type: 'public' as RoomType },
  { name: 'Study Group', description: 'Collaborative learning space', type: 'password' as RoomType },
  { name: 'Gaming Lounge', description: 'Talk about games and play together', type: 'public' as RoomType },
  { name: 'Tech Talk', description: 'Discuss technology and programming', type: 'public' as RoomType },
  { name: 'Private Meeting', description: 'Secure space for team discussions', type: 'password' as RoomType },
];

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
  const [showTemplates, setShowTemplates] = useState(true);

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

  const useTemplate = (template: typeof roomTemplates[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      type: template.type,
      password: template.type === 'password' ? 'demo123' : '',
      maxUsers: ''
    });
    setShowTemplates(false);
  };

  const roomTypes = [
    {
      type: 'public' as RoomType,
      icon: Globe,
      title: 'Public Room',
      description: 'Anyone can find and join this room',
      color: 'border-emerald-200 hover:border-emerald-300'
    },
    {
      type: 'private' as RoomType,
      icon: Lock,
      title: 'Private Room',
      description: 'Only accessible via direct link',
      color: 'border-purple-200 hover:border-purple-300'
    },
    {
      type: 'password' as RoomType,
      icon: Shield,
      title: 'Password Protected',
      description: 'Visible but requires password to join',
      color: 'border-orange-200 hover:border-orange-300'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Room</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {showTemplates && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Quick Templates</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {roomTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => useTemplate(template)}
                    className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                  >
                    <h4 className="font-medium text-gray-900 mb-1">{template.name}</h4>
                    <p className="text-sm text-gray-600">{template.description}</p>
                    <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {template.type}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-center">
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Or create custom room →
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all duration-200"
                rows={3}
                maxLength={200}
                placeholder="Describe your room..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Room Type
              </label>
              <div className="grid grid-cols-1 gap-3">
                {roomTypes.map(({ type, icon: Icon, title, description, color }) => (
                  <label
                    key={type}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${color} ${
                      formData.type === type
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:shadow-sm'
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
                    <Icon className="w-6 h-6 mr-4 text-gray-600" />
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                min="2"
                max="1000"
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}