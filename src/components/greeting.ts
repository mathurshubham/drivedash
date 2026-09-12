/**
 * Pure date/greeting helpers for `GreetingBar`, kept out of the component so
 * they can be unit-tested in node.
 *
 * Nothing here goes near `Intl`. `toLocaleDateString(undefined, …)` and
 * `Intl.DateTimeFormat` are ICU-backed and their output differs between the
 * Node build that renders the page on the server and the browser that hydrates
 * it — Node emitted "Sunday 13 September", Chrome "Sunday, 13 September", and
 * every home load logged a hydration mismatch. Fixed arrays and a fixed en-GB
 * word order are identical on both sides by construction.
 */

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** e.g. `"Sunday, 13 September"` — en-GB order, no locale lookup. */
export function formatGreetingDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export type Greeting = 'Morning' | 'Afternoon' | 'Evening';

/** Depends on the *viewer's* clock, so it is only ever computed after mount. */
export function greetingFor(hour: number): Greeting {
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

/** First word of a full name, or `null` when there isn't one. */
export function firstName(full: string | null | undefined): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/**
 * The server has no idea what time it is where the reader is, so it greets
 * them by name only ("Hello, Shubham"); the mounted client swaps the word in.
 */
export function greetingLine(greeting: Greeting | null, who: string | null): string {
  const word = greeting ?? 'Hello';
  return who ? `${word}, ${who}` : word;
}
