/**
 * Sanitización básica de strings para prevenir XSS en respuestas
 */
export const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/[<>]/g, '');
};

export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};
