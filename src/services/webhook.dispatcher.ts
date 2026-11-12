import axios from 'axios';

export class WebhookDispatcher {
    constructor(private stateRepo: any) {}

    async dispatch(event: string, payload: any) {
        console.log(`[WebhookDispatcher] Triggering event: ${event}`);
        
        try {
            const webhooks = await this.stateRepo.getInternalWebhooks();
            const activeWebhooks = webhooks.filter((w: any) => w.is_active === 1 && w.event_type === event);

            if (activeWebhooks.length === 0) {
                console.log(`[WebhookDispatcher] No active webhooks for event: ${event}`);
                return;
            }

            await Promise.allSettled(activeWebhooks.map(async (webhook: any) => {
                try {
                    await axios.post(webhook.target_url, {
                        event,
                        timestamp: new Date().toISOString(),
                        data: payload
                    }, { timeout: 5000 });
                    console.log(`[WebhookDispatcher] Successfully sent ${event} to ${webhook.target_url}`);
                } catch (error: any) {
                    console.error(`[WebhookDispatcher] Failed to send ${event} to ${webhook.target_url}: ${error.message}`);
                }
            }));
        } catch (error: any) {
            console.error(`[WebhookDispatcher] Error dispatching webhooks: ${error.message}`);
        }
    }
}
