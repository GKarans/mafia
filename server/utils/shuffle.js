// server/utils/shuffle.js

/**
 * Fisher-Yates Shuffle (immutable)
 * Returns a new shuffled array without mutating the original.
 * Optional seed parameter for deterministic testing.
 */

export const shuffle = (array, seed = null) => {
  if (!Array.isArray(array)) throw new Error("shuffle() expects an array");
  const copy = [...array];

  // Optional seeded randomness (simple linear congruential generator)
  let random = Math.random;
  if (seed !== null) {
    let x = Math.sin(seed) * 10000;
    random = () => (x = Math.sin(x) * 10000) - Math.floor(x);
  }

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};
