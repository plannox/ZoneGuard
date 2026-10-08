import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import GlobalHeader from '../components/GlobalHeader';
import { ChevronLeft, Map, Activity, Camera, Radio, Mic, UserCheck } from 'lucide-react';
import { getAuthToken } from '../core/auth';

const getDeviceIcon = (type: string, size: number = 24, color: string = 'var(--text-muted)') => {
  switch (type.toUpperCase()) {
    case 'CCTV': return <Camera size={size} color={color} />;
    case 'PIR': return <Activity size={size} color={color} />;
    case 'RFID': return <Radio size={size} color={color} />;
    case 'BIOMETRIC': return <UserCheck size={size} color={color} />;
    case 'MANTRAP': return <Map size={size} color={color} />;
    case 'AUDIO': return <Mic size={size} color={color} />;
    default: return <Radio size={size} color={color} />;
  }
};

export default function ZoneDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [zone, setZone] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const auth: any = getAuthToken();
        if (!auth) return;
        const conf = { headers: { Authorization: `Bearer ${auth?.token}` } };
        
        const [zoneRes, devRes, incRes] = await Promise.all([
          axios.get(`http://localhost:8000/api/v1/dashboard/zones`, conf),
          axios.get('http://localhost:8000/api/v1/dashboard/devices', conf),
          axios.get('http://localhost:8000/api/v1/incidents', conf)
        ]);

        const currentZone = zoneRes.data.find((z: any) => z.id.toString() === id);
        setZone(currentZone);
        
        if (currentZone) {
          setDevices(devRes.data.filter((d: any) => d.zone_id === currentZone.id));
          setIncidents(incRes.data.filter((i: any) => i.zone_id === currentZone.name || i.zone_id === currentZone.id.toString()));
        }
        setErrorMsg(null);
      } catch (err: any) {
        console.error('Failed to fetch zone details:', err);
        setErrorMsg(`Failed to load data (Status ${err.response?.status || 'Unknown'})`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading zone details...</div>;
  if (!zone) return <div style={{ padding: '2rem', color: 'var(--error)' }}>Zone not found</div>;

  const onlineCount = devices.filter(d => d.status === 'ONLINE').length;
  const maintenanceCount = devices.filter(d => d.operating_mode === 'MAINTENANCE').length;
  const offlineCount = devices.length - onlineCount - maintenanceCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-main)' }}>
      <GlobalHeader />
      
      {errorMsg && (
        <div style={{ background: 'var(--error)', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
          {errorMsg}
        </div>
      )}
      
      <div style={{ flex: 1, padding: 'var(--spacing-lg)', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button className="btn-glass" onClick={() => navigate(-1)} style={{ padding: '8px' }}>
              <ChevronLeft size={20} />
            </button>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: zone.color || '#00d2ff' }} />
              {zone.name} Details
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--spacing-lg)' }}>
            
            {/* Left Column: Devices List & Overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              
              <div className="panel" style={{ padding: 'var(--spacing-md)' }}>
                <h3 style={{ marginTop: 0 }}>Zone Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: 'var(--text-muted)' }}>
                  <div><strong>Clearance Level:</strong> Level {zone.clearance_level}</div>
                  <div><strong>Location:</strong> {zone.location || 'N/A'}</div>
                  <div><strong>Covered Area:</strong> {zone.covered_area ? `${zone.covered_area} sqm` : 'N/A'}</div>
                  <div><strong>Total Devices:</strong> {devices.length}</div>
                </div>
                {zone.description && (
                  <div style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                    <strong>Description:</strong><br/>
                    {zone.description}
                  </div>
                )}
              </div>

              <div className="panel" style={{ padding: 'var(--spacing-md)' }}>
                <h3 style={{ marginTop: 0 }}>Devices in Zone</h3>
                {devices.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No devices assigned to this zone.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                    {devices.map(d => {
                      let statusColor = 'var(--text-muted)';
                      if (d.status === 'ONLINE') statusColor = 'var(--success)';
                      else if (d.operating_mode === 'MAINTENANCE') statusColor = 'var(--warning)';
                      else if (d.status === 'INCIDENT') statusColor = 'var(--error)';
                      
                      return (
                        <div key={d.id} style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: `1px solid ${statusColor}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {getDeviceIcon(d.device_type, 24, statusColor)}
                          <div>
                            <div style={{ fontWeight: 600 }}>{d.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.device_type} &bull; {d.status}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Analytics & Incidents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              
              <div className="panel" style={{ padding: 'var(--spacing-md)' }}>
                <h3 style={{ marginTop: 0 }}>Device Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                    <span>Online</span>
                    <strong>{onlineCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                    <span>Maintenance</span>
                    <strong>{maintenanceCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Offline</span>
                    <strong>{offlineCount}</strong>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ padding: 'var(--spacing-md)' }}>
                <h3 style={{ marginTop: 0 }}>Recent Incidents</h3>
                {incidents.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No incidents recorded for this zone.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {incidents.slice(0, 5).map(inc => {
                      const occurred = new Date(inc.occurred_at + (String(inc.occurred_at).endsWith('Z') ? '' : 'Z'));
                      return (
                        <div key={inc._id || inc.incident_id} style={{ padding: '8px', background: 'rgba(255, 71, 87, 0.1)', borderLeft: '3px solid var(--error)', borderRadius: '4px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isNaN(occurred.getTime()) ? '-' : occurred.toLocaleString()}</div>
                          <div style={{ fontWeight: 500 }}>{String(inc.type || '').replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{inc.details}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
