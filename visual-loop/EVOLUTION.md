# Visual Loop Evolution: Dynamic Discovery & Session Management

This document outlines the architectural updates to the visual feedback loop to improve reliability, organization, and maintainability.

## 1. Server-Side: Route Handshake & Discovery
To eliminate "fake positive" screenshots (where the browser captures the wrong page due to redirects), the server and audit script now employ a route handshake.

### Route Registry
The server maintains a `WARDEN_ROUTES` registry. This serves as the single source of truth for all administrative pages.
- **Implementation**: All Warden routes are mapped from a unique `route-name` (e.g., `warden-streamers`) to its `url-path` (e.g., `/warden/streamers`).
- **Injection**: The server injects `data-loaded="true"` and `data-route="[route-name]"` into the `<body>` tag of the rendered page.

### Discovery API
A new endpoint `GET /api/visual-loop/routes` allows the audit script to dynamically discover which pages it needs to visit.
- **Development Mode**: The server logs the registered route map to the console on startup.

## 2. Audit Script: Intelligent Capture
The `audit-pages.js` script has been upgraded from a static list to a dynamic discovery agent.

### Dynamic Workflow
1. **Discovery**: Fetches the route map from the server API.
2. **Handshake**: After loading a page, the script verifies that the `data-route` attribute matches the expected route name. If they mismatch, it reports a `Navigation/Auth Failure`.
3. **Categorization**: Routes are automatically split into `core` (home, status) and `warden` (admin panel) categories.

### Operational Modes
- **Full Mode (`--mode full`)**: High-fidelity audit. Isolated sessions per route, full 1080p captures, and metadata dumps.
- **Smoke Mode (`--mode smoke`)**: Rapid verification. Shared session for speed, PNG-only captures, and overwrite-style storage for quick iteration.

## 3. Organized Storage & Retention
To prevent filesystem bloat while preserving history, the storage system now uses timestamped sessions.

### Directory Structure
```text
visual-loop/screenshots/
├── [YYYY-MM-DD_HH-mm-ss]_[label]/
│   ├── core/
│   │   └── home.png
│   └── warden/
│       └── warden-streamers.png
└── latest/  <-- Mirror of the most recent successful run
```

### Rolling Retention
- **Limit**: A configurable `MAX_SESSIONS` limit.
- **Housekeeping**: At the start of each run, the oldest session folders are pruned to keep the total count within the limit, ensuring the filesystem doesn't fill up.
