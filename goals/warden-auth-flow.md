# Goal: Implement Warden Authentication Flow

## Objective
Implement a secure, themed authentication system for the admin interface to replace the static API key requirement with a standard login flow, utilizing obscure routing to minimize bot discovery.

## Requirements
- **Custom Routing (Obscurity)**:
    - Admin Dashboard Route: `/warden-access` (replacing `/admin`).
    - Login Page Route: `/warden-gate` (replacing `/login`).
- **Authentication Flow**:
    - Unauthenticated access to `/warden-access` must redirect to `/warden-gate`.
    - Successful login at `/warden-gate` must set a secure session cookie and redirect back to `/warden-access`.
    - A `/api/logout` endpoint must be provided to clear the session cookie.
- **Credential Management**:
    - Use `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the `.env` file for verification.
- **Frontend**:
    - Create a themed `public/login.html` that matches the Washodo style guide.
- **Security**:
    - Use `cookie-parser` for session management.
    - Ensure all `/api/admin` and `/warden-access` routes are protected by the session middleware.

## Implementation Plan

### Phase 1: Environment & Dependencies
- [ ] Install `cookie-parser`.
- [ ] Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` to `.env.example`.

### Phase 2: Login Interface
- [ ] Create `public/login.html` with a username/password form, themed with Washodo Purple (`#a970ff`) and Sky Blue (`#38bdf8`).
- [ ] Implement client-side logic to POST credentials to `/api/login`.

### Phase 3: Server-Side Authentication
- [ ] Implement `GET /warden-gate` to serve the login page.
- [ ] Implement `POST /api/login` to:
    - Verify credentials against `.env`.
    - Set a secure session cookie upon success.
- [ ] Implement `POST /api/logout` to clear the session cookie.

### Phase 4: Route Protection & Refactoring
- [ ] Update `ApiServer` middleware to check for the session cookie on:
    - `/warden-access`
    - All `/api/admin/*` endpoints.
- [ ] Implement the redirect logic from `/warden-access` $\rightarrow$ `/warden-gate` for unauthenticated users.
- [ ] Rename the `/admin` route to `/warden-access`.

### Phase 5: Verification
- [ ] Verify that visiting `/warden-access` without a session redirects to `/warden-gate`.
- [ ] Verify that correct credentials grant access to the dashboard.
- [ ] Verify that incorrect credentials return an error.
- [ ] Verify that logging out prevents further access until re-authentication.
