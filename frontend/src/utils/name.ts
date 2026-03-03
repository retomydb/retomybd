export function formatOwner(name?: string | null): string {
  if (!name) return '@Unknown';
  const first = String(name).trim().split(/\s+/)[0];
  return `@${first}`;
}
