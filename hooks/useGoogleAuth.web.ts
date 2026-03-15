/**
 * Web-specific Google OAuth using Implicit Grant Flow.
 * Opens Google auth in a popup and uses BroadcastChannel to pass the token
 * back to the opener, avoiding COOP/CSP issues from polling window.closed.
 *
 * Implicit flow doesn't provide a refresh_token — users re-authenticate when the token expires.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GOOGLE_SCOPES } from '../constants/misc';
import { getGoogleClientId, handleGoogleSignIn } from '../utils/googleAuth';
import { showSnackbar } from '../utils/snackbarService';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const BROADCAST_CHANNEL_NAME = 'google_auth';

export type GoogleAuthData = {
  access_token: string;
  expires_in: number;
  refresh_token: string; // Always empty for implicit flow
  scope: string;
  token_type: string;
};

const getRedirectUri = () => {
  let { pathname } = window.location;
  if (pathname.endsWith('/') && pathname.length > 1) {
    pathname = pathname.slice(0, -1);
  }
  return window.location.origin + (pathname === '/' ? '' : pathname);
};

const parseTokenFromHash = (url: string): GoogleAuthData | null => {
  try {
    const hash = url.split('#')[1];
    if (!hash) {
      return null;
    }

    const params = new URLSearchParams(hash);
    const error = params.get('error');
    if (error) {
      throw new Error(params.get('error_description') || error);
    }

    const accessToken = params.get('access_token');
    if (!accessToken) {
      return null;
    }

    return {
      access_token: accessToken,
      expires_in: parseInt(params.get('expires_in') || '3600', 10),
      refresh_token: '',
      scope: params.get('scope') || GOOGLE_SCOPES,
      token_type: params.get('token_type') || 'Bearer',
    };
  } catch {
    return null;
  }
};

export const useGoogleAuth = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { t } = useTranslation();

  // Runs in the popup after Google redirects back — broadcasts token then closes.
  useEffect(() => {
    const { hash } = window.location;
    if (!hash.includes('access_token')) {
      return;
    }

    const tokenData = parseTokenFromHash(window.location.href);
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + window.location.search
    );

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.postMessage(
      tokenData
        ? { type: 'AUTH_SUCCESS', data: tokenData }
        : { type: 'AUTH_ERROR', error: 'Failed to parse access token' }
    );
    channel.close();
    window.close();
  }, []);

  const promptAsync = async () => {
    try {
      setIsSigningIn(true);

      const authUrl = `${GOOGLE_AUTH_URL}?${new URLSearchParams({
        client_id: getGoogleClientId(),
        include_granted_scopes: 'true',
        redirect_uri: getRedirectUri(),
        response_type: 'token',
        scope: GOOGLE_SCOPES,
      })}`;

      const popup = window.open(
        authUrl,
        'google_auth_popup',
        'width=520,height=620,left=200,top=100,resizable=yes,scrollbars=yes'
      );
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      await new Promise<void>((resolve, reject) => {
        let channel: BroadcastChannel | null = null;

        const cleanup = () => {
          channel?.close();
          channel = null;
          window.removeEventListener('focus', onFocus);
        };

        // When the main window regains focus, the popup was likely closed without completing auth.
        // We can't check popup.closed directly due to COOP, so use the focus event as a signal.
        const onFocus = () => {
          setTimeout(() => {
            if (channel) {
              cleanup();
              resolve();
            } // dismissed — not an error
          }, 200);
        };

        channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = async (event) => {
          if (event.data.type === 'AUTH_SUCCESS') {
            try {
              await handleGoogleSignIn(event.data.data);
            } catch (e) {
              console.error('Failed to persist Google sign-in data:', e);
            }
            cleanup();
            resolve();
          } else if (event.data.type === 'AUTH_ERROR') {
            cleanup();
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('focus', onFocus);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar('error', t('snackbar.googleAuth.signInError', { error: errorMessage }));
    } finally {
      setIsSigningIn(false);
    }
  };

  return { isSigningIn, promptAsync };
};
