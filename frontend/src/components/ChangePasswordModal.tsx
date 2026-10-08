import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import PasswordInput from './PasswordInput';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [revealInterval, setRevealInterval] = useState(5);
  const [minPwdLength, setMinPwdLength] = useState(6);

  useEffect(() => {
    axios.get('http://localhost:8000/api/v1/auth/public-settings')
      .then(res => {
        if (res.data.pwd_reveal_interval !== undefined) {
          setRevealInterval(parseInt(res.data.pwd_reveal_interval, 10) || 0);
        }
        if (res.data.pwd_min_length !== undefined) {
          setMinPwdLength(parseInt(res.data.pwd_min_length, 10) || 6);
        }
      })
      .catch(err => console.error('Could not load settings', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (oldPassword === newPassword) {
      setError('New password cannot be the same as the current password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/v1/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      setSuccess(res.data.message || 'Password changed successfully.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '400px' }}>
        <div className="modal-header">
          <h2 style={{ margin: 0, color: 'var(--text)' }}>Change Password</h2>
          <button 
            onClick={onClose}
            className="btn-glass"
            style={{ padding: '0.25rem', width: 'auto' }}
          >
            <X size={20} />
          </button>
        </div>
        
        {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Current Password</label>
            <PasswordInput 
              className="login-input"
              style={{ paddingLeft: '16px', width: '100%', boxSizing: 'border-box' }}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              interval={revealInterval}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>New Password</label>
            <PasswordInput 
              className="login-input"
              style={{ paddingLeft: '16px', width: '100%', boxSizing: 'border-box' }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              interval={revealInterval}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
              Minimum {minPwdLength} characters, uppercase, lowercase, number, special character.
            </small>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Confirm New Password</label>
            <PasswordInput 
              className="login-input"
              style={{ paddingLeft: '16px', width: '100%', boxSizing: 'border-box' }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              interval={revealInterval}
            />
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn-glass" 
              onClick={onClose}
              style={{ width: 'auto' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isLoading}
              style={{ width: 'auto' }}
            >
              {isLoading ? 'UPDATING...' : 'CHANGE PASSWORD'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
