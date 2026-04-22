/**
 * Calculates the Levenshtein distance between two strings.
 * The Levenshtein distance is a number that represents how many changes (insertions,
 * deletions, or substitutions) are needed to transform one string into another.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates a similarity score between two strings, ranging from 0 to 1.
 * 1 means the strings are identical, 0 means they are completely different.
 */
export function calculateSimilarity(a: string, b: string): number {
  const aClean = a.trim().toLowerCase();
  const bClean = b.trim().toLowerCase();

  if (aClean === bClean) {
    return 1;
  }

  const distance = levenshteinDistance(aClean, bClean);
  const maxLength = Math.max(aClean.length, bClean.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - distance / maxLength;
}
