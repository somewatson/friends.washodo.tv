import fs from 'fs/promises';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), 'state.json');

export class StateManager {
  private state: Record<string, boolean> = {};

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error) {
      this.state = {};
    }
  }

  async save(): Promise<void> {
    await fs.writeFile(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  isLive(username: string): boolean {
    return !!this.state[username];
  }

  setLive(username: string, status: boolean): void {
    this.state[username] = status;
  }

  getAllTracked(): string[] {
    return Object.keys(this.state);
  }
}
