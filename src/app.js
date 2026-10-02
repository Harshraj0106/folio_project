import express from 'express';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { createApiRouter } from './http/api.js';
import { securityHeaders } from './http/security.js';

const config = loadConfig();
const app = express();

app.set('port', config.port);
app.set('trust proxy', 1);
app.use(securityHeaders);
// Vercel serves public/ from its own CDN and ignores this line; it covers local runs and other hosts.
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
app.use('/api', createApiRouter(createContainer(config)));

export default app;
