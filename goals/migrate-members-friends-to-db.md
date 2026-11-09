# Migrate Members and Friends to Database

## Objective
Move the `WASHODO_MEMBERS` and `WASHODO_FRIENDS` lists from environment variables to the SQLite database to allow for dynamic updates and better persistence, specifically for the homepage display.

## Plan

### 1. Database Layer Update
- [ ] Modify `src/streamerStateRepository.ts` to handle members and friends.
    - The `tracked_entities` table already has a `category` column. I will verify if 'member' and 'friend' categories are being used.
    - Add specialized methods to `StreamerStateRepository` to fetch entities by category:
        - `getEntitiesByCategory(category: string): Promise<string[]>`
    - Ensure the `init()` method maintains the `tracked_entities` table.

### 2. Server/API Update
- [ ] Update `src/server.ts` to use `StreamerStateRepository` instead of `process.env`.
    - Identify all routes using `WASHODO_MEMBERS` and `WASHODO_FRIENDS` (found in `grep` results: lines 267, 330, 423, 429).
    - Inject or instantiate `StreamerStateRepository` in the server context to perform these queries.
    - Replace `(process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean)` with calls to the repository.

### 3. Service Update
- [ ] Update other services that still rely on these env vars for consistency:
    - `src/services/interactive.receiver.ts`
    - `src/services/discord.notifier.ts`
    - Any other scripts identified in `grep`.

### 4. Data Migration
- [ ] Use existing migration scripts or create a one-time script to move current `.env` values into the `tracked_entities` table.
    - I see `scripts/migrate-env-to-db.ts` and `scripts/import-env-to-db.ts` already exist. I will review them to see if they can be reused.

### 5. Cleanup & Validation
- [ ] Remove `WASHODO_MEMBERS` and `WASHODO_FRIENDS` from `.env.example`.
- [ ] Verify the homepage loads the correct members and friends from the database.
- [ ] Run existing tests to ensure no regressions in notification logic.
