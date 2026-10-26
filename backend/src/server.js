import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import api from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use('/api', api);
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Vaishnav Marble API running on http://localhost:${env.port} (${env.nodeEnv})`);
});
