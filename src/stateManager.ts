import fs from 'fs';
import path from 'path';

export interface StreamerState {
    isLive: boolean;
    lastLive: string | null;
}

export class StateManager {
    private stateFile = path.join(process.cwd(), 'state.json');

    loadState(): Record<string, StreamerState> {
        if (!fs.existsSync(this.stateFile)) {
            return {};
        }
        try {
            return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        } catch {
            return {};
        }
    }

    saveState(state: Record<string, StreamerState>) {
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }
}
