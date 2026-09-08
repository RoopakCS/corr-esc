export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleanSlugInput(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "");
}
