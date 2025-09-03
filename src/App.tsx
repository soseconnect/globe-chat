import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { HomePage } from './components/HomePage';
import { UserNameModal } from './components/UserNameModal';

function AppContent() {
  const { userName, setUserName } = useUser();
  const [showNameModal, setShowNameModal] = useState(false);

  useEffect(() => {
    if (!userName) {
      setShowNameModal(true);
    }
  }, [userName]);

  const handleNameSubmit = (name: string) => {
    setUserName(name);
    setShowNameModal(false);
  };

  return (
    <>
      <UserNameModal
        isOpen={showNameModal}
        onSubmit={handleNameSubmit}
        title="Welcome to Global Chat"
      />
      
      {userName && (
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:roomId" element={<HomePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      )}
    </>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;