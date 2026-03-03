export function truncateWords(input?: string | null, wordLimit = 12): string {
  if (!input) return '';
  const words = input.trim().split(/\s+/);
  if (words.length <= wordLimit) return input;
  return words.slice(0, wordLimit).join(' ') + '...';
}

export default truncateWords;
