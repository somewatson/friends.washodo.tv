# Deployment Verification Plan - TwitchWatch

This document outlines the plan to implement a verification script to ensure that the TwitchWatch service is correctly deployed and functioning in both development and Docker environments.

## 1. Objective
Create a "Smoke Test" script that verifies the API's availability, authentication, and basic functionality after a deployment.

## 2. Technical Strategy
The verification will be implemented as a TypeScript script using `axios` (existing project dependency). This allows the script to share the project's environment and be run easily via `ts-node`.

### Environment Handling
The script will use the following environment variables to determine its target:
- `VERIFY_API_URL`: The base URL of the deployed API (e.g., `http://localhost:3000` or `http://app-server:3000`). Defaults to `http://localhost:3000`.
- `VERIFY_API_KEY`: The API key used for authentication (should match `API_KEY` in the service's `.env`).

## 3. Verification Suite
The script will execute the following tests:

### Test 1: Connectivity
- **Action**: Perform a `GET` request to `/api/status/test-user`.
- **Success Criteria**: The server responds (regardless of status code), proving the process is running and the port is reachable.

### Test 2: Authentication (Security)
- **Case A (No Key)**: Send request without `X-API-KEY` header.
    - **Expected**: `401 Unauthorized` (if `API_KEY` is configured in the server).
- **Case B (Invalid Key)**: Send request with `X-API-KEY: wrong-key`.
    - **Expected**: `401 Unauthorized`.

### Test 3: Functional API Response
- **Action**: Send a valid request to `/api/status/twitch` with the correct `X-API-KEY`.
- **Success Criteria**: 
    - Status code `200 OK`.
    - Response body is JSON.
    - Contains keys: `username`, `isLive`, and `lastLive`.

### Test 4: Upstream Dependency (Twitch API)
- **Action**: Analyze the response from Test 3.
- **Success Criteria**: No `500 Internal Server Error`. A 500 error would indicate that the deployed container/env is missing valid Twitch Client IDs/Secrets.

## 4. Implementation Plan

### Step 1: Create the script
Create `scripts/verify-deploy.ts`.

### Step 2: Implementation details
- Use `axios` for HTTP requests.
- Implement a simple test runner that logs `✅ PASS` or `❌ FAIL` for each test case.
- Ensure the script exits with code `0` on success and `1` if any critical test fails (allowing it to be used in CI/CD pipelines).

### Step 3: Usage Instructions
Add a script to `package.json` for easy execution:
`"verify": "ts-node scripts/verify-deploy.ts"`

**Execution examples:**
- **Dev**: `npm run verify`
- **Docker**: `VERIFY_API_URL=http://localhost:3000 VERIFY_API_KEY=your_key npm run verify`

## 5. Success Metrics
The deployment is considered "Verified" if:
1. The server is reachable.
2. Authentication is enforced.
3. The API returns valid data from the Twitch integration.
