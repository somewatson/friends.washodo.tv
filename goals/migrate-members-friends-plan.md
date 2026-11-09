# Plan: Migrate Members and Friends to Database

## Objective
Migrate the `WASHODO_MEMBERS` and `WASHODO_FRIENDS` lists from environment variables to the SQLite database to enable dynamic updates and centralize persistence.

## Technical Specifications

### 1. Database Layer (`src/streamerStateRepository.ts`)
- **Current State**: The `tracked_entities` table exists with columns `username`, `platform`, `category`, and `is_active`.
- **Requirement**: Add a method to retrieve usernames filtered by category.
- **Implementation**:
    - Implement `getEntitiesByCategory(category: string): Promise<string[]>`.
    - Query: `SELECT username FROM tracked_entities WHERE category = ? AND is_active = 1`.

### 2. Server Layer (`src/server.ts`)
- **Target Routes**:
    - `GET /streamer/:username`: Replace env var lookups for membership validation.
    - `GET /`: Replace env var lookups for rendering the homepage grids.
    - `GET /api/streamers`: Replace env var lookups for the members/friends API.
    - `GET /api/status/all`: Replace env var lookups for bulk status checks.
- **Implementation**:
    - Use the `this.stateRepo` instance already available in `ApiServer` to call `getEntitiesByCategory('member')` and `getEntitiesByCategory('friend')`.

### 3. Service Layer
- **Target Files**:
    - `src/services/interactive.receiver.ts`
    - `src/services/discord.notifier.ts`
- **Implementation**: Update logic to fetch the lists from `StreamerStateRepository` instead of `process.env`.

### 4. Migration Strategy
- **Process**: 
    - Review `scripts/import-env-to-db.ts` and `scripts/migrate-env-to-db.ts`.
    - Ensure a script exists to read `WASHODO_MEMBERS` and `WASHODO_FRIENDS` from `.env` and insert them into `tracked_entities` with the correct categories.
    - Execute migration before deploying code changes.

### 5. Cleanup
- **Action**: Remove `WASHODO_MEMBERS` and `WASHODO_FRIENDS` from `.env.example`.

## Success Criteria
- [ ] Homepage correctly displays members and friends fetched from the database.
- [ ] Individual streamer pages (`/streamer/:username`) correctly validate membership via the database.
- [ ] API endpoints return the updated lists from the database.
- [ ] Notifications still target the correct group of streamers.
- [ ] `.env.example` is cleaned of obsolete variables.
