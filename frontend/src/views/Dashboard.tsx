import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import facilityMap from '../assets/facility_map.png';
import { Camera, Radio, Mic, Activity, UserCheck } from 'lucide-react';

interface Incident {
  _id: string;
  type: string;
  severity: string;
  status: string;
  occurred_at: string;
  zone_id: string;
  details: string;
  source_device_id?: string;
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>(['ALL']);
  const [filterDate, setFilterDate] = useState<string>('');
  const [isDateFocused, setIsDateFocused] = useState(false);
  const [filterDeviceType, setFilterDeviceType] = useState<string[]>(['ALL']);
  const [zones, setZones] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const [isSeverityOpen, setIsSeverityOpen] = useState(false);
  const severityRef = useRef<HTMLDivElement>(null);
  const [isDeviceOpen, setIsDeviceOpen] = useState(false);
  const deviceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (severityRef.current && !severityRef.current.contains(e.target as Node)) {
        setIsSeverityOpen(false);
      }
      if (deviceRef.current && !deviceRef.current.contains(e.target as Node)) {
        setIsDeviceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchIncidentsAndZones = async () => {
    let currentError = null;
    try {
      const incRes = await axios.get('http://localhost:8000/api/v1/incidents');
      setIncidents(incRes.data);
    } catch (err: any) {
      console.error("Error fetching incidents", err);
      currentError = err.response?.status || 'Unknown';
      if (err.response && err.response.status === 401) {
        navigate('/login');
        return;
      }
    }
    try {
      const zoneRes = await axios.get('http://localhost:8000/api/v1/dashboard/zones');
      setZones(zoneRes.data);
    } catch (err: any) {
      console.error("Error fetching zones", err);
      currentError = err.response?.status || 'Unknown';
      if (err.response && err.response.status === 401) {
        navigate('/login');
        return;
      }
    }
    try {
      const deviceRes = await axios.get('http://localhost:8000/api/v1/dashboard/devices');
      setDevices(deviceRes.data);
    } catch (err: any) {
      console.error("Error fetching devices", err);
      currentError = err.response?.status || 'Unknown';
    }
    
    if (currentError) {
      setErrorMsg(`Failed to load data (Status ${currentError})`);
    } else {
      setErrorMsg(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIncidentsAndZones();
    const intervalId = setInterval(fetchIncidentsAndZones, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="layout">
      <div className="sidebar" style={{ width: '280px' }}>
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
          Zones Navigation
        </div>
        <ul style={{ listStyle: 'none', padding: '0 var(--spacing-sm)', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {activeZoneId !== null && (
            <li
              onClick={() => setActiveZoneId(null)}
              style={{
                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'rgba(0, 210, 255, 0.1)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '4px'
              }}
            >
              SHOW ALL ZONES
            </li>
          )}
          {zones.map(zone => (
            <li
              key={zone.id}
              onClick={() => setActiveZoneId(zone.id === activeZoneId ? null : zone.id)}
              style={{
                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                display: 'flex', flexDirection: 'column', gap: '4px',
                background: activeZoneId === zone.id ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                borderLeft: activeZoneId === zone.id ? '4px solid var(--primary)' : '4px solid transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <strong>{zone.name}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Level {zone.clearance_level} Clearance</span>
            </li>
          ))}
          {zones.length === 0 && (
            <li style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No zones configured.
            </li>
          )}
        </ul>
      </div>
      <div className="main-content">
        <GlobalHeader />
        {errorMsg && (
          <div style={{ background: 'var(--error)', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
            {errorMsg}
          </div>
        )}
        <div className="split-panel">
          <div className="panel-map" style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0d14'
          }}>
            <img src={facilityMap} alt="Facility Map" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }} />

            <svg
              viewBox="0 0 1000 1000"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none'
              }}
            >
              {zones.map(zone => {
                if (!zone.geometry) return null;
                let parsed = [];
                try { parsed = typeof zone.geometry === 'string' ? JSON.parse(zone.geometry) : zone.geometry; } catch(e) {}
                const shapes = Array.isArray(parsed) ? parsed : (parsed.type ? [parsed] : []);
                if (shapes.length === 0) return null;
                
                const isActive = activeZoneId === zone.id;
                const baseColor = zone.color || '#00d2ff';
                
                return (
                  <g 
                    key={zone.id} 
                    style={{ pointerEvents: 'auto', cursor: 'pointer', transition: 'all 0.3s ease' }} 
                    onClick={() => setActiveZoneId(isActive ? null : zone.id)}
                  >
                    {shapes.map((shape: any, i: number) => {
                      if (shape.type === 'polygon' && shape.points) {
                        const pts = shape.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                        return (
                          <polygon
                            key={i}
                            points={pts}
                            fill={baseColor}
                            fillOpacity={isActive ? "0.4" : "0.15"}
                            stroke={baseColor}
                            strokeWidth={isActive ? "3" : "2"}
                          >
                            <title>{zone.name}</title>
                          </polygon>
                        );
                      } else if (shape.w !== undefined && shape.h !== undefined) {
                        return (
                          <rect
                            key={i}
                            x={shape.x} y={shape.y} width={shape.w} height={shape.h}
                            fill={baseColor}
                            fillOpacity={isActive ? "0.4" : "0.15"}
                            stroke={baseColor}
                            strokeWidth={isActive ? "3" : "2"}
                          >
                            <title>{zone.name}</title>
                          </rect>
                        );
                      }
                      return null;
                    })}
                  </g>
                );
              })}
              
              {/* Devices */}
              {devices.map(dev => {
                if (dev.x == null || dev.y == null) return null;
                const isSelectedZone = activeZoneId === null || dev.zone_id === activeZoneId;
                if (!isSelectedZone) return null;
                
                const t = (dev.device_type || '').toLowerCase();
                let IconComponent = Radio;
                if (t.includes('cctv') || t.includes('cam')) IconComponent = Camera;
                else if (t.includes('pir') || t.includes('motion')) IconComponent = Activity;
                else if (t.includes('mic') || t.includes('audio')) IconComponent = Mic;
                else if (t.includes('card') || t.includes('reader') || t.includes('access')) IconComponent = UserCheck;

                let iconColor = 'var(--error)';
                if (dev.status === 'ONLINE') iconColor = 'var(--success)';
                if (dev.status === 'MAINTENANCE') iconColor = 'var(--warning)';

                return (
                  <g key={dev.id} transform={`translate(${dev.x}, ${dev.y})`} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                    <circle r="14" fill="rgba(0,0,0,0.5)" stroke={iconColor} strokeWidth="2" />
                    <IconComponent size={18} color={iconColor} x={-9} y={-9} />
                    <title>{`${dev.name} (${dev.device_type}) - ${dev.status}`}</title>
                  </g>
                );
              })}
            </svg>



            <style>{`
              @keyframes scan {
                0% { top: 0; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}</style>
          </div>
          <div className="panel-feed">
            {activeZoneId && zones.find(z => z.id === activeZoneId) && (
              <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', background: 'rgba(0, 210, 255, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)' }}>
                  <h3 style={{ margin: 0, color: zones.find(z => z.id === activeZoneId).color || '#00d2ff' }}>
                    Zone Details: {zones.find(z => z.id === activeZoneId).name}
                  </h3>
                </div>
                {(() => {
                  const z = zones.find(z => z.id === activeZoneId);
                  const zDevices = devices.filter(d => d.zone_id === z.id);
                  const onlineCount = zDevices.filter(d => d.status === 'ONLINE').length;
                  const maintenanceCount = zDevices.filter(d => d.operating_mode === 'MAINTENANCE').length;
                  const offlineCount = zDevices.length - onlineCount - maintenanceCount;
                  
                  const total = zDevices.length || 1; // prevent div by zero
                  const onlinePct = (onlineCount / total) * 100;
                  const maintPct = (maintenanceCount / total) * 100;
                  const offPct = (offlineCount / total) * 100;

                  const incidentCount = incidents.filter(inc => inc.zone_id === z.name || inc.zone_id === z.id.toString()).length;
                  
                  return (
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div><strong>Clearance:</strong> Lvl {z.clearance_level}</div>
                        <div><strong>Location:</strong> {z.location || 'N/A'}</div>
                        <div><strong>Area:</strong> {z.covered_area ? `${z.covered_area} sqm` : 'N/A'}</div>
                        <div><strong>Devices:</strong> {zDevices.length}</div>
                      </div>
                      
                      {zDevices.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--success)' }}>Online ({onlineCount})</span>
                            <span style={{ color: 'var(--warning)' }}>Maint ({maintenanceCount})</span>
                            <span style={{ color: 'var(--text-muted)' }}>Offline ({offlineCount})</span>
                          </div>
                          <div style={{ height: '8px', display: 'flex', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                            <div style={{ width: `${onlinePct}%`, background: 'var(--success)' }} />
                            <div style={{ width: `${maintPct}%`, background: 'var(--warning)' }} />
                            <div style={{ width: `${offPct}%`, background: 'var(--text-muted)' }} />
                          </div>
                        </div>
                      )}

                      <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                        <strong>Description:</strong> {z.description || 'No description provided.'}
                      </div>
                      {incidentCount > 0 && (
                        <div style={{ marginTop: '12px', color: 'var(--error)' }}>
                          <strong>Active Incidents:</strong> {incidentCount}
                        </div>
                      )}
                      
                      <button className="btn-primary" onClick={() => navigate(`/zones/${z.id}`)} style={{ width: '100%', marginTop: '16px' }}>
                        View Full Zone Details
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>
                Live Event Feed {activeZoneId && zones.find(z => z.id === activeZoneId) ? ` - ${zones.find(z => z.id === activeZoneId).name}` : ''}
              </h3>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }} ref={severityRef}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Filter Severity</div>
                <div 
                  style={{
                    background: '#1a1d24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    minHeight: '38px',
                    boxSizing: 'border-box'
                  }}
                  onClick={() => setIsSeverityOpen(!isSeverityOpen)}
                >
                  {activeFilters.length === 0 || (activeFilters.length === 1 && activeFilters[0] === 'ALL') ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Choose options</span>
                  ) : (
                    ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].map(f => {
                      if (!activeFilters.includes(f) && !activeFilters.includes('ALL')) return null;
                      return (
                        <span key={f} style={{ 
                          background: 'rgba(0, 210, 255, 0.1)', 
                          border: '1px solid rgba(0, 210, 255, 0.3)',
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--text)'
                        }}>
                          {f === 'INFO' ? 'NORMAL EVENTS' : f}
                          <span 
                            style={{ cursor: 'pointer', opacity: 0.7 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              let newF = activeFilters.includes('ALL') ? ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].filter(x => x !== f) : activeFilters.filter(x => x !== f);
                              if (newF.length === 0) newF = ['ALL'];
                              setActiveFilters(newF);
                            }}
                          >×</span>
                        </span>
                      )
                    })
                  )}
                  <div style={{ marginLeft: 'auto', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '10px' }}>▼</div>
                </div>

                {isSeverityOpen && (
                  <div style={{
                    position: 'absolute',
                    zIndex: 100,
                    background: '#1a1d24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    marginTop: '4px',
                    width: '100%',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
                  }}>
                    {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].map(f => {
                      const isChecked = activeFilters.includes('ALL') || activeFilters.includes(f);
                      return (
                        <div 
                          key={f}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            fontSize: '13px',
                            color: 'var(--text)'
                          }}
                          onClick={() => {
                            if (f === 'ALL') setActiveFilters(['ALL']);
                            else {
                              let newF = activeFilters.includes('ALL') ? [] : [...activeFilters];
                              if (newF.includes(f)) newF = newF.filter(x => x !== f);
                              else newF.push(f);
                              if (newF.length === 0) newF = ['ALL'];
                              setActiveFilters(newF);
                            }
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                          <span>{f === 'ALL' ? 'Select all' : f === 'INFO' ? 'NORMAL EVENTS (INFO)' : f}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }} ref={deviceRef}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Device Source</div>
                <div 
                  style={{
                    background: '#1a1d24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    minHeight: '38px',
                    boxSizing: 'border-box'
                  }}
                  onClick={() => setIsDeviceOpen(!isDeviceOpen)}
                >
                  {filterDeviceType.length === 0 || (filterDeviceType.length === 1 && filterDeviceType[0] === 'ALL') ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Choose options</span>
                  ) : (
                    ['CCTV', 'PIR', 'MIC', 'CARD'].map(f => {
                      if (!filterDeviceType.includes(f) && !filterDeviceType.includes('ALL')) return null;
                      const label = f === 'CCTV' ? 'Camera / CCTV' : f === 'PIR' ? 'Motion / PIR' : f === 'MIC' ? 'Audio / Mic' : 'Access Reader';
                      return (
                        <span key={f} style={{ 
                          background: 'rgba(0, 210, 255, 0.1)', 
                          border: '1px solid rgba(0, 210, 255, 0.3)',
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--text)'
                        }}>
                          {label}
                          <span 
                            style={{ cursor: 'pointer', opacity: 0.7 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              let newF = filterDeviceType.includes('ALL') ? ['CCTV', 'PIR', 'MIC', 'CARD'].filter(x => x !== f) : filterDeviceType.filter(x => x !== f);
                              if (newF.length === 0) newF = ['ALL'];
                              setFilterDeviceType(newF);
                            }}
                          >×</span>
                        </span>
                      )
                    })
                  )}
                  <div style={{ marginLeft: 'auto', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '10px' }}>▼</div>
                </div>

                {isDeviceOpen && (
                  <div style={{
                    position: 'absolute',
                    zIndex: 100,
                    background: '#1a1d24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    marginTop: '4px',
                    width: '100%',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
                  }}>
                    {['ALL', 'CCTV', 'PIR', 'MIC', 'CARD'].map(f => {
                      const isChecked = filterDeviceType.includes('ALL') || filterDeviceType.includes(f);
                      const label = f === 'ALL' ? 'Select all' : f === 'CCTV' ? 'Camera / CCTV' : f === 'PIR' ? 'Motion / PIR' : f === 'MIC' ? 'Audio / Mic' : 'Access Reader';
                      return (
                        <div 
                          key={f}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            fontSize: '13px',
                            color: 'var(--text)'
                          }}
                          onClick={() => {
                            if (f === 'ALL') setFilterDeviceType(['ALL']);
                            else {
                              let newF = filterDeviceType.includes('ALL') ? [] : [...filterDeviceType];
                              if (newF.includes(f)) newF = newF.filter(x => x !== f);
                              else newF.push(f);
                              if (newF.length === 0) newF = ['ALL'];
                              setFilterDeviceType(newF);
                            }
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                          <span>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ flex: '0 0 130px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Date</div>
                <input 
                  type={isDateFocused || !filterDate ? "date" : "text"}
                  value={(isDateFocused || !filterDate) ? filterDate : filterDate.split('-').reverse().join('.')}
                  onFocus={() => setIsDateFocused(true)}
                  onBlur={() => setIsDateFocused(false)}
                  onChange={(e) => {
                    if (e.target.type === 'date') setFilterDate(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    background: '#1a1d24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text)',
                    height: '38px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading incidents...</div>
            ) : (() => {
              const activeZone = activeZoneId ? zones.find(z => z.id === activeZoneId) : null;
              const filteredIncidents = activeZone
                ? incidents.filter(inc => inc.zone_id === activeZone.name || inc.zone_id === activeZone.id.toString())
                : incidents;

              const fullyFiltered = filteredIncidents.filter(inc => {
                const passSev = activeFilters.includes('ALL') || activeFilters.includes(inc.severity);
                
                let passDate = true;
                if (filterDate) {
                  const localDateObj = new Date(inc.occurred_at + (inc.occurred_at.endsWith('Z') ? '' : 'Z'));
                  const dString = `${localDateObj.getFullYear()}-${String(localDateObj.getMonth()+1).padStart(2,'0')}-${String(localDateObj.getDate()).padStart(2,'0')}`;
                  passDate = (dString === filterDate);
                }
                
                let passDevice = true;
                if (!filterDeviceType.includes('ALL')) {
                  const src = (inc.source_device_id || '').toLowerCase();
                  
                  let matchesOne = false;
                  if (filterDeviceType.includes('CCTV') && (src.includes('cam') || src.includes('cctv') || inc.type.includes('TAILGATING') || inc.type.includes('LOITER'))) matchesOne = true;
                  if (filterDeviceType.includes('PIR') && (src.includes('pir') || src.includes('motion') || inc.type.includes('MOVEMENT'))) matchesOne = true;
                  if (filterDeviceType.includes('MIC') && (src.includes('mic') || src.includes('audio') || inc.type.includes('NOISE'))) matchesOne = true;
                  if (filterDeviceType.includes('CARD') && (inc.type.includes('ACCESS') || inc.type.includes('BIOMETRIC') || src.includes('reader') || src.includes('card'))) matchesOne = true;
                  
                  passDevice = matchesOne;
                }
                
                return passSev && passDate && passDevice;
              });

              if (fullyFiltered.length === 0) {
                return <div style={{ color: 'var(--success)' }}>All clear. No active events matching filters.</div>;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {fullyFiltered.map((incident) => (
                    <div key={incident._id} style={{
                      background: 'var(--surface)',
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `4px solid ${incident.severity === 'CRITICAL' ? 'var(--error)' : incident.severity === 'HIGH' ? 'var(--error)' : incident.severity === 'INFO' ? '#00ff00' : 'var(--warning)'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                        <strong>{incident.type.replace(/_/g, ' ')}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {(() => {
                            const d = new Date(incident.occurred_at + (incident.occurred_at.endsWith('Z') ? '' : 'Z'));
                            return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                          })()}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)' }}>
                        Zone: {incident.zone_id || 'Unknown'} {incident.source_device_id && <span style={{ marginLeft: '8px', color: 'var(--primary)' }}>| Source: {incident.source_device_id}</span>}
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {incident.details}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
