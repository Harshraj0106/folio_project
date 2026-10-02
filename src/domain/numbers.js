export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function roundTo(value, places = 2) {
  if (value === null) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
