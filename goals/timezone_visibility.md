# Goal: Implement Human-Centric Timezone Visibility in Admin UI

## Objective
Eliminate the cognitive load for admins when configuring UTC cron schedules by providing "Dual-Context Visibility"—showing both the server's UTC time and the user's local time translation in real-time.

## Problem Statement
Admins must enter cron expressions in UTC. Currently, the UI provides minimal context, forcing admins to manually calculate the offset between their local time (e.g., PT/ET) and UTC, which is error-prone and frustrating.

## Proposed Implementation

### 1. Server Time Anchor
Update the "Broadcasts" page to display the current server time explicitly as UTC to establish the source of truth.
- **Current**: `Server Time: [Local String]`
- **New**: `Server Time (UTC): [UTC String]`

### 2. Local Time Translation
Display the same moment in the user's local time immediately below the server time.
- **New**: `Your Local Time: [Local String] ([Timezone])`

### 3. Cron Execution Predictor (The "Human" Bridge)
Modify the cron expression preview to translate the next execution time from UTC to the user's local time.
- **Current**: `0 12 * * * → Daily Noon`
- **New**: `0 12 * * * → Daily Noon (Next: 12:00 UTC / 04:00 AM PT)`

## Success Criteria
- [ ] `AGENTS.md` updated with timezone handling guidelines.
- [ ] Admin UI displays both Server Time (UTC) and User Local Time.
- [ ] Cron preview explicitly shows the next run time in both UTC and Local time.
- [ ] No manual timezone calculations required by the admin to verify a schedule.
