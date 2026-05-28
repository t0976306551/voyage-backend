export const ALLOWED_CURRENCIES = new Set([
  'TWD', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'HKD', 'SGD', 'KRW',
  'CNY', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'INR', 'CHF', 'NZD', 'SEK',
  'NOK', 'DKK', 'BRL', 'ZAR', 'MXN', 'AED', 'SAR', 'TRY', 'ILS', 'CZK',
]);

export const MAX_AMOUNT = 10_000_000;

export const MAX_DESCRIPTION_LENGTH = 1000;

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
