/*
 * This file is a template for the code which will be substituted when our webpack loader handles API files in the
 * `pages/` directory.
 *
 * We use `__SENTRY_WRAPPING_TARGET_FILE__` as a placeholder for the path to the file being wrapped. Because it's not a real package,
 * this causes both TS and ESLint to complain, hence the pragma comments below.
 */

// @ts-ignore See above
// eslint-disable-next-line import/no-unresolved
import * as origModule from '__SENTRY_WRAPPING_TARGET_FILE__';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as Sentry from '@sentry/nextjs';
import type { PageConfig } from 'next';

import type { VercelCronsConfig } from '../../common/types';
// We import this from `wrappers` rather than directly from `next` because our version can work simultaneously with
// multiple versions of next. See note in `wrappers/types` for more.
import type { NextApiHandler } from '../../server/types';

type NextApiModule = (
  | {
      // ESM export
      default?: NextApiHandler;
    }
  // CJS export
  | NextApiHandler
) & { config?: PageConfig };

const userApiModule = origModule as NextApiModule;

// Default to undefined. It's possible for Next.js users to not define any exports/handlers in an API route. If that is
// the case Next.js wil crash during runtime but the Sentry SDK should definitely not crash so we need tohandle it.
let userProvidedHandler = undefined;

if ('default' in userApiModule && typeof userApiModule.default === 'function') {
  // Handle when user defines via ESM export: `export default myFunction;`
  userProvidedHandler = userApiModule.default;
} else if (typeof userApiModule === 'function') {
  // Handle when user defines via CJS export: "module.exports = myFunction;"
  userProvidedHandler = userApiModule;
}

const origConfig = userApiModule.config || {};

// Setting `externalResolver` to `true` prevents nextjs from throwing a warning in dev about API routes resolving
// without sending a response. It's a false positive (a response is sent, but only after we flush our send queue), and
// we throw a warning of our own to tell folks that, but it's better if we just don't have to deal with it in the first
// place.
export const config = {
  ...origConfig,
  api: {
    ...origConfig.api,
    externalResolver: true,
  },
};

declare const __VERCEL_CRONS_CONFIGURATION__: VercelCronsConfig;

let wrappedHandler = userProvidedHandler;

if (wrappedHandler) {
  wrappedHandler = Sentry.wrapApiHandlerWithSentry(wrappedHandler, '__ROUTE__');
}

if (wrappedHandler && __VERCEL_CRONS_CONFIGURATION__) {
  wrappedHandler = Sentry.wrapApiHandlerWithSentryVercelCrons(wrappedHandler, __VERCEL_CRONS_CONFIGURATION__);
}

export default wrappedHandler;

// Re-export anything exported by the page module we're wrapping. When processing this code, Rollup is smart enough to
// not include anything whose name matchs something we've explicitly exported above.
// @ts-ignore See above
// eslint-disable-next-line import/no-unresolved
export * from '__SENTRY_WRAPPING_TARGET_FILE__';
