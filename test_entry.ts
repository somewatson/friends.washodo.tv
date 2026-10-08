
import { ApiServer } from './src/server';
import { StreamerStateRepository } from './src/streamerStateRepository';
import { BotAccountRepository } from './src/repositories/botAccountRepository';
const stateRepo = new StreamerStateRepository();
const botRepo = new BotAccountRepository();
const server = new ApiServer(stateRepo, botRepo);
server.start();
        