import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Tokens from './pages/Tokens';
import History from './pages/History';
import DashboardInputs from './pages/DashboardInputs';
import AuthProvider from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardInputs />} />
              <Route path="tokens" element={<Tokens />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;