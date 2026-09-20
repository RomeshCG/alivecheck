import { env } from './lib/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.apiPort, () => {
  console.log(`AliveCheck API listening on http://localhost:${env.apiPort}`);
});
