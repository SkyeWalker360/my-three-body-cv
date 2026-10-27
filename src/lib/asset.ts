/** Prefix a public/ path with the deploy base path (GitHub Pages serves under a sub-path). */
export function asset(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
}
