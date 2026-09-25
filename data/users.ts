// The accounts the login screen lists. Both builds use the same password; the
// standard account's address differs by one letter between them (measured:
// Android lists bod@example.com, iOS lists bob@example.com), which is exactly
// the kind of difference that must not reach a test title — a title is a Qase
// case's identity (ADR-0044).

import { byPlatform } from '@utils/platform';

export const LISTED_PASSWORD = '10203040';

export const STANDARD_USER = {
  get username(): string {
    return byPlatform({ android: 'bod@example.com', ios: 'bob@example.com' });
  },
  password: LISTED_PASSWORD,
};

// Android rejects this account with a lockout message. On iOS 2.2.2 the same
// account signs in — reported 2026-09-25, not filed.
export const LOCKED_OUT_USER = {
  username: 'alice@example.com',
  password: LISTED_PASSWORD,
  message: 'Sorry this user has been locked out.',
};
