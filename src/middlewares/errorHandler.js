import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let errors = err.errors || null;

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
  }

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'El registro ya existe';
  }

  if (message.includes('CORS')) {
    statusCode = 403;
    message = 'Origen no permitido';
  }

  // Errores de negocio (4xx): log corto. 5xx: log completo.
  if (statusCode >= 500) {
    console.error('[Error]', err);
  } else if (env.NODE_ENV === 'development') {
    console.warn(`[${statusCode}] ${message}`);
  }

  if (res.headersSent) {
    return;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && statusCode === 500 && { stack: err.stack }),
  });
};
