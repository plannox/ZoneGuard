import React, { useState } from 'react';
import axios from 'axios';

interface Props {
  onClose: () => void;
  onSuccess: (first: string, last: string, email: string) => void;
}

export default function PersonalDetailsModal({ onClose, onSuccess }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  React.useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/auth/me');
        const d = res.data;
        setFirstName(d.first_name || '');
        setLastName(d.last_name || '');
        setEmail(d.email || '');
        setTitle(d.title || '');
        setPhone(d.phone || '');
        setAddress1(d.address_line1 || '');
        setAddress2(d.address_line2 || '');
        setCity(d.city || '');
        setState(d.state || '');
        setPostal(d.postal_code || '');
        setCountry(d.country || '');
      } catch (err) {
        console.error('Failed to fetch personal details:', err);
      } finally {
        setInitialFetchDone(true);
      }
    };
    fetchDetails();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.put('http://localhost:8000/api/v1/auth/me', {
        first_name: firstName,
        last_name: lastName,
        email: email,
        title: title,
        phone: phone,
        address_line1: address1,
        address_line2: address2,
        city: city,
        state: state,
        postal_code: postal,
        country: country
      });
      localStorage.setItem('first_name', firstName);
      localStorage.setItem('last_name', lastName);
      localStorage.setItem('email', email);
      localStorage.setItem('title', title);
      localStorage.setItem('phone', phone);
      localStorage.setItem('address_line1', address1);
      localStorage.setItem('address_line2', address2);
      localStorage.setItem('city', city);
      localStorage.setItem('state', state);
      localStorage.setItem('postal_code', postal);
      localStorage.setItem('country', country);
      onSuccess(firstName, lastName, email);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update personal details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content fade-in" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 style={{ margin: 0, color: 'var(--text)' }}>Personal Details</h2>
        </div>
        
        {!initialFetchDone ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading your details...
          </div>
        ) : (
          <>
            {error && (
              <div className="alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <label style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', margin: 0 }}>Username</label>
                <input type="text" value={localStorage.getItem('username') || ''} disabled className="login-input" style={{ opacity: 0.7, cursor: 'not-allowed', flex: 1 }} />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Title</label>
                  <input type="text" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} className="login-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>First Name</label>
                  <input type="text" placeholder="First Name" value={firstName} onChange={e=>setFirstName(e.target.value)} className="login-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Last Name</label>
                  <input type="text" placeholder="Last Name" value={lastName} onChange={e=>setLastName(e.target.value)} className="login-input" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email Address</label>
                  <input type="email" placeholder="Email Address" value={email} onChange={e=>setEmail(e.target.value)} className="login-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Phone Number</label>
                  <input type="text" placeholder="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} className="login-input" />
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Address Line 1</label>
                  <input type="text" placeholder="Address Line 1" value={address1} onChange={e=>setAddress1(e.target.value)} className="login-input" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Address Line 2 (Optional)</label>
                  <input type="text" placeholder="Address Line 2 (Optional)" value={address2} onChange={e=>setAddress2(e.target.value)} className="login-input" />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>City</label>
                    <input type="text" placeholder="City" value={city} onChange={e=>setCity(e.target.value)} className="login-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>State/Region</label>
                    <input type="text" placeholder="State/Region" value={state} onChange={e=>setState(e.target.value)} className="login-input" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Postal Code</label>
                    <input type="text" placeholder="Postal Code" value={postal} onChange={e=>setPostal(e.target.value)} className="login-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Country</label>
                    <input type="text" placeholder="Country" value={country} onChange={e=>setCountry(e.target.value)} className="login-input" />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1rem' }}>
                <button type="button" onClick={onClose} className="btn-glass" style={{ width: 'auto' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: 'auto' }}>
                  {loading ? 'SAVING...' : 'SAVE DETAILS'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
