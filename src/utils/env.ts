import { APP_ENV } from '../config/env';

export function getEnvPrefix(): string {
    switch (APP_ENV) {
        case 'staging':
            return '[STAGING] ';
        case 'development':
            return '[DEV] ';
        default:
            return '';
    }
}
