import { StateManager } from '../src/stateManager';
import fs from 'fs';
import path from 'path';

jest.mock('fs');

describe('StateManager', () => {
    let stateManager: StateManager;
    const mockStateFile = path.join(process.cwd(), 'state.json');

    beforeEach(() => {
        stateManager = new StateManager();
        jest.clearAllMocks();
    });

    it('should return an empty object if state file does not exist', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        expect(stateManager.loadState()).toEqual({});
    });

    it('should load state from file', () => {
        const mockState = { 'streamer1': true, 'streamer2': false };
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockState));
        
        expect(stateManager.loadState()).toEqual(mockState);
    });

    it('should save state to file', () => {
        const mockState = { 'streamer1': true };
        stateManager.saveState(mockState);
        
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            mockStateFile,
            JSON.stringify(mockState, null, 2)
        );
    });
});
