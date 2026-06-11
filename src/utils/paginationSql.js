/**
 * MySQL 8.0.22+ rechaza LIMIT/OFFSET vinculados como DOUBLE en prepared statements (mysql2).
 * Los valores ya vienen validados por Zod; se interpolan como enteros seguros en el SQL.
 */
const assertInt = (value, { min, max, label }) => {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} inválido`);
  }
  return n;
};

export const sqlLimitOffset = (limit, offset, { maxLimit = 500 } = {}) => {
  const safeLimit = assertInt(limit, { min: 1, max: maxLimit, label: 'limit' });
  const safeOffset = assertInt(offset, { min: 0, max: Number.MAX_SAFE_INTEGER, label: 'offset' });
  return `LIMIT ${safeLimit} OFFSET ${safeOffset}`;
};

export const sqlLimit = (limit, { maxLimit = 500 } = {}) => {
  const safeLimit = assertInt(limit, { min: 1, max: maxLimit, label: 'limit' });
  return `LIMIT ${safeLimit}`;
};
