import { useState, useEffect } from 'react';
import { Shield, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../core/auth';
import ChangePasswordModal from './ChangePasswordModal';
import PersonalDetailsModal from './PersonalDetailsModal';

export default function GlobalHeader() {
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);
  
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [firstName, setFirstName] = useState(localStorage.getItem('first_name') || '');
  const [lastName, setLastName] = useState(localStorage.getItem('last_name') || '');
  const [email, setEmail] = useState(localStorage.getItem('email') || '');

  // Keep them up to date if they change
  useEffect(() => {
    const handleStorage = () => {
      setUsername(localStorage.getItem('username') || '');
      setFirstName(localStorage.getItem('first_name') || '');
      setLastName(localStorage.getItem('last_name') || '');
      setEmail(localStorage.getItem('email') || '');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const role = localStorage.getItem('role') || 'User';
  const permsStr = localStorage.getItem('permissions') || '[]';
  let permissions: string[] = [];
  try { permissions = JSON.parse(permsStr); } catch {}
  const hasSettingsAccess = ['user_management', 'zone_management', 'device_management', 'system_settings'].some(p => permissions.includes(p)) || permissions.includes('Administrator');

  const handleLogout = () => {
    logoutUser();
  };

  return (
    <>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 'var(--spacing-md) var(--spacing-lg)', 
        background: 'rgba(24, 24, 27, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', color: 'var(--primary)', fontWeight: 'var(--font-weight-bold)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
          onClick={() => navigate('/dashboard')}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
        >
          <Shield />
          <span style={{ fontSize: '1.2rem', letterSpacing: '1px' }}>ZONE GUARD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          {hasSettingsAccess && (
            <button 
              className="btn-glass"
              onClick={() => navigate('/settings')}
            >
              Settings
            </button>
          )}
          <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 'var(--spacing-md)', borderRight: '1px solid var(--border)', paddingRight: 'var(--spacing-md)' }}
            onMouseEnter={() => setShowUserDropdown(true)}
            onMouseLeave={() => setShowUserDropdown(false)}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
            <span style={{ cursor: 'pointer', fontWeight: 'bold' }}>{username}</span>

            {showUserDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                paddingTop: '10px',
                zIndex: 50,
                minWidth: '220px'
              }}>
                <div style={{
                  background: 'rgba(30, 35, 45, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-md)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {(firstName || lastName) && (
                    <div style={{ color: 'var(--text)', fontWeight: 'bold' }}>
                      {firstName} {lastName}
                    </div>
                  )}
                  {email && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      email: {email}
                    </div>
                  )}
                  {(!firstName && !lastName && !email) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      No personal details added
                    </div>
                  )}
                  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                  <div 
                    style={{ color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer' }}
                    onClick={() => setShowPersonalDetails(true)}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Update my personal details
                  </div>
                </div>
              </div>
            )}
          </div>
          <button 
            className="btn-glass"
            onClick={() => setShowPasswordModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Key size={16} />
            Change Password
          </button>
          <button 
            className="btn-glass"
            style={{ color: 'var(--error)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showPersonalDetails && (
        <PersonalDetailsModal 
          onClose={() => setShowPersonalDetails(false)} 
          onSuccess={(first, last, emailStr) => {
            setFirstName(first);
            setLastName(last);
            setEmail(emailStr);
            setShowPersonalDetails(false);
          }} 
        />
      )}
    </>
  );
}
