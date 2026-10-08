import { useState, useEffect } from 'react';
import axios from 'axios';
import { setAuthToken } from '../core/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const [revealInterval, setRevealInterval] = useState(5);

  useEffect(() => {
    axios.get('http://localhost:8000/api/v1/auth/public-settings')
      .then(res => {
        if (res.data.pwd_reveal_interval !== undefined) {
          setRevealInterval(parseInt(res.data.pwd_reveal_interval, 10) || 0);
        }
      })
      .catch(err => console.error('Could not load settings', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await axios.post('http://localhost:8000/api/v1/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (res.data.must_change_password) {
        setMustChangePassword(true);
      } else {
        setAuthToken(true);
        localStorage.setItem('permissions', JSON.stringify(res.data.permissions || []));
        localStorage.setItem('role', res.data.role || '');
        localStorage.setItem('username', res.data.username || '');
        localStorage.setItem('first_name', res.data.first_name || '');
        localStorage.setItem('last_name', res.data.last_name || '');
        localStorage.setItem('email', res.data.email || '');
        localStorage.setItem('title', res.data.title || '');
        localStorage.setItem('phone', res.data.phone || '');
        localStorage.setItem('address_line1', res.data.address_line1 || '');
        localStorage.setItem('address_line2', res.data.address_line2 || '');
        localStorage.setItem('city', res.data.city || '');
        localStorage.setItem('state', res.data.state || '');
        localStorage.setItem('postal_code', res.data.postal_code || '');
        localStorage.setItem('country', res.data.country || '');
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials or unauthorized access');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setChangePasswordError('New passwords do not match');
      return;
    }
    setIsLoading(true);
    setChangePasswordError('');
    try {
      await axios.post('http://localhost:8000/api/v1/auth/change-password', {
        old_password: password,
        new_password: newPassword
      });
      // After success, it clears session, so we just reset state to force login again
      setMustChangePassword(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed successfully. Please login again with your new password.');
    } catch (err: any) {
      setChangePasswordError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-overlay"></div>
      <div className="login-glass-card fade-in">
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <div className="shield-container pulse">
            <Shield size={64} color="var(--primary)" />
          </div>
          <h1 style={{ color: 'var(--text)', margin: 'var(--spacing-sm) 0 0', fontSize: '2rem', letterSpacing: '2px' }}>ZONE GUARD</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Secure Operations Portal</p>
        </div>

        {!mustChangePassword && error && (
          <div className="alert-error fade-in">
            {error}
          </div>
        )}

        {!mustChangePassword && success && (
          <div className="alert-success fade-in">
            {success}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 'bold' }}>Operator ID</label>
            <div style={{ position: 'relative' }}>
              <UserIcon size={20} className="input-icon" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '10px' }} />
              <input 
                type="text" 
                placeholder="Operator ID" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                className="login-input"
                autoFocus
              />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 'bold' }}>Passcode</label>
            <div style={{ position: 'relative' }}>
              <Lock size={20} className="input-icon" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '10px', zIndex: 1 }} />
              <PasswordInput 
                placeholder="Passcode" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="login-input"
                style={{ paddingLeft: '36px', width: '100%', boxSizing: 'border-box' }}
                interval={revealInterval}
              />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" disabled={isLoading} style={{ marginTop: 'var(--spacing-md)' }}>
            {isLoading ? 'AUTHENTICATING...' : 'INITIALIZE ACCESS'}
          </button>
        </form>
        
        <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Connection: Encrypted • Protocol: Q-Secure
        </div>
      </div>

      {mustChangePassword && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ margin: 0, color: 'var(--text)' }}>Mandatory Security Update</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-lg)' }}>
              Your account requires a password change (First login or expired password). Please choose a new secure password.
            </p>
            {changePasswordError && (
              <div className="alert-error fade-in" style={{ marginBottom: '1rem' }}>
                {changePasswordError}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 'bold' }}>New Password</label>
                <PasswordInput 
                  placeholder="New Password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  className="login-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                  interval={revealInterval}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 'bold' }}>Confirm New Password</label>
                <PasswordInput 
                  placeholder="Confirm New Password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="login-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                  interval={revealInterval}
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setMustChangePassword(false)} className="btn-glass">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'UPDATING...' : 'CHANGE PASSWORD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
