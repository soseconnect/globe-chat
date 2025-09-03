import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserContextType {
  userName: string | null;
  setUserName: (name: string) => void;
  currentRoom: string | null;
  setCurrentRoom: (roomId: string | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserNameState] = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('chat_username');
    if (saved) {
      setUserNameState(saved);
    }
  }, []);

  const setUserName = (name: string) => {
    setUserNameState(name);
    localStorage.setItem('chat_username', name);
  };

  return (
    <UserContext.Provider value={{ userName, setUserName, currentRoom, setCurrentRoom }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}