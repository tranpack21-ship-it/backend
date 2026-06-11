import { AppError } from '../utils/AppError.js';
import { sanitizeObject } from '../utils/sanitize.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const data = req[source];
  const sanitized = sanitizeObject(data);
  const result = schema.safeParse(sanitized);

  if (!result.success) {
    const errors = result.error.errors.map((e) => {
      let message = e.message;
      if (e.code === 'too_big' && e.type === 'number') {
        message = `El valor no puede ser mayor a ${e.maximum}`;
      } else if (e.code === 'too_small' && e.type === 'number') {
        message = `El valor debe ser al menos ${e.minimum}`;
      }
      return {
        field: e.path.join('.'),
        message,
      };
    });
    return next(new AppError('Datos de entrada inválidos', 400, errors));
  }

  req[source] = result.data;
  next();
};
