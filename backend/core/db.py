import sqlite3
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient

from core.config import SQLITE_DB_PATH

# Config DB (SQLite) - Configuration, RBAC, Users, Zones
# SQLITE_DB_PATH is now imported from core.config

# Telemetry DB (MongoDB) - Events, Telemetry, Audits
MONGO_URI = "mongodb://localhost:27017"
MONGO_DB_NAME = "zoneguard_telemetry"

_mongo_client: Optional[AsyncIOMotorClient] = None

def get_sqlite_conn() -> sqlite3.Connection:
    """Get a connection to the SQLite config database."""
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def set_password(cursor, user_id: int, new_hash: str, forced: bool = False):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE users SET password_hash = ?, last_password_change = ?, must_change_password = ?, failed_login_attempts = 0 WHERE id = ?", (new_hash, now, int(forced), user_id))
    cursor.execute("INSERT INTO password_history (user_id, password_hash, created_at) VALUES (?, ?, ?)", (user_id, new_hash, now))

def init_sqlite_db():
    """Initialise SQLite database schema with migrations."""
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    # Create Roles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            permissions TEXT
        )
    ''')

    # Add permissions to existing roles if missing
    try:
        cursor.execute('ALTER TABLE roles ADD COLUMN permissions TEXT')
    except sqlite3.OperationalError:
        pass

    # Seed Roles
    roles = [
        ('Administrator', 'Full application administration'),
        ('Security Manager', 'Manage zones, security regimes, anomaly detectors'),
        ('User Manager', 'Manage permitted ordinary user-account operations'),
        ('System / Server Manager', 'Manage permitted application/server operational configuration'),
        ('Operator', 'Monitor incidents, inspect evidence and affected zones'),
        ('Supervisor / Operations Manager', 'Investigate, classify, acknowledge, and resolve incidents'),
        ('Read-Only Viewer / Auditor', 'Read-only access to authorized operational/audit information'),
        ('Device Agent', 'System account for event ingestion and telemetry')
    ]
    for r in roles:
        cursor.execute('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)', r)

    import json
    role_permissions = {
        'Administrator': ["dashboard", "system_settings", "device_management", "user_management", "role_management", "audit_trails", "export_csv", "zone_management", "security_rules", "event_ingestion"],
        'Security Manager': ["zone_management", "security_rules", "device_management"],
        'User Manager': ["user_management"],
        'System / Server Manager': ["system_settings", "device_management"],
        'Operator': ["dashboard", "audit_trails"],
        'Supervisor / Operations Manager': ["dashboard", "audit_trails", "incident_management"],
        'Read-Only Viewer / Auditor': ["dashboard", "audit_trails"],
        'Device Agent': ["event_ingestion"]
    }
    for role_name, perms in role_permissions.items():
        perms_json = json.dumps(perms)
        cursor.execute("UPDATE roles SET permissions = ? WHERE name = ? AND permissions IS NULL", (perms_json, role_name))

    # Upgrade of an existing database: the event-ingestion permission is new.
    cursor.execute("UPDATE roles SET permissions = ? WHERE name = 'Device Agent' AND (permissions IS NULL OR permissions = '[]')",
                   (json.dumps(role_permissions['Device Agent']),))
    cursor.execute("SELECT permissions FROM roles WHERE name = 'Administrator'")
    admin_row = cursor.fetchone()
    if admin_row and admin_row[0]:
        admin_perms = json.loads(admin_row[0])
        if 'event_ingestion' not in admin_perms:
            admin_perms.append('event_ingestion')
            cursor.execute("UPDATE roles SET permissions = ? WHERE name = 'Administrator'", (json.dumps(admin_perms),))

    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            role_id INTEGER REFERENCES roles(id),
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            phone TEXT,
            title TEXT,
            address_line1 TEXT,
            address_line2 TEXT,
            city TEXT,
            state TEXT,
            postal_code TEXT,
            country TEXT,
            locked BOOLEAN DEFAULT 0,
            must_change_password BOOLEAN DEFAULT 1,
            last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            failed_login_attempts INTEGER DEFAULT 0
        )
    ''')

    # Add role_id to existing users if they don't have it
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)')
    except sqlite3.OperationalError:
        pass # Column already exists
        
    # Add failed_login_attempts if missing
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass

    cursor.execute('UPDATE users SET role_id = (SELECT id FROM roles WHERE roles.name = users.role) WHERE role_id IS NULL')

    # Create Password History table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS password_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Create System Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Create Zones table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS zones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            clearance_level INTEGER NOT NULL,
            description TEXT
        )
    ''')
    
    # Add new zone fields if missing
    try:
        cursor.execute("ALTER TABLE zones ADD COLUMN color TEXT DEFAULT '#00d2ff'")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE zones ADD COLUMN location TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE zones ADD COLUMN covered_area REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE zones ADD COLUMN geometry TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    
    # Create Device Types table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    ''')
    
    # Seed default device types if missing
    cursor.execute('SELECT COUNT(*) FROM device_types')
    if cursor.fetchone()[0] == 0:
        default_types = ['CCTV', 'BIOMETRIC', 'PIR', 'MANTRAP', 'RFID']
        for dtype in default_types:
            cursor.execute('INSERT INTO device_types (name) VALUES (?)', (dtype,))
    
    # Create Devices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id INTEGER REFERENCES zones(id),
            name TEXT NOT NULL,
            device_type TEXT NOT NULL,
            status TEXT DEFAULT 'ONLINE',
            operating_mode TEXT DEFAULT 'AUTO',
            x INTEGER,
            y INTEGER
        )
    ''')
    
    # Add operating_mode if missing
    try:
        cursor.execute("ALTER TABLE devices ADD COLUMN operating_mode TEXT DEFAULT 'AUTO'")
    except sqlite3.OperationalError:
        pass

    
    # Seed default admin if missing
    cursor.execute('SELECT COUNT(*) FROM users WHERE username = ?', ('admin',))
    if cursor.fetchone()[0] == 0:
        import secrets
        import string
        from core.auth import hash_password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
        # Generate 16 char secure password
        secure_temp_pwd = ''.join(secrets.choice(alphabet) for i in range(16))
        # Ensure it meets complexity
        secure_temp_pwd = "A1!" + secure_temp_pwd
        
        default_hash = hash_password(secure_temp_pwd)
        cursor.execute("SELECT id FROM roles WHERE name = 'Administrator'")
        admin_role_id = cursor.fetchone()[0]
        cursor.execute('''
            INSERT INTO users (username, password_hash, role, role_id, must_change_password)
            VALUES (?, ?, ?, ?, ?)
        ''', ('admin', default_hash, 'Administrator', admin_role_id, 1))
        # Add to history
        cursor.execute("SELECT id FROM users WHERE username = ?", ('admin',))
        user_id = cursor.fetchone()[0]
        cursor.execute("INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)", (user_id, default_hash))
        
        print(f"\\n!!! INITIAL ADMIN PASSWORD GENERATED: {secure_temp_pwd} !!!")
        print("Please log in with username 'admin' and change this password immediately.\\n")

    # Seed default simulator_svc if missing (service account of the event simulator; its default
    # password is replaced with a random one by the installer, see tools/prepare_database.py)
    cursor.execute('SELECT COUNT(*) FROM users WHERE username = ?', ('simulator_svc',))
    if cursor.fetchone()[0] == 0:
        from core.auth import hash_password
        sim_hash = hash_password("Sim!Password123")
        cursor.execute("SELECT id FROM roles WHERE name = 'Device Agent'")
        dev_role_id = cursor.fetchone()[0]
        cursor.execute('''
            INSERT INTO users (username, password_hash, role, role_id, must_change_password)
            VALUES (?, ?, ?, ?, ?)
        ''', ('simulator_svc', sim_hash, 'Device Agent', dev_role_id, 0))

    # Seed default system settings
    cursor.execute('SELECT COUNT(*) FROM system_settings')
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_expiration_months', '6'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_expiration_enabled', 'true'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_min_length', '12'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_require_upper', 'true'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_require_lower', 'true'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_require_number', 'true'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_require_special', 'true'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_reveal_interval', '5'))
        cursor.execute("INSERT INTO system_settings (key, value) VALUES (?, ?)", ('pwd_reveal_toggle_only', 'false'))

    # Hours of incident history shown in the live feed (display window only; incidents stay stored).
    # INSERT OR IGNORE so existing databases get the key without touching their other settings.
    cursor.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)", ('feed_retention_hours', '48'))

    # Create Clearance Rules table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clearance_rules (
            level INTEGER PRIMARY KEY,
            biometric_threshold REAL NOT NULL,
            max_dwell_time INTEGER NOT NULL,
            tailgating_severity TEXT NOT NULL
        )
    ''')
    
    cursor.execute('SELECT COUNT(*) FROM clearance_rules')
    if cursor.fetchone()[0] == 0:
        default_rules = [
            (1, 0.85, 600, 'WARNING'),
            (2, 0.90, 300, 'HIGH'),
            (3, 0.95, 120, 'CRITICAL'),
            (4, 0.98, 60, 'CRITICAL')
        ]
        for rule in default_rules:
            cursor.execute('INSERT INTO clearance_rules (level, biometric_threshold, max_dwell_time, tailgating_severity) VALUES (?, ?, ?, ?)', rule)
    
    conn.commit()
    conn.close()

def get_mongo_db():
    """Get the MongoDB telemetry database instance."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(MONGO_URI)
    return _mongo_client[MONGO_DB_NAME]

def init_dbs():
    """Initialise all database connections and schemas."""
    init_sqlite_db()
    # MongoDB creates collections dynamically, but we can set up indexes here if needed

def get_clearance_rules():
    """Fetch current clearance rules from the database."""
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM clearance_rules ORDER BY level ASC')
    rules = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rules

def update_clearance_rule(level_id: int, new_threshold: float, new_dwell_time: int, new_severity: str):
    """Update a specific clearance rule."""
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE clearance_rules 
        SET biometric_threshold = ?, max_dwell_time = ?, tailgating_severity = ?
        WHERE level = ?
    ''', (new_threshold, new_dwell_time, new_severity, level_id))
    conn.commit()
    conn.close()
