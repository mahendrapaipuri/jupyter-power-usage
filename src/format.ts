/**
 * The type of unit used for reporting emissions.
 */
export type EmissionsUnit = 'mg' | 'g' | 'kg';

/**
 * The number of milligrams in each emission unit.
 */
export const EMISSION_UNIT_LIMITS: {
  readonly [U in EmissionsUnit]: number;
} = {
  mg: 1,
  g: 1000,
  kg: 1000000,
};

export function formatForDisplay(numBytes: number | undefined): string {
  const lu = convertToLargestUnit(numBytes);
  return lu[0].toFixed(2) + ' ' + lu[1];
}

/**
 * Given a number of milligrams, convert to the most human-readable
 * format, (g, kg, etc).
 */
export function convertToLargestUnit(
  milliGrams: number | undefined
): [number, EmissionsUnit] {
  if (!milliGrams) {
    return [0, 'mg'];
  }
  if (milliGrams < EMISSION_UNIT_LIMITS.g) {
    return [milliGrams, 'mg'];
  } else if (
    EMISSION_UNIT_LIMITS.g === milliGrams ||
    milliGrams < EMISSION_UNIT_LIMITS.kg
  ) {
    return [milliGrams / EMISSION_UNIT_LIMITS.g, 'g'];
  } else {
    return [milliGrams / EMISSION_UNIT_LIMITS.kg, 'kg'];
  }
}
