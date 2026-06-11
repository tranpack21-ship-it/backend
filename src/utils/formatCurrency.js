/** Locale y moneda del sistema — peso argentino (ARS) */
export const APP_LOCALE = 'es-AR';
export const APP_CURRENCY = 'ARS';

const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'currency',
  currency: APP_CURRENCY,
  currencyDisplay: 'symbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return currencyFormatter.format(num);
};
