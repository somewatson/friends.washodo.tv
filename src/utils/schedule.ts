import cronParser from 'cron-parser';

export class ScheduleHelper {
    static async nextRun(cronExpression: string): Promise<string | null> {
        try {
            const interval = (cronParser as any).parseExpression(cronExpression);
            return interval.next().toString();
        } catch (e) {
            return null;
        }
    }

    static async isValid(cronExpression: string): Promise<boolean> {
        try {
            (cronParser as any).parseExpression(cronExpression);
            return true;
        } catch (e) {
            return false;
        }
    }

    static getPreset(key: string): string {
        const presets: Record<string, string> = {
            'hourly': '0 * * * *',
            'daily_noon': '0 12 * * *',
            'daily_midnight': '0 0 * * *',
            'weekly_mon': '0 0 * * 1',
            'every_6h': '0 */6 * * *',
        };
        return presets[key] || '0 12 * * *';
    }
}
