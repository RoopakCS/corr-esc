export interface ContractionResult {
  newDeadline: Date;
  contractedMs: number;
}

/**
 * Calculates dynamic SLA contraction using decaying compound factor:
 * Remaining = Remaining * (1 - alpha^k), clamped to floorHours.
 *
 * @param currentDeadline The existing incident SLA deadline
 * @param now Current timestamp
 * @param floorHours Category floor hours (safety minimum)
 * @param contractionFactor Category contraction factor alpha in (0, 1)
 * @param corroborationCount Current corroboration count k (>= 1)
 */
export function calculateContractedDeadline(
  currentDeadline: Date,
  now: Date,
  floorHours: number,
  contractionFactor: number,
  corroborationCount: number
): ContractionResult {
  const currentRemainingMs = Math.max(0, currentDeadline.getTime() - now.getTime());
  const floorMs = floorHours * 3600 * 1000;

  // If already at or below floor, or breached, do not contract further and never extend
  if (currentRemainingMs <= floorMs) {
    return {
      newDeadline: currentDeadline,
      contractedMs: 0,
    };
  }

  // Decaying contraction: Remaining = Remaining * (1 - alpha^k)
  const decayExponent = Math.max(1, corroborationCount);
  const decayMultiplier = 1 - Math.pow(contractionFactor, decayExponent);
  const calculatedRemainingMs = currentRemainingMs * Math.max(0, decayMultiplier);

  // Hard safety floor enforcement
  const newRemainingMs = Math.max(floorMs, calculatedRemainingMs);
  const contractedMs = Math.round(currentRemainingMs - newRemainingMs);
  const newDeadline = new Date(now.getTime() + newRemainingMs);

  return {
    newDeadline,
    contractedMs,
  };
}
