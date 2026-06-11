import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

if (env.corsOrigins.length === 1) {
  corsOptions.origin = env.corsOrigins[0];
} else {
  corsOptions.origin = (origin, callback) => {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, origin || env.corsOrigins[0]);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  };
}

app.use(cors(corsOptions));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/** Health check raíz para Railway (sin rate limit ni prefijo /api/v1) */
app.use('/health', healthRoutes);

app.use('/api/v1', apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
