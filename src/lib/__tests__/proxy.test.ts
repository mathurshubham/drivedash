import { describe, expect, it } from 'vitest';

import { decideRoute } from '../decide-route';

describe('decideRoute', () => {
  it('lets unauthenticated users through to /login', () => {
    expect(
      decideRoute({ pathname: '/login', isAuthed: false, isAllowed: false, isAdmin: false }),
    ).toEqual({ type: 'next' });
  });

  it('sends unauthenticated users to /login for every other page', () => {
    expect(decideRoute({ pathname: '/', isAuthed: false, isAllowed: false, isAdmin: false })).toEqual({
      type: 'redirect',
      to: '/login',
    });
    expect(
      decideRoute({ pathname: '/request-access', isAuthed: false, isAllowed: false, isAdmin: false }),
    ).toEqual({ type: 'redirect', to: '/login' });
    expect(
      decideRoute({ pathname: '/admin/users', isAuthed: false, isAllowed: false, isAdmin: false }),
    ).toEqual({ type: 'redirect', to: '/login' });
  });

  it('allows an authenticated user on /request-access even when not approved', () => {
    expect(
      decideRoute({ pathname: '/request-access', isAuthed: true, isAllowed: false, isAdmin: false }),
    ).toEqual({ type: 'next' });
  });

  it('sends authenticated but unapproved users to /request-access', () => {
    expect(decideRoute({ pathname: '/', isAuthed: true, isAllowed: false, isAdmin: false })).toEqual({
      type: 'redirect',
      to: '/request-access',
    });
    expect(
      decideRoute({ pathname: '/admin/users', isAuthed: true, isAllowed: false, isAdmin: false }),
    ).toEqual({ type: 'redirect', to: '/request-access' });
  });

  it('sends approved non-admins away from /admin', () => {
    expect(
      decideRoute({ pathname: '/admin/users', isAuthed: true, isAllowed: true, isAdmin: false }),
    ).toEqual({ type: 'redirect', to: '/' });
  });

  it('lets approved users and admins through', () => {
    expect(decideRoute({ pathname: '/', isAuthed: true, isAllowed: true, isAdmin: false })).toEqual({
      type: 'next',
    });
    expect(
      decideRoute({ pathname: '/admin/users', isAuthed: true, isAllowed: true, isAdmin: true }),
    ).toEqual({ type: 'next' });
  });
});
