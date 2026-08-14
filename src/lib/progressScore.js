// A stored score of 1-10 buckets into the three UI states: 1-6 = learning
// (yellow), 7-10 = mastered (green); no score at all = untouched (gray).
export const LEARNING_SCORE = 3
export const MASTERED_SCORE = 8

export function scoreToBucket(score) {
  if (score == null) return undefined
  return score >= 7 ? 'mastered' : 'learning'
}
