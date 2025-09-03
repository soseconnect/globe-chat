import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserNameModalProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
  title?: string;
}

export function UserNameModal({ isOpen, onSubmit, title = "Enter Your Name" }: UserNameModalProps) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 2) {
      onSubmit(name.trim());
      setName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-600 mt-2">Choose a name to identify yourself in chat rooms</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
              minLength={2}
              maxLength={30}
              required
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-2">Name must be at least 2 characters long</p>
          </div>

          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
          >
            Continue to Chat
          </button>
        </form>
      </div>
    </div>
  );
}