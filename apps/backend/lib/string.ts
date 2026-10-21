/**
 * Normalizes a string for comparison by:
 * 1. Converting to lowercase
 * 2. Removing all non-alphanumeric characters (dots, commas, hyphens)
 * 3. Collapsing multiple spaces into one
 * 4. Trimming lead/trail whitespace
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove dots, commas, etc.
    .replace(/\s+/g, ' ')         // Collapse whitespace
    .trim();
}
