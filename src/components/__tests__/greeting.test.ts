import { describe, expect, it } from 'vitest';
import {
  firstName,
  formatGreetingDate,
  greetingFor,
  greetingLine,
} from '@/components/greeting';

describe('formatGreetingDate', () => {
  it('is en-GB order with the comma, the string Chrome produced', () => {
    // 2026-09-13 is a Sunday.
    expect(formatGreetingDate(new Date(2026, 8, 13, 9, 0))).toBe('Sunday, 13 September');
  });

  it('does not pad the day and names every month from the fixed table', () => {
    expect(formatGreetingDate(new Date(2026, 0, 1))).toBe('Thursday, 1 January');
    expect(formatGreetingDate(new Date(2026, 11, 31))).toBe('Thursday, 31 December');
  });

  it('matches itself across repeated calls — no Intl, so no ICU drift', () => {
    const d = new Date(2026, 8, 13);
    expect(formatGreetingDate(d)).toBe(formatGreetingDate(new Date(d.getTime())));
  });
});

describe('greetingFor', () => {
  it('splits the day at noon and six', () => {
    expect(greetingFor(0)).toBe('Morning');
    expect(greetingFor(11)).toBe('Morning');
    expect(greetingFor(12)).toBe('Afternoon');
    expect(greetingFor(17)).toBe('Afternoon');
    expect(greetingFor(18)).toBe('Evening');
    expect(greetingFor(23)).toBe('Evening');
  });
});

describe('greetingLine', () => {
  it('falls back to "Hello" before mount, when the viewer’s hour is unknown', () => {
    expect(greetingLine(null, 'Shubham')).toBe('Hello, Shubham');
    expect(greetingLine(null, null)).toBe('Hello');
  });

  it('uses the time-of-day word once it has one', () => {
    expect(greetingLine('Evening', 'Shubham')).toBe('Evening, Shubham');
    expect(greetingLine('Morning', null)).toBe('Morning');
  });
});

describe('firstName', () => {
  it('takes the first word, or nothing', () => {
    expect(firstName('Shubham Mathur')).toBe('Shubham');
    expect(firstName('  Ada   Lovelace ')).toBe('Ada');
    expect(firstName('')).toBe(null);
    expect(firstName(null)).toBe(null);
    expect(firstName(undefined)).toBe(null);
  });
});
