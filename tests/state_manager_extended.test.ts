import * as fs from 'fs';
import * as path from 'path';
import { StateManager } from '../src/services/state.manager';

describe('StateManager Extended', () => {
    let stateManager: StateManager;
    
    const TEST_USER_LIVE = 'test_user_live_verification';
    const TEST_USER_TIME = 'test_user_time_verification';

    beforeAll(async () => {
        stateManager = new StateManager();
        await stateManager.load();
    });

    afterAll(async () => {
        await stateManager.setLive(TEST_USER_LIVE, false);
        await stateManager.setLastNotificationTime(TEST_USER_TIME, null);
    });

    it('should correctly persist and retrieve streamer live status', async () => {
        await stateManager.setLive(TEST_USER_LIVE, true);
        expect(await stateManager.isLive(TEST_USER_LIVE)).toBe(true);
        
        await stateManager.setLive(TEST_USER_LIVE, false);
        expect(await stateManager.isLive(TEST_USER_LIVE)).toBe(false);
    });

    it('should handle notification timestamps correctly', async () => {
        const now = new Date().toISOString();
        
        // IMPORTANT: In the current StateManager implementation, 
        // setLastNotificationTime uses an UPDATE statement.
        // If the user doesn't exist in the table, the UPDATE will do nothing.
        // We must first ensure the user exists.
        await stateManager.setLive(TEST_USER_TIME, false);
        
        await stateManager.setLastNotificationTime(TEST_USER_TIME, now);
        const retrieved = await stateManager.getLastNotificationTime(TEST_USER_TIME);
        
        expect(retrieved).not.toBeNull();
        expect(retrieved).toContain(now.split('T')[0]);
        
        await stateManager.setLastNotificationTime(TEST_USER_TIME, null);
        expect(await stateManager.getLastNotificationTime(TEST_USER_TIME)).toBeNull();
    });

    it('should handle non-existent users gracefully', async () => {
        expect(await stateManager.isLive('totally_fake_user_12345')).toBe(false);
        expect(await stateManager.getLastNotificationTime('totally_fake_user_12345')).toBeNull();
    });
});
