import { getEnvPrefix } from '../utils/env';

export class AnnouncementAssembler {
    static async assemble(announcements: any[], streamerCount: number): Promise<{
        discord: string,
        mattermost: string,
        twitch: string
    }> {
        const now = new Date().toISOString().split('T')[0];
        
        const activeAnnouncements = announcements.filter(a => {
            const isActive = a.is_active === 1;
            const isStarted = !a.start_date || a.start_date <= (now || '');
            const isNotEnded = !a.end_date || a.end_date >= (now || '');
            return isActive && isStarted && isNotEnded;
        });

        const processText = (text: string) => {
            return text
                .replace(/{{today}}/g, new Date().toLocaleDateString())
                .replace(/{{streamer_count}}/g, streamerCount.toString())
                .replace(/{{team_link}}/g, 'https://twitch.tv/washodo'); // Example link
        };

        const assembleForPlatform = (platformKey: 'discord_enabled' | 'mattermost_enabled' | 'twitch_enabled') => {
            return activeAnnouncements
                .filter(a => a[platformKey] === 1)
                .map(a => processText(a.text))
                .join('\n\n');
        };

        return {
            discord: assembleForPlatform('discord_enabled'),
            mattermost: assembleForPlatform('mattermost_enabled'),
            twitch: assembleForPlatform('twitch_enabled')
        };
    }
}
