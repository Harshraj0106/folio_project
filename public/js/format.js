const MISSING = '—';
const MINUS = '−';
const RUPEE = '₹';

const decimal = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en-IN');
const clock = new Intl.DateTimeFormat('en-IN', { timeStyle: 'medium' });

function signOf(value) {
  if (value > 0) return '+';
  if (value < 0) return MINUS;
  return '';
}

export function formatDecimal(value) {
  return value === null ? MISSING : decimal.format(value);
}

export function formatRupees(value) {
  return value === null ? MISSING : `${RUPEE}${decimal.format(value)}`;
}

export function formatQuantity(value) {
  return whole.format(value);
}

export function formatSigned(value) {
  return value === null ? MISSING : `${signOf(value)}${decimal.format(Math.abs(value))}`;
}

export function formatSignedRupees(value) {
  return value === null ? MISSING : `${signOf(value)}${RUPEE}${decimal.format(Math.abs(value))}`;
}

export function formatPercent(value) {
  return value === null ? MISSING : `${formatSigned(value)}%`;
}

export function formatTime(date) {
  return clock.format(date);
}

export function toneOf(value) {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'flat';
}
