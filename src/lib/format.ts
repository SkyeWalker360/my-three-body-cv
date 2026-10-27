const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2022-11" → "Nov 2022", "2018" → "2018". */
export function formatDate(iso: string): string {
  const [year, month] = iso.split('-');
  if (!month) return year ?? iso;
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : iso;
}

/** A date range; a null or missing end means the entry is ongoing. */
export function formatRange(start: string, end: string | null | undefined): string {
  return `${formatDate(start)} – ${end ? formatDate(end) : 'Present'}`;
}

/** The first `count` sentences of a paragraph, verbatim. */
export function firstSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [text];
  return sentences.slice(0, count).join('').trim();
}
