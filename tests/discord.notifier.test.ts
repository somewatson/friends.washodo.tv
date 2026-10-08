import { DiscordNotifier } from '../src/services/discord.notifier';
import { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

jest.mock('discord.js', () => {
    return {
        Client: jest.fn().mockImplementation(() => ({
            login: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
            destroy: jest.fn().mockResolvedValue(undefined),
            channels: {
                fetch: jest.fn().mockResolvedValue({
                    isTextBased: () => true,
                    send: jest.fn().mockResolvedValue(undefined),
                }),
            },
        })),
        GatewayIntentBits: {
            Guilds: 1,
            GuildMessages: 2,
            MessageContent: 3,
        },
        EmbedBuilder: jest.fn().mockImplementation(() => ({
            setColor: jest.fn().mockReturnThis(),
            setTitle: jest.fn().mockReturnThis(),
            setDescription: jest.fn().mockReturnThis(),
            setThumbnail: jest.fn().mockReturnThis(),
            setTimestamp: jest.fn().mockReturnThis(),
        })),
    };
});

describe('DiscordNotifier', () => {
    let notifier: DiscordNotifier;
    let mockStateRepo: any;
    let mockTwitchClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockStateRepo = {
            shouldNotify: jest.fn(),
            recordNotification: jest.fn(),
        };
        
        mockTwitchClient = {};
        
        // Set environment variables for config parsing test
        process.env.DISCORD_BOTS = 'token1|channel1,token2|channel2';
        
        notifier = new DiscordNotifier(mockStateRepo, mockTwitchClient);
    });

    it('should correctly parse DISCORD_BOTS environment variable', () => {
        // Accessing private configs via casting to any
        const configs = (notifier as any).configs;
        expect(configs).toHaveLength(2);
        expect(configs[0]).toEqual({ token: 'token1', channelId: 'channel1' });
        expect(configs[1]).toEqual({ token: 'token2', channelId: 'channel2' });
    });

    it('should ignore invalid server configs', () => {
        process.env.DISCORD_BOTS = 'validToken|validChannel,invalidConfig,anotherInvalid|';
        const newNotifier = new DiscordNotifier(mockStateRepo, mockTwitchClient);
        const configs = (newNotifier as any).configs;
        expect(configs).toHaveLength(1);
        expect(configs[0].token).toBe('validToken');
    });

    it('should identify commands correctly in handleCommand', async () => {
        const mockMessage = {
            content: '!help',
            author: { bot: false },
            reply: jest.fn().mockResolvedValue(undefined),
        };

        await (notifier as any).handleCommand(mockMessage);
        expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Bot Help Menu'));
    });

    it('should reply with a generic message when an unknown command is used with a trigger', async () => {
        const mockMessage = {
            content: '!unknownCommand',
            author: { bot: false },
            reply: jest.fn().mockResolvedValue(undefined),
        };

        await (notifier as any).handleCommand(mockMessage);
        expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('I don\'t recognize a command'));
    });

    it('should not reply if no trigger is present', async () => {
        const mockMessage = {
            content: 'hello bot',
            author: { bot: false },
            reply: jest.fn().mockResolvedValue(undefined),
        };

        await (notifier as any).handleCommand(mockMessage);
        expect(mockMessage.reply).not.toHaveBeenCalled();
    });

    it('should send notification only when stateRepo.shouldNotify is true', async () => {
        const streamer = {
            user_name: 'Test Streamer',
            user_login: 'testuser',
            title: 'Test Title',
            thumbnail_url: 'http://test.com/thumb.jpg'
        };

        // Setup: Login one client and add it to internal map
        const mockClient = new Client();
        const mockChannel = {
            isTextBased: () => true,
            send: jest.fn().mockResolvedValue(undefined),
        };
        (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);
        (notifier as any).clients.set('token1', mockClient);

        // Case 1: shouldNotify returns false
        mockStateRepo.shouldNotify.mockResolvedValue(false);
        await notifier.notify(streamer);
        expect(mockChannel.send).not.toHaveBeenCalled();

        // Case 2: shouldNotify returns true
        mockStateRepo.shouldNotify.mockResolvedValue(true);
        await notifier.notify(streamer);
        expect(mockChannel.send).toHaveBeenCalled();
        expect(mockStateRepo.recordNotification).toHaveBeenCalledWith('testuser', 'discord', 'channel1');
    });
});
