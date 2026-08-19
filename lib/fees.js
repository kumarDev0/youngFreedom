/**
 * The fee is decided here, on the server, and nowhere else.
 * If the browser sends an amount, it is ignored.
 */
export const FEE_TIERS = {
  '10th': 149,
  '12th': 149,
  'ITI': 149,
  'Diploma': 249,
  'B.Tech': 249,
  'Graduation': 249
};

export const QUALIFICATIONS = Object.keys(FEE_TIERS);

export function feeForQualification(q) {
  const amount = FEE_TIERS[q];
  if (!amount) throw new Error('Unknown qualification: ' + q);
  return amount;
}

/** Unused since the Cashfree integration (it takes rupees directly), kept
 *  in case a future integration needs paise again. */
export function toPaise(rupees) {
  return Math.round(rupees * 100);
}
