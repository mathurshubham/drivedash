import { describe, expect, it } from 'vitest';

import { decideRoute } from '../decide-route';
import type { AccessDecision } from '../types';

const ALLOWED: AccessDecision = { allowed: true, isAdmin: false };
const ADMIN: AccessDecision = { allowed: true, isAdmin: true };
const FULL: AccessDecision = { allowed: false, reason: 'full' };
const BLOCKED: AccessDecision = { allowed: false, reason: 'blocked' };

describe('decideRoute', () => {
  it('lets unauthenticated users through to /login and to /api/*', () => {
    expect(decideRoute({ pathname: '/login', isAuthed: false, decision: FULL })).toEqual({
      type: 'next',
    });
    expect(decideRoute({ pathname: '/api/search', isAuthed: false, decision: FULL })).toEqual({
      type: 'next',
    });
  });

  it('sends unauthenticated users to /login for every other page', () => {
    expect(decideRoute({ pathname: '/', isAuthed: false, decision: FULL })).toEqual({
      type: 'redirect',
      to: '/login',
    });
    expect(decideRoute({ pathname: '/access-denied', isAuthed: false, decision: FULL })).toEqual({
      type: 'redirect',
      to: '/login',
    });
    expect(decideRoute({ pathname: '/admin/users', isAuthed: false, decision: FULL })).toEqual({
      type: 'redirect',
      to: '/login',
    });
  });

  it('allows an authenticated user on /access-denied whatever the decision', () => {
    expect(decideRoute({ pathname: '/access-denied', isAuthed: true, decision: FULL })).toEqual({
      type: 'next',
    });
    expect(decideRoute({ pathname: '/access-denied', isAuthed: true, decision: ALLOWED })).toEqual({
      type: 'next',
    });
  });

  it('sends refused users to /access-denied with the reason', () => {
    expect(decideRoute({ pathname: '/', isAuthed: true, decision: FULL })).toEqual({
      type: 'redirect',
      to: '/access-denied?reason=full',
    });
    expect(decideRoute({ pathname: '/admin/users', isAuthed: true, decision: BLOCKED })).toEqual({
      type: 'redirect',
      to: '/access-denied?reason=blocked',
    });
  });

  it('sends allowed non-admins away from /admin', () => {
    expect(decideRoute({ pathname: '/admin', isAuthed: true, decision: ALLOWED })).toEqual({
      type: 'redirect',
      to: '/',
    });
    expect(decideRoute({ pathname: '/admin/users', isAuthed: true, decision: ALLOWED })).toEqual({
      type: 'redirect',
      to: '/',
    });
  });

  it('does not treat /administrators as an admin path', () => {
    expect(decideRoute({ pathname: '/administrators', isAuthed: true, decision: ALLOWED })).toEqual({
      type: 'next',
    });
  });

  it('lets allowed users and admins through', () => {
    expect(decideRoute({ pathname: '/', isAuthed: true, decision: ALLOWED })).toEqual({
      type: 'next',
    });
    expect(decideRoute({ pathname: '/admin/users', isAuthed: true, decision: ADMIN })).toEqual({
      type: 'next',
    });
  });
});
