import React, { useState } from 'react';
import { Settings, Users, Shield, Trash2, Copy, X } from 'lucide-react';
import { supabase, Room } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

interface RoomSettingsProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  onRoomUpdated: (room: Room) => void;
  onRoomDeleted: () => void;
}

export function RoomSettings({ room, isOpen, onClose, onRoomUpdated, onRoomDeleted }: RoomSettingsProps) {
  const { userName } = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: room.name,
    description: room.description || '',
    maxUsers: room.max_users?.toString() || '',
    password: ''
  });

  const isAdmin = room.created_by === userName;

  if (!isOpen) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setLoading(true);
    try {
      const updateData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        max_users: formData.maxUsers ? parseInt(formData.maxUsers) : null,
      };

      if (room.type === 'password' && formData.password) {
        updateData.password_hash = btoa(formData.password);
      }

      const { data, error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', room.id)
        .select()
        .single();

      if (error) throw error;
      onRoomUpdated(data);
      onClose();
    } catch (error) {
      console.error('Error updating room:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !confirm('Are you sure you want to delete this room? This action cannot be undone.')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', room.id);

      if (error) throw error;
      onRoomDeleted();
    } catch (error) {
      console.error('Error deleting room:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${room.id}`;
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Room Settings</h2>
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
          {!isAdmin ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Only</h3>
              <p className="text-gray-600 mb-6">Only room administrators can modify settings.</p>
              
              <div className="space-y-3">
                <button
                  onClick={copyRoomLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Room Link
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                  maxLength={50}
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Users
                </label>
                <input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  min="2"
                  max="1000"
                  placeholder="Unlimited"
                />
              </div>

              {room.type === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password (leave empty to keep current)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    minLength={3}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={copyRoomLink}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Room
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}