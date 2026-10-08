# Dynamic Facility Zones & Interactive Security Map — Implementation Specification

## 1. Purpose

Implement the facility security dashboard as a **fully dynamic, data-driven zone system**.

The supplied dashboard image is a **visual reference only**. It must not be treated as the application's actual interactive map, and the application must not depend on hardcoded zones or hardcoded coordinates.

The new application must support:

- multiple facilities;
- multiple zones per facility;
- clickable zones;
- zone selection from side navigation;
- zone selection directly from the map;
- an overview showing all zones;
- an individual zone dashboard showing only the selected zone;
- hierarchical zones/areas where required;
- dynamically positioned sensors, cameras, access readers and alarms;
- zone status visualization;
- responsive map scaling;
- future administration/editing of zones and device positions.

The architecture must be designed so that adding a new zone does **not** require changing frontend source code.

---

# 2. Core Concept

The application must separate:

1. **Map/background**
2. **Zone geometry**
3. **Devices**
4. **Zone state**
5. **Navigation**
6. **Dashboard data**

The map should consist conceptually of:

```text
MAP
 ├── Background / floor plan
 │
 └── Dynamic SVG layer
      ├── Zone polygons
      ├── Zone labels
      ├── Sensors
      ├── Cameras
      ├── Access readers
      ├── Alarm indicators
      └── Other map objects
```

The floor-plan image is only the visual/background layer.

Interactive zones and devices must be rendered independently.

---

# 3. Do NOT Hardcode Zones

Do not implement:

```javascript
if (zone === "alpha") {
    ...
}
```

Do not implement:

```javascript
const zones = [
    { name: "Zone Alpha", x: 100, y: 200 }
];
```

Do not hardcode polygon coordinates inside application source code.

Do not create separate frontend components such as:

```text
ZoneAlpha.vue
ZoneBeta.vue
ZoneGamma.vue
```

unless there is a genuine zone-specific business requirement.

Instead:

```text
Database
    ↓
API
    ↓
Zone DTO
    ↓
Generic Zone component
    ↓
SVG geometry
```

A new zone must be created through data/configuration and immediately become available to the application.

---

# 4. Zone Hierarchy

The data model should support hierarchical locations.

Recommended structure:

```text
Facility
│
├── Zone Alpha
│   │
│   ├── Sector 1
│   │   ├── R&D Lab A
│   │   ├── Server Hall
│   │   └── Control Room
│   │
│   └── Sector 2
│       ├── R&D Lab B
│       └── Archive
│
├── Zone Beta
│
└── Zone Gamma
```

A zone should therefore support:

```text
ParentZoneId
```

or an equivalent hierarchical structure.

`ParentZoneId = NULL` means the zone is a top-level zone.

This allows the application to support both:

```text
Facility → Zone
```

and:

```text
Facility → Zone → Sector → Area → Room
```

without redesigning the architecture later.

---

# 5. Database Model

The exact database engine may differ according to the project technology, but the logical model should contain the following entities.

## 5.1 Facility

```text
Facility
-------------------------
Id
Name
Code
Description
IsActive
CreatedAt
UpdatedAt
```

---

## 5.2 Map

A facility may contain one or more maps/floor plans.

```text
FacilityMap
-------------------------
Id
FacilityId
Name
Description
ImagePath
SvgPath
Width
Height
Version
IsActive
CreatedAt
UpdatedAt
```

Recommended fields:

- `ImagePath` — optional raster background;
- `SvgPath` — optional vector background;
- `Width`;
- `Height`;
- `Version`.

The map must have a stable coordinate system.

Example:

```text
viewBox = 0 0 1000 800
```

All geometry and device coordinates should use this coordinate system.

---

# 6. Zone Entity

```text
Zone
-------------------------
Id
FacilityId
MapId
ParentZoneId
Name
Code
Description
DisplayOrder
Status
Color
IsActive
CreatedAt
UpdatedAt
```

Important:

### `FacilityId`

Identifies which facility owns the zone.

### `MapId`

Identifies the map on which the zone is displayed.

### `ParentZoneId`

Supports hierarchical zones.

### `DisplayOrder`

Controls navigation order without relying on database IDs.

### `Status`

Use a controlled enum/reference rather than arbitrary strings.

Recommended initial statuses:

```text
Normal
Warning
Critical
Offline
Locked
Maintenance
```

The exact names can be adapted to the project's domain.

---

# 7. Zone Geometry

Zone geometry must be stored separately from the zone itself.

Recommended:

```text
ZoneGeometry
-------------------------
Id
ZoneId
GeometryType
GeometryData
Version
CreatedAt
UpdatedAt
```

`GeometryType` should support at least:

```text
Polygon
Rectangle
Circle
```

The preferred representation for arbitrary zones is `Polygon`.

Example:

```json
{
  "type": "polygon",
  "points": [
    { "x": 492, "y": 250 },
    { "x": 785, "y": 250 },
    { "x": 785, "y": 510 },
    { "x": 492, "y": 510 }
  ]
}
```

The backend should validate the geometry before saving it.

---

# 8. Coordinate System

Use a normalized map coordinate system.

The preferred implementation is an SVG `viewBox`.

Example:

```html
<svg viewBox="0 0 1000 800">
```

All objects use coordinates relative to that coordinate system.

Do not store browser pixels such as:

```text
left: 438px
top: 211px
```

because the map must remain usable at different screen sizes.

Prefer:

```text
x = 438
y = 211
```

inside the map's coordinate system.

For point devices, coordinates should be relative to the same map coordinate system.

---

# 9. SVG Rendering

Use SVG as the interactive map layer.

Conceptually:

```html
<svg viewBox="0 0 1000 800">

    <image href="/maps/facility-alpha.png" />

    <g class="zones">

        <polygon
            data-zone-id="1"
            points="..."
        />

        <polygon
            data-zone-id="2"
            points="..."
        />

    </g>

    <g class="devices">
        ...
    </g>

</svg>
```

The application should generate the SVG objects dynamically from API data.

---

# 10. Zone Interaction

Every zone must support:

### Click

Clicking a zone activates it.

```text
User clicks Zone Alpha
        ↓
activeZoneId = Alpha
        ↓
navigation updates
        ↓
map updates
        ↓
dashboard updates
```

### Hover

Hover may provide additional information, but hover must never be the only way to access information.

### Keyboard

Interactive zones should be accessible through keyboard navigation where practical.

### Touch

The interaction must work on touch devices.

---

# 11. Active Zone

Maintain a single application state value:

```text
activeZoneId
```

or equivalent application state.

Example:

```javascript
activeZoneId = 4;
```

The selected zone must be visually distinguishable.

Example states:

```text
normal
hover
selected
warning
critical
offline
locked
```

The selected state should not depend exclusively on color.

Use one or more of:

- stronger outline;
- increased opacity;
- label;
- border;
- icon;
- pattern;
- secondary indicator.

This is important for accessibility and users with color-vision deficiencies.

---

# 12. Side Navigation

The application must provide a zone navigation panel.

Example:

```text
FACILITY
────────────────────

ALL ZONES

ZONES
────────────────────

▣ Zone Alpha       ⚠ 3
▣ Zone Beta
▣ Zone Gamma       ⚠ 1
▣ Zone Delta

────────────────────

SYSTEM

Cameras
Sensors
Access
Alarms
```

The navigation must be generated dynamically from the zone API.

Do not hardcode zone names.

Selecting a zone in the sidebar must perform exactly the same logical action as selecting it on the map.

Both interactions should ultimately call the same method/action, for example:

```text
selectZone(zoneId)
```

---

# 13. Overview Mode

Provide an overview mode where all top-level zones are visible.

Example:

```text
FACILITY OVERVIEW

┌──────────────────────────────────────┐
│                                      │
│    ┌───────────┐     ┌──────────┐   │
│    │ ZONE A    │     │ ZONE B   │   │
│    │           │     │          │   │
│    └───────────┘     └──────────┘   │
│                                      │
│          ┌──────────────┐            │
│          │   ZONE C     │            │
│          └──────────────┘            │
│                                      │
└──────────────────────────────────────┘
```

The overview should provide a quick visual representation of the facility.

Each zone must be clickable.

---

# 14. Individual Zone Mode

When a zone is selected, switch the dashboard context to that zone.

Example:

```text
FACILITY SECURITY DASHBOARD

ZONE ALPHA
────────────────────────────────────

SYSTEM STATUS
ONLINE / SECURE

SENSORS       CAMERAS       ACCESS
   12            18            6

ALARMS
Critical        0
Warning         3

PERSONNEL
12
```

The map should then display the selected zone's detailed map.

The dashboard must not continue displaying unrelated zones as though they were active.

---

# 15. Hierarchical Navigation

If hierarchical zones are implemented, support:

```text
Facility
  ↓
Zone Alpha
  ↓
Sector 1
  ↓
Server Hall
```

The UI should provide breadcrumbs:

```text
Facility / Zone Alpha / Sector 1 / Server Hall
```

Clicking a parent breadcrumb should navigate back to that level.

---

# 16. Device Model

Devices should be separate entities.

At minimum support:

```text
Sensor
Camera
AccessReader
Alarm
```

Each device should reference the location/zone where it belongs.

Example:

```text
Sensor
-------------------------
Id
ZoneId
Name
Type
Status
MapX
MapY
Description
IsActive
CreatedAt
UpdatedAt
```

Equivalent fields should exist for cameras, access readers and other device types.

---

# 17. Device Positioning

Device positions must use the map coordinate system.

Example:

```json
{
  "deviceId": 123,
  "mapX": 612,
  "mapY": 378
}
```

Do not store browser-specific pixel coordinates.

When the SVG scales, device positions must scale automatically.

---

# 18. Device Rendering

Example:

```text
             CAMERA
                ↓
        ┌──────────────┐
        │              │
 SENSOR ●     LAB      ◉ ACCESS
        │              │
        │              │
        └──────────────┘
                ●
              ALARM
```

Each device should be an independent SVG element.

Devices should support:

- click;
- hover;
- status;
- label where appropriate;
- alarm indicator;
- selection;
- navigation to device details.

---

# 19. Zone Status

The zone's visual status should be derived from real application state.

Example:

```text
NORMAL
WARNING
CRITICAL
OFFLINE
LOCKED
MAINTENANCE
```

Example logic:

```text
Critical alarm exists
    ↓
Zone = Critical

No critical alarm
but warning exists
    ↓
Zone = Warning

No alarms
and systems operational
    ↓
Zone = Normal
```

Do not duplicate status manually in several places if it can be derived from underlying device/alarm state.

If status is explicitly stored for business reasons, clearly define which system is authoritative.

---

# 20. Alarm Visualization

The map should make active alarms obvious.

Example:

```text
● Critical
▲ Warning
```

However, do not rely on color alone.

Use:

- icon;
- symbol;
- animation only where justified;
- count;
- accessible label.

Example:

```text
ZONE ALPHA
Warning: 3
Critical: 0
```

Avoid excessive animation. Respect reduced-motion accessibility settings.

---

# 21. Dashboard Statistics

Zone statistics should be dynamically calculated or supplied by the API.

Examples:

```text
Sensors
Cameras
Access Readers
Active Alarms
Critical Alarms
Warnings
Personnel
```

Example API response:

```json
{
  "zoneId": 4,
  "name": "Zone Alpha",
  "status": "Warning",
  "statistics": {
    "sensors": 12,
    "cameras": 18,
    "accessReaders": 6,
    "criticalAlarms": 0,
    "warningAlarms": 3,
    "personnel": 12
  }
}
```

---

# 22. API Design

Provide endpoints equivalent to:

```text
GET /api/facilities
GET /api/facilities/{facilityId}

GET /api/facilities/{facilityId}/maps

GET /api/facilities/{facilityId}/zones
GET /api/zones/{zoneId}

GET /api/zones/{zoneId}/children
GET /api/zones/{zoneId}/devices
GET /api/zones/{zoneId}/statistics

GET /api/maps/{mapId}
GET /api/maps/{mapId}/zones
GET /api/maps/{mapId}/devices
```

The exact route naming should follow the project's API conventions.

---

# 23. Recommended Zone DTO

A zone overview DTO could look like:

```json
{
  "id": 1,
  "facilityId": 1,
  "mapId": 1,
  "parentZoneId": null,
  "name": "Zone Alpha",
  "code": "ALPHA",
  "status": "Warning",
  "displayOrder": 1,
  "geometry": {
    "type": "polygon",
    "points": [
      { "x": 100, "y": 100 },
      { "x": 400, "y": 100 },
      { "x": 400, "y": 300 },
      { "x": 100, "y": 300 }
    ]
  },
  "statistics": {
    "sensors": 12,
    "cameras": 18,
    "accessReaders": 6,
    "criticalAlarms": 0,
    "warningAlarms": 3
  }
}
```

---

# 24. Map DTO

```json
{
  "id": 1,
  "facilityId": 1,
  "name": "Level 4",
  "width": 1000,
  "height": 800,
  "background": "/maps/level-4.png",
  "zones": []
}
```

The frontend should not have to know where the map came from.

---

# 25. Frontend State

At minimum the frontend needs state equivalent to:

```text
selectedFacilityId
activeMapId
activeZoneId
selectedDeviceId
viewMode
```

Where:

```text
viewMode:
    overview
    zone
    area
    device
```

Example:

```text
activeFacility = 1
activeMap = 4
activeZone = 12
viewMode = "zone"
```

---

# 26. Single Zone Selection Function

Map clicks and sidebar clicks must share the same selection logic.

Example:

```javascript
function selectZone(zoneId) {
    activeZoneId = zoneId;
    updateNavigation();
    updateMap();
    updateDashboard();
}
```

Do not duplicate the logic:

```javascript
// BAD
// sidebar has one implementation
// map has another implementation
```

Use one application-level state transition.

---

# 27. URL / Deep Linking

The active zone should preferably be represented in the URL.

Example:

```text
/facility/1
/facility/1/zone/4
/facility/1/zone/4/area/12
```

This provides:

- browser back/forward;
- bookmarks;
- reload persistence;
- direct links to a zone;
- easier troubleshooting.

The exact routing syntax depends on the frontend framework.

---

# 28. Refresh Behavior

Reloading:

```text
/facility/1/zone/4
```

must reopen:

```text
Facility 1
Zone 4
```

The application should not always reset to the facility overview unless that is explicitly intended.

---

# 29. Responsive Behavior

The map must scale while preserving its coordinate system.

SVG should use:

```html
viewBox
```

rather than hardcoded width/height.

The map must remain usable at:

- desktop;
- laptop;
- tablet;
- mobile where applicable.

The sidebar may collapse on smaller screens.

---

# 30. Zoom

Design the map component so zoom can be added.

Recommended controls:

```text
+
−
Reset
Fit
```

Optional:

```text
mouse wheel
pinch zoom
drag/pan
```

Zoom must not modify the underlying stored coordinates.

It only changes the viewport transformation.

---

# 31. Editing / Administration

The architecture should allow a future administrator to:

```text
Create zone
Edit zone
Move zone
Resize zone
Change polygon
Delete/deactivate zone
Change display order
Assign map
Assign parent zone
Move device
Assign device to zone
```

A future map editor should be able to:

1. select a map;
2. draw a polygon;
3. save polygon coordinates;
4. assign the polygon to a zone;
5. place devices;
6. save device coordinates.

Do not implement this by editing application source code.

---

# 32. Map Editor Considerations

When editing a polygon, the application should support:

```text
Add point
Move point
Delete point
Move entire polygon
```

Validate:

- minimum number of points;
- valid coordinates;
- coordinates within the map;
- no invalid/null points.

The editor may eventually support snapping to grid or existing geometry, but this is optional.

---

# 33. Security

Do not trust zone IDs supplied by the frontend.

For every API request:

```text
GET /api/zones/{id}
```

the backend must verify that the authenticated user is authorized to access that facility/zone.

Do not rely on:

```javascript
if (userCanAccessZone)
```

as the only security mechanism.

Authorization must be enforced server-side.

---

# 34. Performance

Do not load every device's complete details when rendering the facility overview.

Use lightweight DTOs.

Overview:

```text
Zone
Status
Alarm count
Basic statistics
Geometry
```

Detailed zone view:

```text
Zone
Geometry
Devices
Statistics
Recent activity
```

Device details:

```text
Full device information
```

This keeps the overview fast.

---

# 35. Real-Time Updates

The architecture should allow real-time status updates later.

Possible technologies:

```text
WebSocket
SignalR
Server-Sent Events
Polling
```

The dashboard should be designed so that a status update can change:

```text
Zone status
Alarm count
Device status
Personnel count
```

without reloading the entire application.

For .NET applications, SignalR is a natural option if it fits the selected stack.

---

# 36. Reference Image

The supplied image is a **design/reference image**.

It demonstrates:

- dark security dashboard;
- facility floor plan;
- zone visualization;
- sensors;
- cameras;
- access readers;
- alarms;
- side panels;
- statistics;
- active zone context.

Do not reproduce its exact textual data as production data.

Do not assume the displayed names, counts, dates, personnel or alarms are real application values.

Use the image to guide the visual language only.

---

# 37. Visual Design Direction

The application should maintain the reference's general visual language:

```text
Dark technical UI
High information density
Thin technical borders
Dark navy/black surfaces
Cyan/blue map elements
Amber warning elements
Red critical alarms
Green operational state
Compact typography
Technical dashboard appearance
```

The visual design should remain readable and functional rather than becoming purely decorative.

---

# 38. Suggested Component Structure

Use generic reusable components.

Example:

```text
FacilityDashboard
│
├── FacilitySidebar
│   ├── FacilitySelector
│   ├── ZoneTree
│   └── SystemNavigation
│
├── DashboardHeader
│
├── FacilityMap
│   ├── MapBackground
│   ├── ZoneLayer
│   │   └── ZonePolygon
│   ├── DeviceLayer
│   │   ├── SensorMarker
│   │   ├── CameraMarker
│   │   ├── AccessReaderMarker
│   │   └── AlarmMarker
│   └── MapControls
│
├── ZoneStatistics
├── AlarmPanel
├── ActivityPanel
└── StatusPanel
```

The names can be adapted to the selected framework.

---

# 39. Important Separation of Concerns

Keep these responsibilities separate:

```text
Database
    stores data

API
    validates authorization
    supplies DTOs
    calculates/returns state

Frontend state
    tracks active selection

Map component
    renders geometry

Zone component
    renders one zone

Dashboard
    renders selected context

Navigation
    changes active context
```

Do not put database/business rules into the SVG component.

Do not put rendering logic into database models.

---

# 40. Acceptance Criteria

The implementation is considered complete only when all of the following work.

## Zone creation

A new zone can be added through data/configuration without modifying frontend source code.

## Zone navigation

Clicking a zone in the sidebar selects it.

## Map navigation

Clicking a zone on the map selects it.

## Shared state

Sidebar and map always show the same active zone.

## Overview

All top-level zones can be displayed simultaneously.

## Individual view

Selecting a zone displays its own dashboard context.

## Hierarchy

Child zones/areas can be represented.

## Geometry

Zones can use arbitrary polygons.

## Responsive scaling

Map geometry remains correct when the map is resized.

## Device positioning

Sensors, cameras, access readers and alarms can be positioned dynamically.

## Status

Zone status changes are reflected visually.

## Security

Users cannot access unauthorized zones merely by changing the URL or zone ID.

## Persistence

Refreshing a zone URL preserves the selected zone.

## Future editing

The data model supports a future graphical map/zone editor.

---

# 41. Example End-to-End Flow

```text
User opens:

/facility/1

        ↓

API loads Facility 1

        ↓

Frontend loads map

        ↓

Frontend loads top-level zones

        ↓

SVG renders:

        Map background
             +
        Zone polygons

        ↓

User clicks:

ZONE ALPHA

        ↓

selectZone(4)

        ↓

URL becomes:

/facility/1/zone/4

        ↓

Frontend loads:

Zone Alpha
Geometry
Statistics
Devices
Alarms
Activity

        ↓

Dashboard changes to:

ZONE ALPHA

        ↓

User clicks Camera 18

        ↓

Camera details are displayed
```

---

# 42. Recommended Initial Implementation Order

Implement in this order.

### Phase 1 — Data model

Create:

```text
Facility
FacilityMap
Zone
ZoneGeometry
```

### Phase 2 — API

Implement:

```text
Facility
Map
Zone
Zone hierarchy
Zone statistics
```

### Phase 3 — Map renderer

Implement:

```text
SVG
Background
Dynamic zone polygons
```

### Phase 4 — Navigation

Implement:

```text
Sidebar
Zone tree
Active zone
URL routing
```

### Phase 5 — Device layer

Implement:

```text
Sensors
Cameras
Access readers
Alarms
```

### Phase 6 — Dashboard

Implement:

```text
Statistics
Alarm panel
Activity
Personnel
Zone health
```

### Phase 7 — Real-time updates

Add:

```text
SignalR/WebSocket/SSE
```

if required.

### Phase 8 — Map editor

Add:

```text
Zone drawing
Polygon editing
Device positioning
```

---

# 43. Critical Architectural Rule

The application must treat the following as **data**, not code:

```text
Facility names
Zone names
Zone hierarchy
Zone geometry
Map assignment
Device positions
Device assignment
Zone status
Display order
```

The frontend should contain the rendering engine, not the facility definition.

The desired architecture is:

```text
                 DATABASE
                    │
                    ▼
                  API
                    │
                    ▼
             ┌──────────────┐
             │ Frontend     │
             │              │
             │ Zone data    │
             │ Geometry     │
             │ Devices      │
             └──────┬───────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      SIDEBAR              SVG MAP
          │                   │
          └─────────┬─────────┘
                    ▼
              ACTIVE ZONE
                    │
                    ▼
             ZONE DASHBOARD
```

This is the foundation required for a maintainable dynamic facility-security dashboard.

---

# 44. Final Requirement

Before implementing the UI, establish the **zone/map data model and API contract first**.

Do not start by drawing the dashboard and later attempt to make the zones dynamic.

The implementation should start from:

```text
Facility
    ↓
Map
    ↓
Zone
    ↓
ZoneGeometry
    ↓
Devices
    ↓
Status / Alarms
```

Then build the visual dashboard on top of that model.

The supplied reference image should be treated as the target **visual concept**, while the actual application must be completely data-driven and capable of supporting an arbitrary number of facilities, maps, zones, sub-zones and devices.
