import { defineTask } from 'nitro/task';
import { runExpirationCleanup } from '../../expiration-cleanup';

export default defineTask({
  meta: {
    name: 'sharing:expire',
    description: 'Remove expired share files and abandoned private uploads.',
  },
  async run() {
    if (!process.env.CRON_SECRET || Buffer.byteLength(process.env.CRON_SECRET, 'utf8') < 32) {
      throw new Error('CRON_SECRET must be configured with at least 32 bytes before cleanup can run.');
    }
    const result = await runExpirationCleanup();
    return { result };
  },
});
