import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const isAuthenticatedRequest = (req) =>
  Boolean(req.headers.authorization?.startsWith('Bearer '));

const isLoginRequest = (req) => {
  const url = req.originalUrl || req.url || '';
  return url.includes('/auth/login');
};

const isHealthCheck = (req) => {
  const url = req.originalUrl || req.url || '';
  return url.includes('/health');
};

/**
 * Límite global de API.
 * - Desarrollo: desactivado (SPA + React Strict Mode generan muchas peticiones legítimas).
 * - Producción: sin límite para usuarios autenticados; límite alto solo para tráfico anónimo.
 */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (!env.RATE_LIMIT_ENABLED) return true;
    if (isHealthCheck(req)) return true;
    if (isLoginRequest(req)) return true;
    if (isAuthenticatedRequest(req)) return true;
    return false;
  },
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intente más tarde.',
  },
});

/** Solo login: protección contra fuerza bruta */
export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !env.RATE_LIMIT_ENABLED,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Intente más tarde.',
  },
});
