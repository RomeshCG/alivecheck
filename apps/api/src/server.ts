import { env } from './lib/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.apiPort, '0.0.0.0', () => {
  console.log(`AliveCheck API listening on http://0.0.0.0:${env.apiPort}`);
});
