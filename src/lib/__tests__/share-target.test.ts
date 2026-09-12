import { describe, expect, it } from 'vitest';

import {
  buildShareText,
  canNativeShare,
  shouldShowWhatsApp,
  whatsappHref,
} from '@/lib/shareTarget';

describe('buildShareText', () => {
  it('puts the name above the link', () => {
    expect(buildShareText('Q3 deck.pdf', 'https://x.test/a')).toBe('Q3 deck.pdf\nhttps://x.test/a');
  });
});

describe('whatsappHref', () => {
  it('encodes the newline and the url into a wa.me deep link', () => {
    expect(whatsappHref('Q3 deck.pdf', 'https://x.test/a?b=1')).toBe(
      'https://wa.me/?text=Q3%20deck.pdf%0Ahttps%3A%2F%2Fx.test%2Fa%3Fb%3D1',
    );
  });

  it('escapes characters that would otherwise end the query', () => {
    expect(whatsappHref('a&b#c', 'https://x.test/')).toContain('a%26b%23c');
  });
});

describe('canNativeShare', () => {
  it('is true only for a callable share', () => {
    expect(canNativeShare({ share: () => Promise.resolve() })).toBe(true);
    expect(canNativeShare({})).toBe(false);
    expect(canNativeShare(undefined)).toBe(false);
    expect(canNativeShare({ share: undefined })).toBe(false);
  });
});

describe('shouldShowWhatsApp', () => {
  const withShare = { share: () => Promise.resolve() };

  it('shows on a phone even when the OS sheet exists', () => {
    expect(shouldShowWhatsApp(withShare, true)).toBe(true);
  });

  it('hides on a fine-pointer device that has the OS sheet', () => {
    expect(shouldShowWhatsApp(withShare, false)).toBe(false);
  });

  it('shows whenever there is no native share, pointer regardless', () => {
    expect(shouldShowWhatsApp({}, false)).toBe(true);
    expect(shouldShowWhatsApp({}, true)).toBe(true);
  });
});
