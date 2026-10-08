import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getAuthToken, startSessionRefresh } from './core/auth';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Settings from './views/Settings';
import ZoneDetails from './views/ZoneDetails';
import './index.css';

import React from 'react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const auth = getAuthToken();
  return auth ? <>{children}</> : <Navigate to="/login" />;
}

startSessionRefresh();

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        } />
        <Route path="/zones/:id" element={
          <PrivateRoute>
            <ZoneDetails />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
