import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import GlobalHeader from '../components/GlobalHeader';
import { Users, Map, Settings as SettingsIcon, Settings2, Trash2, Edit2, Check, X, Eye, EyeOff, ChevronDown, ChevronRight, Search, ChevronLeft, ChevronRight as ChevronRightIcon, Camera, Radio, Mic, Activity, UserCheck, Hand, PenTool } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const permsStr = localStorage.getItem('permissions') || '[]';
  let permissions: string[] = [];
  try { permissions = JSON.parse(permsStr); } catch {}
  const hasPerm = (p: string) => permissions.includes(p) || permissions.includes('Administrator'); // Fallback just in case

  const availableTabs = [];
  if (hasPerm('user_management')) availableTabs.push('users');
  if (hasPerm('zone_management')) availableTabs.push('zones');
  if (hasPerm('device_management')) availableTabs.push('devices');
  if (hasPerm('system_settings')) availableTabs.push('system');

  const urlTab = location.hash.replace('#', '');
  const initialTab = availableTabs.includes(urlTab) ? urlTab : (availableTabs[0] || '');
  
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!initialTab) navigate('/dashboard');
  }, [initialTab, navigate]);

  const [clearanceRules, setClearanceRules] = useState<any[]>([]);
  const [rulesSuccessMsg, setRulesSuccessMsg] = useState('');


  useEffect(() => {
    window.history.replaceState(null, '', `#${activeTab}`);
  }, [activeTab]);
  const [systemTab, setSystemTab] = useState('general');
  const [users, setUsers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<any[]>([]);

  // Dialog State - Devices
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);

  // Form states - Devices
  const [editDeviceId, setEditDeviceId] = useState<number | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('CCTV');
  const [newDeviceZone, setNewDeviceZone] = useState('');
  const [newDeviceMode, setNewDeviceMode] = useState('AUTO');
  const [newDeviceX, setNewDeviceX] = useState<number | string>('');
  const [newDeviceY, setNewDeviceY] = useState<number | string>('');
  const [deviceError, setDeviceError] = useState('');
  const [keepDeviceOpen, setKeepDeviceOpen] = useState(false);
  const [newDeviceTypeName, setNewDeviceTypeName] = useState('');
  const [showDeviceTypeInput, setShowDeviceTypeInput] = useState(false);
  const [showDeviceTypesManager, setShowDeviceTypesManager] = useState(false);
  const [editingDeviceTypeId, setEditingDeviceTypeId] = useState<number | null>(null);
  const [editingDeviceTypeName, setEditingDeviceTypeName] = useState('');

  // Pagination & Search States - Devices
  const [deviceSearch, setDeviceSearch] = useState('');
  const [devicePage, setDevicePage] = useState(1);
  const [devicePageSize, setDevicePageSize] = useState(10);

  // Dialog State
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  // Generic Delete Target
  const [deleteTarget, setDeleteTarget] = useState<{type: string, id: number, name: string} | null>(null);

  // Form states - Users
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('Operator');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAddress1, setNewAddress1] = useState('');
  const [newAddress2, setNewAddress2] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPostal, setNewPostal] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newLocked, setNewLocked] = useState(false);

  const [userError, setUserError] = useState('');
  const [keepUserOpen, setKeepUserOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCustomPassword, setIsCustomPassword] = useState(false);

  // Pagination & Search States - Users
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  // Pagination & Search States - Zones
  const [zoneSearch, setZoneSearch] = useState('');
  const [zonePage, setZonePage] = useState(1);
  const [zonePageSize, setZonePageSize] = useState(10);

  const [openSections, setOpenSections] = useState({
    account: true,
    personal: false,
    security: false
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleRevealPassword = () => {
    const intervalStr = systemSettings['pwd_reveal_interval'];
    const interval = intervalStr !== undefined ? parseInt(intervalStr, 10) : 5;
    if (interval === 0) {
      setShowPassword(prev => !prev);
    } else {
      setShowPassword(true);
      setTimeout(() => setShowPassword(false), interval * 1000);
    }
  };

  const handleRevealConfirmPassword = () => {
    const intervalStr = systemSettings['pwd_reveal_interval'];
    const interval = intervalStr !== undefined ? parseInt(intervalStr, 10) : 5;
    if (interval === 0) {
      setShowConfirmPassword(prev => !prev);
    } else {
      setShowConfirmPassword(true);
      setTimeout(() => setShowConfirmPassword(false), interval * 1000);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    const spec = "!@#$%^&*";
    let pwd = chars[Math.floor(Math.random()*chars.length)] + 
              uppers[Math.floor(Math.random()*uppers.length)] +
              nums[Math.floor(Math.random()*nums.length)] +
              spec[Math.floor(Math.random()*spec.length)];
    const all = chars + uppers + nums + spec;
    for(let i=0; i<10; i++) {
        pwd += all[Math.floor(Math.random()*all.length)];
    }
    setNewPassword(pwd);
    setConfirmPassword(pwd);
  };

  // Form states - Zones
  const [editZoneId, setEditZoneId] = useState<number | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneLevel, setNewZoneLevel] = useState(1);
  const [newZoneDesc, setNewZoneDesc] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#00d2ff');
  const [newZoneLocation, setNewZoneLocation] = useState('');
  const [newZoneArea, setNewZoneArea] = useState<number | string>('');
  const [newZoneGeometry, setNewZoneGeometry] = useState<string>('[]');
  const [isZoneDrawMode, setIsZoneDrawMode] = useState<boolean>(true);
  const [isDeviceDrawMode, setIsDeviceDrawMode] = useState<boolean>(true);
  const [zoneError, setZoneError] = useState('');
  const [keepZoneOpen, setKeepZoneOpen] = useState(false);
  
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [drawingStart, setDrawingStart] = useState<{x: number, y: number} | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{x: number, y: number} | null>(null);

  // System Settings state
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [sysError, setSysError] = useState('');
  const [sysSuccess, setSysSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/users');
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/zones');
      setZones(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchDeviceTypes = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/device-types');
      setDeviceTypes(res.data);
    } catch (err) { console.error(err); }
  };
  const fetchDevices = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/devices');
      setDevices(res.data);
    } catch (err) { console.error(err); }
  };
  
  const fetchSettings = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/system-settings');
      setSystemSettings(res.data);
    } catch (err) { console.error(err); }
  };


  const fetchClearanceRules = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/clearance-rules');
      setClearanceRules(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/roles');
      setRoles(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchUsers();
    fetchZones();
    fetchDevices();
    fetchDeviceTypes();
    fetchSettings();
    fetchClearanceRules();
    fetchRoles();
  }, []);

  const resetUserForm = () => {
    setNewUsername('');
    setNewRole('Operator');
    setNewPassword('');
    setConfirmPassword('');
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPhone('');
    setNewTitle('');
    setNewAddress1('');
    setNewAddress2('');
    setNewCity('');
    setNewState('');
    setNewPostal('');
    setNewCountry('');
    setNewLocked(false);
    setIsCustomPassword(false);
    setUserError('');
    setEditUserId(null);
    setOpenSections({ account: true, personal: false, security: false });
  };

  const resetZoneForm = () => {
    setNewZoneName('');
    setNewZoneLevel(1);
    setNewZoneDesc('');
    setNewZoneColor('#00d2ff');
    setNewZoneLocation('');
    setNewZoneArea('');
    setNewZoneGeometry('[]');
    setZoneError('');
    setEditZoneId(null);
  };

  const resetDeviceForm = () => {
    setNewDeviceName('');
    setNewDeviceType('CCTV');
    setNewDeviceZone(zones.length > 0 ? zones[0].id.toString() : '');
    setNewDeviceMode('AUTO');
    setNewDeviceX('');
    setNewDeviceY('');
    setDeviceError('');
    setEditDeviceId(null);
  };

  const openCreateDevice = () => {
    resetDeviceForm();
    setShowDeviceDialog(true);
  };

  const openEditDevice = (device: any) => {
    resetDeviceForm();
    setEditDeviceId(device.id);
    setNewDeviceName(device.name);
    setNewDeviceType(device.device_type);
    setNewDeviceZone(device.zone_id.toString());
    setNewDeviceMode(device.operating_mode || 'AUTO');
    setNewDeviceX(device.x ?? '');
    setNewDeviceY(device.y ?? '');
    setShowDeviceDialog(true);
  };

  const handleDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceError('');
    try {
      const payload = {
        name: newDeviceName,
        device_type: newDeviceType,
        zone_id: Number(newDeviceZone),
        operating_mode: newDeviceMode,
        x: newDeviceX === '' ? null : Number(newDeviceX),
        y: newDeviceY === '' ? null : Number(newDeviceY)
      };
      if (editDeviceId) {
        await axios.put(`http://localhost:8000/api/v1/devices/${editDeviceId}`, payload);
        setShowDeviceDialog(false);
      } else {
        await axios.post('http://localhost:8000/api/v1/devices', payload);
        if (keepDeviceOpen) {
          resetDeviceForm();
        } else {
          setShowDeviceDialog(false);
        }
      }
      fetchDevices();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setDeviceError(Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : (typeof detail === 'string' ? detail : JSON.stringify(detail || 'Operation failed')));
    }
  };

  const handleDeviceTypeSubmit = async () => {
    if (!newDeviceTypeName.trim()) return;
    try {
      await axios.post('http://localhost:8000/api/v1/device-types', { name: newDeviceTypeName.toUpperCase() });
      setNewDeviceType(newDeviceTypeName.toUpperCase());
      setNewDeviceTypeName('');
      setShowDeviceTypeInput(false);
      fetchDeviceTypes();
    } catch (err) { console.error(err); }
  };

  const handleDeleteDeviceType = (id: number, name: string) => {
    setDeleteTarget({ type: 'device-type', id, name });
    setShowDeleteDialog(true);
  };

  const handleUpdateDeviceType = async (id: number) => {
    if (!editingDeviceTypeName.trim()) return;
    try {
      await axios.put(`http://localhost:8000/api/v1/device-types/${id}`, { name: editingDeviceTypeName.toUpperCase() });
      setEditingDeviceTypeId(null);
      fetchDeviceTypes();
    } catch (err) { alert('Failed to update device type.'); }
  };

  const openCreateUser = () => {
    resetUserForm();
    generatePassword();
    setShowUserDialog(true);
  };

  const openEditUser = (user: any) => {
    resetUserForm();
    setEditUserId(user.id);
    setNewUsername(user.username);
    setNewRole(user.role);
    setNewFirstName(user.first_name || '');
    setNewLastName(user.last_name || '');
    setNewEmail(user.email || '');
    setNewPhone(user.phone || '');
    setNewTitle(user.title || '');
    setNewAddress1(user.address_line1 || '');
    setNewAddress2(user.address_line2 || '');
    setNewCity(user.city || '');
    setNewState(user.state || '');
    setNewPostal(user.postal_code || '');
    setNewCountry(user.country || '');
    setNewLocked(user.locked ? true : false);
    setShowUserDialog(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (isCustomPassword && newPassword && newPassword !== confirmPassword) {
      setUserError('Passwords do not match');
      return;
    }
    
    const payload = {
      username: newUsername,
      role: newRole,
      password: newPassword || undefined,
      first_name: newFirstName,
      last_name: newLastName,
      email: newEmail,
      phone: newPhone,
      title: newTitle,
      address_line1: newAddress1,
      address_line2: newAddress2,
      city: newCity,
      state: newState,
      postal_code: newPostal,
      country: newCountry,
      locked: newLocked
    };
    try {
      if (editUserId) {
        await axios.put(`http://localhost:8000/api/v1/users/${editUserId}`, payload);
        setShowUserDialog(false);
      } else {
        await axios.post('http://localhost:8000/api/v1/users', payload);
        if (keepUserOpen) {
          resetUserForm();
        } else {
          setShowUserDialog(false);
        }
      }
      fetchUsers();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setUserError(Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : (typeof detail === 'string' ? detail : JSON.stringify(detail || 'Operation failed')));
    }
  };

  const openCreateZone = () => {
    resetZoneForm();
    setShowZoneDialog(true);
  };

  const openEditZone = (zone: any) => {
    resetZoneForm();
    setEditZoneId(zone.id);
    setNewZoneName(zone.name);
    setNewZoneLevel(zone.clearance_level);
    setNewZoneDesc(zone.description || '');
    setNewZoneColor(zone.color || '#00d2ff');
    setNewZoneLocation(zone.location || '');
    setNewZoneArea(zone.covered_area || '');
    setNewZoneGeometry(typeof zone.geometry === 'string' ? zone.geometry : JSON.stringify(zone.geometry || []));
    setShowZoneDialog(true);
  };


  const handleSaveRules = async () => {
    try {
      for (const rule of clearanceRules) {
        await axios.put(`http://localhost:8000/api/v1/clearance-rules/${rule.level}`, {
            level: rule.level,
            biometric_threshold: rule.biometric_threshold,
            max_dwell_time: rule.max_dwell_time,
            tailgating_severity: rule.tailgating_severity
        });
      }
      setRulesSuccessMsg('Security rules updated successfully.');
      setTimeout(() => setRulesSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setZoneError('');
    try {
      const payload = { 
        name: newZoneName, 
        clearance_level: newZoneLevel, 
        description: newZoneDesc,
        color: newZoneColor,
        location: newZoneLocation,
        covered_area: Number(newZoneArea) || 0.0,
        geometry: newZoneGeometry
      };
      if (editZoneId) {
        await axios.put(`http://localhost:8000/api/v1/zones/${editZoneId}`, payload);
        setShowZoneDialog(false);
      } else {
        await axios.post('http://localhost:8000/api/v1/zones', payload);
        if (keepZoneOpen) {
          resetZoneForm();
        } else {
          setShowZoneDialog(false);
        }
      }
      fetchZones();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setZoneError(Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : (typeof detail === 'string' ? detail : JSON.stringify(detail || 'Operation failed')));
    }
  };

  const openDeleteConfirm = (type: string, id: number, name: string) => {
    setDeleteError('');
    setDeleteTarget({ type, id, name });
    setShowDeleteDialog(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'user') {
        await axios.delete(`http://localhost:8000/api/v1/users/${deleteTarget.id}`);
        fetchUsers();
      } else if (deleteTarget.type === 'device') {
        await axios.delete(`http://localhost:8000/api/v1/devices/${deleteTarget.id}`);
        fetchDevices();
      } else if (deleteTarget.type === 'device-type') {
        await axios.delete(`http://localhost:8000/api/v1/device-types/${deleteTarget.id}`);
        fetchDeviceTypes();
        setShowDeviceTypesManager(false);
      } else {
        await axios.delete(`http://localhost:8000/api/v1/zones/${deleteTarget.id}`);
        fetchZones();
      }
      setShowDeleteDialog(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setDeleteError(Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : (typeof detail === 'string' ? detail : JSON.stringify(detail || 'Delete failed')));
    }
  };

  const saveSettings = async () => {
    setSysError('');
    setSysSuccess('');
    try {
      const payload = Object.keys(systemSettings).map(k => ({ key: k, value: String(systemSettings[k]) }));
      await axios.put('http://localhost:8000/api/v1/system-settings', payload);
      setSysSuccess('System settings updated successfully.');
    } catch (err: any) {
      setSysError('Failed to save settings');
    }
  };

  // -------------------------------------------------------------
  // Data Filtering & Pagination
  // -------------------------------------------------------------
  const filteredUsers = users.filter(u => {
    const term = userSearch.toLowerCase();
    const full = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    return u.username.toLowerCase().includes(term) || full.includes(term) || u.role.toLowerCase().includes(term);
  });
  const totalUserPages = Math.ceil(filteredUsers.length / userPageSize) || 1;
  const paginatedUsers = filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize);

  const filteredZones = zones.filter(z => {
    const term = zoneSearch.toLowerCase();
    return z.name.toLowerCase().includes(term) || String(z.clearance_level).includes(term);
  });
  const totalZonePages = Math.ceil(filteredZones.length / zonePageSize) || 1;
  const paginatedZones = filteredZones.slice((zonePage - 1) * zonePageSize, zonePage * zonePageSize);

  const filteredDevices = devices.filter(d => {
    const term = deviceSearch.toLowerCase();
    const zoneName = zones.find(z => z.id === d.zone_id)?.name?.toLowerCase() || '';
    return d.name.toLowerCase().includes(term) || d.device_type.toLowerCase().includes(term) || zoneName.includes(term);
  });
  const totalDevicePages = Math.ceil(filteredDevices.length / devicePageSize) || 1;
  const paginatedDevices = filteredDevices.slice((devicePage - 1) * devicePageSize, devicePage * devicePageSize);


  return (
    <div className="layout">
      <div className="sidebar" style={{ width: '280px' }}>
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
          Settings
        </div>
        <ul style={{ listStyle: 'none', padding: '0 var(--spacing-sm)', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {hasPerm('user_management') && (
            <li 
              style={{ 
                padding: '12px 16px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: '12px', transition: 'var(--transition-fast)',
                background: activeTab === 'users' ? 'rgba(212, 168, 83, 0.1)' : 'transparent', 
                color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)' 
              }}
              onClick={() => { setActiveTab('users'); setUserPage(1); }}
            >
              <Users size={18} /> User Management
            </li>
          )}
          {hasPerm('zone_management') && (
            <li 
              style={{ 
                padding: '12px 16px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: '12px', transition: 'var(--transition-fast)',
                background: activeTab === 'zones' ? 'rgba(212, 168, 83, 0.1)' : 'transparent', 
                color: activeTab === 'zones' ? 'var(--primary)' : 'var(--text-muted)' 
              }}
              onClick={() => { setActiveTab('zones'); setZonePage(1); }}
            >
              <Map size={18} /> Zone Configuration
            </li>
          )}
          {hasPerm('device_management') && (
            <li 
              style={{ 
                padding: '12px 16px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: '12px', transition: 'var(--transition-fast)',
                background: activeTab === 'devices' ? 'rgba(212, 168, 83, 0.1)' : 'transparent', 
                color: activeTab === 'devices' ? 'var(--primary)' : 'var(--text-muted)' 
              }}
              onClick={() => { setActiveTab('devices'); setDevicePage(1); }}
            >
              <Eye size={18} /> Device Management
            </li>
          )}
          {hasPerm('system_settings') && (
            <li 
              style={{ 
                padding: '12px 16px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: '12px', transition: 'var(--transition-fast)',
                background: activeTab === 'system' ? 'rgba(212, 168, 83, 0.1)' : 'transparent', 
                color: activeTab === 'system' ? 'var(--primary)' : 'var(--text-muted)' 
              }}
              onClick={() => setActiveTab('system')}
            >
              <SettingsIcon size={18} /> System Settings
            </li>
          )}
        </ul>
      </div>
      <div className="main-content" style={{ background: 'var(--background)' }}>
        <GlobalHeader />
        <div style={{ padding: 'var(--spacing-xl)', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
            <h2>
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'zones' && 'Zone Configuration'}
              {activeTab === 'devices' && 'Device Management'}
              {activeTab === 'system' && 'System Settings'}
            </h2>
            {activeTab === 'users' && <button className="btn-primary" onClick={openCreateUser} style={{ width: 'auto' }}>+ Add User</button>}
            {activeTab === 'zones' && <button className="btn-primary" onClick={openCreateZone} style={{ width: 'auto' }}>+ Add Zone</button>}
            {activeTab === 'devices' && <button className="btn-primary" onClick={openCreateDevice} style={{ width: 'auto' }}>+ Add Device</button>}
          </div>

          <div className="glass-panel fade-in" style={{ padding: 0, overflow: 'hidden' }}>

            {activeTab === 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Users Toolbar */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ position: 'relative', width: '250px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                      className="login-input"
                      style={{ paddingLeft: '36px', margin: 0, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Rows per page:</span>
                    <select 
                      value={userPageSize} 
                      onChange={e => { setUserPageSize(Number(e.target.value)); setUserPage(1); }}
                      className="login-input" 
                      style={{ padding: '6px 12px', margin: 0 }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No users found.</td></tr>
                      ) : paginatedUsers.map(u => (
                        <tr key={u.id} style={{ 
                          background: u.locked ? 'rgba(244, 63, 94, 0.05)' : 'transparent',
                          borderLeft: u.locked ? '3px solid var(--error)' : '3px solid transparent',
                          opacity: u.locked ? 0.8 : 1,
                          transition: 'var(--transition-fast)' 
                        }}>
                          <td>{u.id}</td>
                          <td>
                            <strong style={{ color: u.locked ? 'var(--error)' : 'var(--text)', textDecoration: u.locked ? 'line-through' : 'none' }}>
                              {u.username}
                            </strong>
                          </td>
                          <td>{(u.first_name || u.last_name) ? `${u.title ? u.title + ' ' : ''}${u.first_name || ''} ${u.last_name || ''}` : '-'}</td>
                          <td><span style={{ color: 'var(--primary)' }}>{u.role}</span></td>
                          <td>
                            {u.locked ? 
                              <span style={{ color: 'var(--error)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 8, height: 8, borderRadius: '50%', background: 'var(--error)'}} /> Locked</span> : 
                              <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 8, height: 8, borderRadius: '50%', background: '#4ade80'}} /> Active</span>
                            }
                          </td>
                          <td>
                            <button className="btn-glass" onClick={() => openEditUser(u)} style={{ fontSize: '12px', marginRight: '8px' }}>Edit</button>
                            <button className="btn-glass" onClick={() => openDeleteConfirm('user', u.id, u.username)} style={{ fontSize: '12px', color: 'var(--error)' }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Page {userPage} of {totalUserPages}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-glass" disabled={userPage === 1} onClick={() => setUserPage(p => Math.max(1, p - 1))} style={{ padding: '6px' }}><ChevronLeft size={16} /></button>
                    <button className="btn-glass" disabled={userPage === totalUserPages} onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))} style={{ padding: '6px' }}><ChevronRightIcon size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'zones' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Zones Toolbar */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ position: 'relative', width: '250px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search zones..." 
                      value={zoneSearch}
                      onChange={e => { setZoneSearch(e.target.value); setZonePage(1); }}
                      className="login-input"
                      style={{ paddingLeft: '36px', margin: 0, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Rows per page:</span>
                    <select 
                      value={zonePageSize} 
                      onChange={e => { setZonePageSize(Number(e.target.value)); setZonePage(1); }}
                      className="login-input" 
                      style={{ padding: '6px 12px', margin: 0 }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Zone Name</th>
                        <th>Clearance Level</th>
                        <th>Location</th>
                        <th>Covered Area (sqm)</th>
                        <th>Color</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedZones.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No zones found.</td></tr>
                      ) : paginatedZones.map(z => (
                        <tr key={z.id}>
                          <td>{z.id}</td>
                          <td><strong style={{ color: 'var(--text)' }}>{z.name}</strong></td>
                          <td>Level {z.clearance_level}</td>
                          <td>{z.location || 'N/A'}</td>
                          <td>{z.covered_area || 0}</td>
                          <td>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: z.color || '#00d2ff', border: '1px solid var(--border)' }} title={z.color}></div>
                          </td>
                          <td>
                            <button className="btn-glass" onClick={() => navigate(`/zones/${z.id}`)} style={{ fontSize: '12px', marginRight: '8px' }}>View</button>
                            <button className="btn-glass" onClick={() => openEditZone(z)} style={{ fontSize: '12px', marginRight: '8px' }}>Edit</button>
                            <button className="btn-glass" onClick={() => openDeleteConfirm('zone', z.id, z.name)} style={{ fontSize: '12px', color: 'var(--error)' }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Page {zonePage} of {totalZonePages}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-glass" disabled={zonePage === 1} onClick={() => setZonePage(p => Math.max(1, p - 1))} style={{ padding: '6px' }}><ChevronLeft size={16} /></button>
                    <button className="btn-glass" disabled={zonePage === totalZonePages} onClick={() => setZonePage(p => Math.min(totalZonePages, p + 1))} style={{ padding: '6px' }}><ChevronRightIcon size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ position: 'relative', width: '250px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search devices..." 
                      value={deviceSearch}
                      onChange={e => { setDeviceSearch(e.target.value); setDevicePage(1); }}
                      className="login-input"
                      style={{ paddingLeft: '36px', margin: 0, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Rows per page:</span>
                    <select 
                      value={devicePageSize} 
                      onChange={e => { setDevicePageSize(Number(e.target.value)); setDevicePage(1); }}
                      className="login-input" 
                      style={{ padding: '6px 12px', margin: 0 }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Device Name</th>
                        <th>Type</th>
                        <th>Zone</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDevices.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No devices found.</td></tr>
                      ) : paginatedDevices.map(d => (
                        <tr key={d.id}>
                          <td>{d.id}</td>
                          <td><strong style={{ color: 'var(--text)' }}>{d.name}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {d.device_type === 'CCTV' ? <Camera size={16} /> :
                               d.device_type === 'AUDIO' ? <Mic size={16} /> :
                               d.device_type === 'PIR' ? <Activity size={16} /> :
                               d.device_type === 'ACCESS' ? <UserCheck size={16} /> :
                               <Radio size={16} />}
                              {d.device_type}
                            </div>
                          </td>
                          <td>{zones.find(z => z.id === d.zone_id)?.name || 'Unknown'}</td>
                          <td>
                            <span style={{ color: d.status === 'ONLINE' ? 'var(--success)' : 'var(--error)' }}>
                              {d.status}
                            </span>
                          </td>
                          <td>
                            <button className="btn-glass" onClick={() => openEditDevice(d)} style={{ fontSize: '12px', marginRight: '8px' }}>Edit</button>
                            <button className="btn-glass" onClick={() => openDeleteConfirm('device', d.id, d.name)} style={{ fontSize: '12px', color: 'var(--error)' }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Page {devicePage} of {totalDevicePages}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-glass" disabled={devicePage === 1} onClick={() => setDevicePage(p => Math.max(1, p - 1))} style={{ padding: '6px' }}><ChevronLeft size={16} /></button>
                    <button className="btn-glass" disabled={devicePage === totalDevicePages} onClick={() => setDevicePage(p => Math.min(totalDevicePages, p + 1))} style={{ padding: '6px' }}><ChevronRightIcon size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 1rem' }}>
                  <button 
                    className={`btn-glass ${systemTab === 'general' ? 'active' : ''}`}
                    style={{ borderBottom: systemTab === 'general' ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: 0, padding: '1rem', width: 'auto' }}
                    onClick={() => setSystemTab('general')}
                  >General Settings</button>
                  <button 
                    className={`btn-glass ${systemTab === 'password' ? 'active' : ''}`}
                    style={{ borderBottom: systemTab === 'password' ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: 0, padding: '1rem', width: 'auto' }}
                    onClick={() => setSystemTab('password')}
                  >Password Policy</button>
                  <button 
                    className={`btn-glass ${systemTab === 'security_rules' ? 'active' : ''}`}
                    style={{ borderBottom: systemTab === 'security_rules' ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: 0, padding: '1rem', width: 'auto' }}
                    onClick={() => setSystemTab('security_rules')}
                  >Security Rules Matrix</button>
                </div>

                <div style={{ padding: 'var(--spacing-lg)' }}>
                  {sysError && <div className="alert-error fade-in" style={{marginBottom: '1rem'}}>{sysError}</div>}
                  {sysSuccess && <div className="alert-success fade-in" style={{marginBottom: '1rem'}}>{sysSuccess}</div>}
                  
                  <div style={{ display: 'grid', gap: '1rem', maxWidth: '500px' }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Configure dynamic system settings. These are generated directly from the database configuration keys.
                    </p>
                    
                    {systemTab === 'general' && (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {Object.keys(systemSettings).filter(k => !k.startsWith('pwd_') && !k.startsWith('floorplan_')).map(key => {
                          const isBool = systemSettings[key] === 'true' || systemSettings[key] === 'false';
                          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                          if (isBool) {
                            return (
                              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="checkbox" checked={systemSettings[key] === 'true'} onChange={e => setSystemSettings({...systemSettings, [key]: e.target.checked ? 'true' : 'false'})} />
                                {label}
                              </label>
                            );
                          }
                          if (key === 'feed_retention_hours') {
                            return (
                              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.9rem' }}>Live Feed Retention (Hours)</span>
                                <input type="number" className="login-input" min="1" max="8760" value={systemSettings[key]} onChange={e => setSystemSettings({...systemSettings, [key]: e.target.value})} />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  How many hours of history the Live Event Feed shows. Older incidents are not deleted; they are only hidden from the feed (1 - 8760).
                                </span>
                              </label>
                            );
                          }
                          return (
                            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.9rem' }}>{label}</span>
                              <input type="text" className="login-input" value={systemSettings[key]} onChange={e => setSystemSettings({...systemSettings, [key]: e.target.value})} />
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    {systemTab === 'password' && (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                          <input 
                            type="checkbox" 
                            checked={systemSettings['pwd_expiration_enabled'] === 'true'} 
                            onChange={e => setSystemSettings({...systemSettings, pwd_expiration_enabled: e.target.checked ? 'true' : 'false'})} 
                          />
                          Password Expiration
                        </label>
                        
                        {systemSettings['pwd_expiration_enabled'] === 'true' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.9rem' }}>Password Expiration (Months)</span>
                            <input 
                              type="number" 
                              className="login-input" 
                              min="1"
                              value={systemSettings['pwd_expiration_months'] || ''} 
                              onChange={e => setSystemSettings({...systemSettings, pwd_expiration_months: e.target.value})} 
                            />
                          </label>
                        )}
                        
                        <div style={{ height: '1px', background: 'var(--border)', margin: '1rem 0' }}></div>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.9rem' }}>Minimum Password Length</span>
                          <input 
                            type="number" 
                            className="login-input" 
                            value={systemSettings['pwd_min_length'] || ''} 
                            onChange={e => setSystemSettings({...systemSettings, pwd_min_length: e.target.value})} 
                          />
                        </label>
                        
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.9rem' }}>Password Reveal Autohide Interval (Seconds)</span>
                          <input 
                            type="number" 
                            className="login-input" 
                            value={systemSettings['pwd_reveal_interval'] || ''} 
                            onChange={e => setSystemSettings({...systemSettings, pwd_reveal_interval: e.target.value})} 
                            placeholder="e.g. 5 (0 for manual toggle only)"
                          />
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" checked={systemSettings['pwd_require_upper'] === 'true'} onChange={e => setSystemSettings({...systemSettings, pwd_require_upper: e.target.checked ? 'true' : 'false'})} />
                          Require Uppercase Letter (A-Z)
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" checked={systemSettings['pwd_require_lower'] === 'true'} onChange={e => setSystemSettings({...systemSettings, pwd_require_lower: e.target.checked ? 'true' : 'false'})} />
                          Require Lowercase Letter (a-z)
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" checked={systemSettings['pwd_require_number'] === 'true'} onChange={e => setSystemSettings({...systemSettings, pwd_require_number: e.target.checked ? 'true' : 'false'})} />
                          Require Number (0-9)
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" checked={systemSettings['pwd_require_special'] === 'true'} onChange={e => setSystemSettings({...systemSettings, pwd_require_special: e.target.checked ? 'true' : 'false'})} />
                          Require Special Character (!@#$%^&*)
                        </label>
                      </div>
                    )}

                    {systemTab === 'security_rules' && (
                      <div style={{ display: 'grid', gap: '1rem', width: '100%', minWidth: '600px' }}>
                        {rulesSuccessMsg && <div className="alert-success" style={{ marginBottom: 'var(--spacing-lg)' }}>{rulesSuccessMsg}</div>}
                        
                        {clearanceRules.map((rule, idx) => (
                          <details key={rule.level} style={{ marginBottom: 'var(--spacing-lg)', background: 'var(--surface)', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-md)' }}>
                            <summary style={{ fontSize: '1.2rem', color: 'var(--primary)', cursor: 'pointer', outline: 'none', fontWeight: 'bold' }}>Level {rule.level} Clearance</summary>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
                              <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px' }}>Biometric Threshold</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <input type="range" min="0.5" max="1.0" step="0.01" value={rule.biometric_threshold} onChange={e => {
                                    const newRules = [...clearanceRules];
                                    newRules[idx].biometric_threshold = parseFloat(e.target.value);
                                    setClearanceRules(newRules);
                                  }} style={{ flex: 1 }} />
                                  <span>{rule.biometric_threshold.toFixed(2)}</span>
                                </div>
                              </div>
                              
                              <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px' }}>Max Dwell Time (s)</label>
                                <input type="number" value={rule.max_dwell_time} onChange={e => {
                                  const newRules = [...clearanceRules];
                                  newRules[idx].max_dwell_time = parseInt(e.target.value, 10);
                                  setClearanceRules(newRules);
                                }} className="form-control" style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />
                              </div>
                              
                              <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px' }}>Tailgating Severity</label>
                                <select value={rule.tailgating_severity} onChange={e => {
                                  const newRules = [...clearanceRules];
                                  newRules[idx].tailgating_severity = e.target.value;
                                  setClearanceRules(newRules);
                                }} className="form-control" style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }}>
                                  <option value="INFO">INFO</option>
                                  <option value="WARNING">WARNING</option>
                                  <option value="MEDIUM">MEDIUM</option>
                                  <option value="HIGH">HIGH</option>
                                  <option value="CRITICAL">CRITICAL</option>
                                </select>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}

                    {systemTab !== 'security_rules' && (
                      <button className="btn-primary" onClick={saveSettings} style={{ width: 'auto', marginTop: '1rem' }}>
                        Save {systemTab === 'general' ? 'General' : 'Password'} Settings
                      </button>
                    )}
                    {systemTab === 'security_rules' && (
                      <button className="btn-primary" onClick={handleSaveRules} style={{ width: 'auto', marginTop: '1rem' }}>
                        Save Configuration
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Dialog */}
      {showUserDialog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editUserId ? 'Edit User Profile' : 'Create New User'}</h3>
            </div>
            {userError && <div className="alert-error">{userError}</div>}
            
            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              
              {/* Account Details Section */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div 
                  onClick={() => toggleSection('account')}
                  style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Account Details
                  {openSections.account ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                {openSections.account && (
                  <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Username (Login Name)</label>
                      <input type="text" placeholder="Username" value={newUsername} onChange={e=>setNewUsername(e.target.value)} required className="login-input" />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Role</label>
                      <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="login-input">
                        {roles.map(r => (
                          <option key={r.id} value={r.name} title={r.description}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Personal Details Section */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div 
                  onClick={() => toggleSection('personal')}
                  style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Personal Details
                  {openSections.personal ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                {openSections.personal && (
                  <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ width: '100px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Title</label>
                        <input type="text" placeholder="Title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} className="login-input" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>First Name</label>
                        <input type="text" placeholder="First Name" value={newFirstName} onChange={e=>setNewFirstName(e.target.value)} className="login-input" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Last Name</label>
                        <input type="text" placeholder="Last Name" value={newLastName} onChange={e=>setNewLastName(e.target.value)} className="login-input" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email Address</label>
                        <input type="email" placeholder="Email Address" value={newEmail} onChange={e=>setNewEmail(e.target.value)} className="login-input" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Phone Number</label>
                        <input type="text" placeholder="Phone Number" value={newPhone} onChange={e=>setNewPhone(e.target.value)} className="login-input" />
                      </div>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Address Line 1</label>
                        <input type="text" placeholder="Address Line 1" value={newAddress1} onChange={e=>setNewAddress1(e.target.value)} className="login-input" />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Address Line 2 (Optional)</label>
                        <input type="text" placeholder="Address Line 2 (Optional)" value={newAddress2} onChange={e=>setNewAddress2(e.target.value)} className="login-input" />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>City</label>
                          <input type="text" placeholder="City" value={newCity} onChange={e=>setNewCity(e.target.value)} className="login-input" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>State/Region</label>
                          <input type="text" placeholder="State/Region" value={newState} onChange={e=>setNewState(e.target.value)} className="login-input" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Postal Code</label>
                          <input type="text" placeholder="Postal Code" value={newPostal} onChange={e=>setNewPostal(e.target.value)} className="login-input" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Country</label>
                          <input type="text" placeholder="Country" value={newCountry} onChange={e=>setNewCountry(e.target.value)} className="login-input" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Security Section */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div 
                  onClick={() => toggleSection('security')}
                  style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Security
                  {openSections.security ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                {openSections.security && (
                  <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button type="button" onClick={generatePassword} className="btn-glass" style={{ fontSize: '12px' }}>Generate Secure Password</button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={isCustomPassword} onChange={e => {
                          setIsCustomPassword(e.target.checked);
                          if (!e.target.checked) generatePassword();
                          else { setNewPassword(''); setConfirmPassword(''); }
                        }} />
                        Custom Password
                      </label>
                    </div>
                    <div className="input-group" style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder={editUserId ? "New Password (Leave blank to keep current)" : "Generated Password"} 
                        value={newPassword} 
                        onChange={e=>setNewPassword(e.target.value)} 
                        className="login-input" 
                        required={!editUserId}
                        readOnly={!isCustomPassword}
                        style={{ paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box', opacity: !isCustomPassword ? 0.7 : 1 }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={handleRevealPassword}
                        style={{
                          position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title={parseInt(systemSettings['pwd_reveal_interval'] || '5', 10) === 0 ? "Toggle password visibility" : `Reveal for ${parseInt(systemSettings['pwd_reveal_interval'] || '5', 10)} seconds`}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {isCustomPassword && (
                      <div className="input-group" style={{ position: 'relative' }}>
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          placeholder="Confirm Password" 
                          value={confirmPassword} 
                          onChange={e=>setConfirmPassword(e.target.value)} 
                          className="login-input" 
                          required={true}
                          style={{ paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={handleRevealConfirmPassword}
                          style={{
                            position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title={parseInt(systemSettings['pwd_reveal_interval'] || '5', 10) === 0 ? "Toggle password visibility" : `Reveal for ${parseInt(systemSettings['pwd_reveal_interval'] || '5', 10)} seconds`}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    )}
                    
                    {editUserId && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', color: 'var(--error)' }}>
                        <input type="checkbox" checked={newLocked} onChange={e => setNewLocked(e.target.checked)} />
                        Lock Account (Prevent Login)
                      </label>
                    )}
                  </div>
                )}
              </div>
              
              {!editUserId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={keepUserOpen} onChange={e => setKeepUserOpen(e.target.checked)} />
                  Keep dialog open after creation
                </label>
              )}
              
              <div className="modal-footer" style={{ marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowUserDialog(false)} className="btn-glass" style={{ width: 'auto' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>{editUserId ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zone Dialog */}
      {showZoneDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editZoneId ? 'Edit Zone' : 'Create Zone'}</h3>
            </div>
            {zoneError && <div className="alert-error">{zoneError}</div>}
            <form onSubmit={handleZoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Zone Name
                  <input type="text" placeholder="Zone Name" value={newZoneName} onChange={e=>setNewZoneName(e.target.value)} required className="login-input" />
                </label>
                <label style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Clearance Level
                  <input type="number" placeholder="Level" value={newZoneLevel} onChange={e=>setNewZoneLevel(parseInt(e.target.value))} required className="login-input" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Location
                  <input type="text" placeholder="Location" value={newZoneLocation} onChange={e=>setNewZoneLocation(e.target.value)} className="login-input" />
                </label>
                <label style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Area (sqm)
                  <input type="number" placeholder="Area" value={newZoneArea} onChange={e=>setNewZoneArea(e.target.value)} className="login-input" />
                </label>
                <label style={{ width: '60px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Color
                  <input type="color" value={newZoneColor} onChange={e=>setNewZoneColor(e.target.value)} className="login-input" style={{ width: '100%', padding: '2px', height: '38px', cursor: 'pointer' }} title="Zone Color" />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Description
                <textarea placeholder="Description" value={newZoneDesc} onChange={e=>setNewZoneDesc(e.target.value)} className="login-input" style={{ minHeight: '60px', resize: 'vertical' }} />
              </label>

              <TransformWrapper initialScale={1} minScale={0.5} maxScale={10} centerOnInit panning={{ disabled: isZoneDrawMode }}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: 'var(--text)', border: '1px solid var(--primary)', pointerEvents: 'none' }}>
                        Click & drag to draw rectangles
                      </div>
                      <div style={{ display: 'flex', gap: '4px', zIndex: 10 }}>
                        <div style={{ display: 'flex', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden', marginRight: '8px' }}>
                          <button type="button" onClick={(e) => { e.preventDefault(); setIsZoneDrawMode(false); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: !isZoneDrawMode ? 'var(--primary)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                            <Hand size={14} /> Pan
                          </button>
                          <button type="button" onClick={(e) => { e.preventDefault(); setIsZoneDrawMode(true); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: isZoneDrawMode ? 'var(--primary)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                            <PenTool size={14} /> Draw
                          </button>
                        </div>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); setNewZoneGeometry('[]'); }} style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--error)' }}>Clear Rects</button>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); zoomIn(); }} style={{ padding: '4px 8px', fontSize: '16px' }}>+</button>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); zoomOut(); }} style={{ padding: '4px 8px', fontSize: '16px' }}>-</button>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); resetTransform(); }} style={{ padding: '4px 8px', fontSize: '12px' }}>Reset</button>
                      </div>
                    </div>
                    
                    <div style={{ position: 'relative', width: '100%', height: '300px', minHeight: '200px', maxHeight: '800px', resize: 'vertical', background: '#0a0d14', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          <img src="/src/assets/facility_map.png" alt="Facility Map" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.5, pointerEvents: 'none' }} />
                          <svg
                            viewBox="0 0 1000 1000"
                            preserveAspectRatio="xMidYMid meet"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isZoneDrawMode ? 'crosshair' : (isDrawingZone ? 'grabbing' : 'grab') }}
                            onMouseDown={(e) => {
                              if (!isZoneDrawMode) return;
                              const svg = e.currentTarget;
                              const pt = svg.createSVGPoint();
                              pt.x = e.clientX; pt.y = e.clientY;
                              const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                              setIsDrawingZone(true);
                              setDrawingStart({ x: cursorPt.x, y: cursorPt.y });
                              setDrawingCurrent({ x: cursorPt.x, y: cursorPt.y });
                            }}
                            onMouseMove={(e) => {
                              if (!isDrawingZone) return;
                              const svg = e.currentTarget;
                              const pt = svg.createSVGPoint();
                              pt.x = e.clientX; pt.y = e.clientY;
                              const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                              setDrawingCurrent({ x: cursorPt.x, y: cursorPt.y });
                            }}
                            onMouseUp={() => {
                              if (!isDrawingZone || !drawingStart || !drawingCurrent) return;
                              setIsDrawingZone(false);
                              const x = Math.min(drawingStart.x, drawingCurrent.x);
                              const y = Math.min(drawingStart.y, drawingCurrent.y);
                              const w = Math.abs(drawingCurrent.x - drawingStart.x);
                              const h = Math.abs(drawingCurrent.y - drawingStart.y);
                              if (w > 5 && h > 5) {
                                try {
                                  const parsed = JSON.parse(newZoneGeometry || '[]');
                                  const shapes = Array.isArray(parsed) ? parsed : (parsed.type ? [parsed] : []);
                                  shapes.push({ x, y, w, h });
                                  setNewZoneGeometry(JSON.stringify(shapes));
                                } catch (err) {}
                              }
                              setDrawingStart(null);
                              setDrawingCurrent(null);
                            }}
                            onMouseLeave={() => { setIsDrawingZone(false); setDrawingStart(null); setDrawingCurrent(null); }}
                          >
                            {(() => {
                               try {
                                 const parsed = JSON.parse(newZoneGeometry || '[]');
                                 const shapes = Array.isArray(parsed) ? parsed : (parsed.type ? [parsed] : []);
                                 return shapes.map((shape: any, i: number) => {
                                   if (shape.type === 'polygon' && shape.points) {
                                     const pts = shape.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                                     return <polygon key={i} points={pts} fill={newZoneColor} fillOpacity="0.4" stroke={newZoneColor} strokeWidth="2" />;
                                   } else if (shape.w !== undefined && shape.h !== undefined) {
                                     return <rect key={i} x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill={newZoneColor} fillOpacity="0.4" stroke={newZoneColor} strokeWidth="2" />;
                                   }
                                   return null;
                                 });
                               } catch (err) { return null; }
                            })()}
                            {(isDrawingZone && drawingStart && drawingCurrent) && (
                              <rect
                                x={Math.min(drawingStart.x, drawingCurrent.x)}
                                y={Math.min(drawingStart.y, drawingCurrent.y)}
                                width={Math.abs(drawingCurrent.x - drawingStart.x)}
                                height={Math.abs(drawingCurrent.y - drawingStart.y)}
                                fill="rgba(255,255,255,0.2)"
                                stroke="white"
                                strokeWidth="2"
                                strokeDasharray="4"
                              />
                            )}
                          </svg>
                        </div>
                      </TransformComponent>
                    </div>
                  </div>
                )}
              </TransformWrapper>
              {!editZoneId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={keepZoneOpen} onChange={e => setKeepZoneOpen(e.target.checked)} />
                  Keep dialog open after creation
                </label>
              )}
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowZoneDialog(false)} className="btn-glass" style={{ width: 'auto' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>{editZoneId ? 'Save Changes' : 'Create Zone'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Dialog */}
      {/* Device Types Manager Dialog */}
      {showDeviceTypesManager && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Manage Device Types</h3>
              <button type="button" className="btn-glass" onClick={() => { setShowDeviceTypesManager(false); setEditingDeviceTypeId(null); }} style={{ padding: '4px' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
              {deviceTypes.map(dt => (
                <div key={dt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                  {editingDeviceTypeId === dt.id ? (
                    <input 
                      type="text" 
                      value={editingDeviceTypeName} 
                      onChange={e => setEditingDeviceTypeName(e.target.value)} 
                      className="login-input" 
                      style={{ margin: 0, padding: '4px 8px', flex: 1, marginRight: '8px' }} 
                    />
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{dt.name}</span>
                  )}
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {editingDeviceTypeId === dt.id ? (
                      <>
                        <button type="button" className="btn-glass" onClick={() => handleUpdateDeviceType(dt.id)} style={{ padding: '4px', color: 'var(--success)' }}><Check size={16} /></button>
                        <button type="button" className="btn-glass" onClick={() => setEditingDeviceTypeId(null)} style={{ padding: '4px' }}><X size={16} /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-glass" onClick={() => { setEditingDeviceTypeId(dt.id); setEditingDeviceTypeName(dt.name); }} style={{ padding: '4px' }}><Edit2 size={16} /></button>
                        <button type="button" className="btn-glass" onClick={() => handleDeleteDeviceType(dt.id, dt.name)} style={{ padding: '4px', color: 'var(--error)' }}><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {deviceTypes.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No device types found.</div>}
            </div>
          </div>
        </div>
      )}

      {showDeviceDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{editDeviceId ? 'Edit Device' : 'Create Device'}</h3>
            </div>
            {deviceError && <div className="alert-error">{deviceError}</div>}
            <form onSubmit={handleDeviceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Device Name
                <input type="text" placeholder="e.g. CAM-01" value={newDeviceName} onChange={e=>setNewDeviceName(e.target.value)} required className="login-input" />
              </label>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Device Type
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!showDeviceTypeInput ? (
                    <>
                      <select value={newDeviceType} onChange={e=>setNewDeviceType(e.target.value)} className="login-input" style={{ flex: 1 }}>
                        {deviceTypes.map(dt => (
                          <option key={dt.id} value={dt.name}>{dt.name}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-glass" onClick={() => setShowDeviceTypeInput(true)} style={{ padding: '0 12px' }}>+</button>
                      <button type="button" className="btn-glass" onClick={() => setShowDeviceTypesManager(true)} style={{ padding: '0 12px' }} title="Manage Device Types"><Settings2 size={16} /></button>
                    </>
                  ) : (
                    <>
                      <input type="text" placeholder="New Type..." value={newDeviceTypeName} onChange={e=>setNewDeviceTypeName(e.target.value)} className="login-input" style={{ flex: 1 }} />
                      <button type="button" className="btn-primary" onClick={handleDeviceTypeSubmit} style={{ padding: '0 12px', width: 'auto' }}>Add</button>
                      <button type="button" className="btn-glass" onClick={() => setShowDeviceTypeInput(false)} style={{ padding: '0 12px' }}>x</button>
                    </>
                  )}
                </div>
              </label>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Zone Assignment
                <select value={newDeviceZone} onChange={e=>setNewDeviceZone(e.target.value)} className="login-input" required>
                  <option value="" disabled>Select Zone</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </label>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Operating Mode
                <select value={newDeviceMode} onChange={e=>setNewDeviceMode(e.target.value)} className="login-input">
                  <option value="AUTO">AUTO (Simulate Network)</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </label>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', flex: 1 }}>
                  Map X Coordinate
                  <input type="number" placeholder="X Coordinate" value={newDeviceX} onChange={e=>setNewDeviceX(e.target.value)} className="login-input" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', flex: 1 }}>
                  Map Y Coordinate
                  <input type="number" placeholder="Y Coordinate" value={newDeviceY} onChange={e=>setNewDeviceY(e.target.value)} className="login-input" />
                </label>
              </div>
              <TransformWrapper initialScale={1} minScale={0.5} maxScale={10} centerOnInit panning={{ disabled: isDeviceDrawMode }}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: 'var(--text)', border: '1px solid var(--primary)', pointerEvents: 'none' }}>
                        Click to place device
                      </div>
                      <div style={{ display: 'flex', gap: '4px', zIndex: 10 }}>
                        <div style={{ display: 'flex', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden', marginRight: '8px' }}>
                          <button type="button" onClick={(e) => { e.preventDefault(); setIsDeviceDrawMode(false); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: !isDeviceDrawMode ? 'var(--primary)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                            <Hand size={14} /> Pan
                          </button>
                          <button type="button" onClick={(e) => { e.preventDefault(); setIsDeviceDrawMode(true); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: isDeviceDrawMode ? 'var(--primary)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                            <PenTool size={14} /> Place
                          </button>
                        </div>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); zoomIn(); }} style={{ padding: '4px 8px', fontSize: '16px' }}>+</button>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); zoomOut(); }} style={{ padding: '4px 8px', fontSize: '16px' }}>-</button>
                        <button type="button" className="btn-glass" onClick={(e) => { e.preventDefault(); resetTransform(); }} style={{ padding: '4px 8px', fontSize: '12px' }}>Reset</button>
                      </div>
                    </div>
                    
                    <div style={{ position: 'relative', width: '100%', height: '250px', minHeight: '200px', maxHeight: '800px', resize: 'vertical', background: '#0a0d14', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          <img src="/src/assets/facility_map.png" alt="Facility Map" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.5, pointerEvents: 'none' }} />
                          <svg
                            viewBox="0 0 1000 1000"
                            preserveAspectRatio="xMidYMid meet"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isDeviceDrawMode ? 'crosshair' : 'grab' }}
                            onClick={(e) => {
                              if (!isDeviceDrawMode) return;
                              const svg = e.currentTarget;
                              const pt = svg.createSVGPoint();
                              pt.x = e.clientX;
                              pt.y = e.clientY;
                              const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                              setNewDeviceX(Math.round(cursorPt.x));
                              setNewDeviceY(Math.round(cursorPt.y));
                            }}
                          >
                            {(newDeviceX !== '' && newDeviceY !== '') && (
                              <g transform={`translate(${newDeviceX}, ${newDeviceY})`}>
                                <circle r="15" fill="var(--primary)" stroke="white" strokeWidth="3" />
                                <circle r="25" fill="none" stroke="var(--primary)" strokeWidth="2" opacity="0.5">
                                  <animate attributeName="r" values="15; 35" dur="1.5s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" values="0.8; 0" dur="1.5s" repeatCount="indefinite" />
                                </circle>
                              </g>
                            )}
                          </svg>
                        </div>
                      </TransformComponent>
                    </div>
                  </div>
                )}
              </TransformWrapper>
              {!editDeviceId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={keepDeviceOpen} onChange={e => setKeepDeviceOpen(e.target.checked)} />
                  Keep dialog open after creation
                </label>
              )}
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowDeviceDialog(false)} className="btn-glass" style={{ width: 'auto' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>{editDeviceId ? 'Save Changes' : 'Create Device'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && deleteTarget && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--error)' }}>Confirm Deletion</h3>
            </div>
            {deleteError && <div className="alert-error" style={{ marginBottom: '1rem' }}>{deleteError}</div>}
            <p>Are you sure you want to delete the {deleteTarget.type} <strong>{deleteTarget.name}</strong>? This action cannot be undone.</p>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowDeleteDialog(false)} className="btn-glass" style={{ width: 'auto' }}>Cancel</button>
              <button type="button" onClick={executeDelete} className="btn-primary" style={{ width: 'auto', background: 'var(--error)', borderColor: 'var(--error)' }}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
