/** AUDK candidate-only implementation for human review.
 * NOT an approved recipe, public applet, runtime registration, or worker input.
 * Python math.tan full semantics are intentionally narrowed to finite JS numbers
 * in the closed interval [-1.2, 1.2] radians.
 */

export const MATH_TAN_CANDIDATE_CONTRACT = Object.freeze({
  schema: 'audk.candidate-recipe.v1',
  functionId: 'math.tan',
  stage: 'implementation-proposal',
  bounds: Object.freeze({minimum: -1.2, maximum: 1.2, inclusive: true, unit: 'radians'}),
  acceptedInput: 'finite-javascript-number-only',
  numericTolerance: Object.freeze({absolute: 5e-13, relative: 5e-13}),
  review: Object.freeze({humanApproved: false, documentationReviewed: false, boundsApproved: false, implementationApproved: false}),
  policy: Object.freeze({executableRecipe: false, registryPromotion: false, automaticPublication: false}),
});

/** Returns data (not thrown exceptions) in the existing experimental parity format.
 * Unknown user code is never evaluated. No IO, coercion, or dynamic imports.
 */
export function evaluateMathTanProposal(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    return {kind: 'error', exception: 'TypeError'};
  }
  if (x < -1.2 || x > 1.2) {
    return {kind: 'unsupported', reason: 'bounded prototype outside admitted domain'};
  }
  const value = Math.tan(x);
  if (!Number.isFinite(value)) {
    return {kind: 'unsupported', reason: 'nonfinite candidate result'};
  }
  return {kind: 'value', value};
}
