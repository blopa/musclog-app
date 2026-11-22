import * as Sentry from '@sentry/cloudflare';
import { createApp } from './app';
import { sentryOptions } from './sentry';

export default Sentry.withSentry(sentryOptions, createApp());
