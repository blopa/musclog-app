/**
 * Web-specific Google OAuth implementation using Implicit Grant Flow
 * Based on: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 *
 * Opens Google auth in a new popup window. Uses BroadcastChannel to receive
 * the token back from the popup once the redirect lands on our origin, avoiding
 * any COOP/CSP issues that arise from polling window.closed on a cross-origin popup.
 *
 * Note: Implicit flow doesn't provide refresh_token, so users will need to re-authenticate
 * when the access token expires. This is the only way to do pure client-side OAuth without a backend.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GOOGLE_SCOPES } from '../constants/misc';
import { getGoogleClientId, handleGoogleSignIn } from '../utils/googleAuth';
import { showSnackbar } from '../utils/snackbarService';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const BROADCAST_CHANNEL_NAME = 'google_auth';

export type GoogleAuthData = {
  access_token: string;
  expires_in: number;
  refresh_token: string; // Will be empty string for implicit flow
  scope: string;
  token_type: string;
};

// Web redirect URI - will be constructed dynamically based on current origin
const getWebRedirectUri = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  // Normalize the redirect URI: always remove trailing slash
  let { pathname } = window.location;
  if (pathname.endsWith('/') && pathname.length > 1) {
    pathname = pathname.slice(0, -1);
  }

  return window.location.origin + (pathname === '/' ? '' : pathname);
};

// Parse access token from URL fragment (hash)
const parseTokenFromUrl = (url: string): GoogleAuthData | null => {
  try {
    const hash = url.split('#')[1];
    if (!hash) {
      return null;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    const scope = params.get('scope');
    const tokenType = params.get('token_type');
    const error = params.get('error');

    if (error) {
      throw new Error(params.get('error_description') || error);
    }

    if (!accessToken) {
      return null;
    }

    return {
      access_token: accessToken,
      expires_in: parseInt(expiresIn || '3600', 10),
      refresh_token: '', // Implicit flow doesn't provide refresh_token
      scope: scope || GOOGLE_SCOPES,
      token_type: tokenType || 'Bearer',
    };
  } catch (error) {
    return null;
  }
};

export const useGoogleAuth = () => {
  const [authData, setAuthData] = useState<GoogleAuthData | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { t } = useTranslation();
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const { hash } = window.location;

    if (hash && hash.includes('access_token')) {
      // We're inside the OAuth redirect — broadcast token to opener and close
      const tokenData = parseTokenFromUrl(window.location.href);

      // Clean up URL fragment regardless of parse result
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );

      if (tokenData) {
        try {
          const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          channel.postMessage({ type: 'AUTH_SUCCESS', data: tokenData });
          channel.close();
        } catch {
          // BroadcastChannel not available — fall back to setting state directly
          setAuthData(tokenData);
        }

        // Close the popup. window.close() is silently ignored on non-script-opened windows,
        // so this is safe to call unconditionally. COOP severs window.opener when the popup
        // navigates cross-origin (to Google) and back, so we can't rely on window.opener.
        window.close();
      } else {
        try {
          const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          channel.postMessage({ type: 'AUTH_ERROR', error: 'Failed to parse access token' });
          channel.close();
        } catch {
          // ignore
        }

        window.close();
      }
    }
  }, []);

  const promptAsync = async () => {
    if (typeof window === 'undefined') {
      throw new Error('Web OAuth is only available on web platform');
    }

    try {
      setIsSigningIn(true);

      const redirectUri = getWebRedirectUri();
      const clientId = getGoogleClientId();

      const params = new URLSearchParams({
        client_id: clientId,
        include_granted_scopes: 'true',
        redirect_uri: redirectUri,
        response_type: 'token', // Implicit flow — returns token directly in fragment
        scope: GOOGLE_SCOPES,
      });

      const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

      // Open in a popup — no polling of window.closed needed, so no COOP issues
      const popup = window.open(
        authUrl,
        'google_auth_popup',
        'width=520,height=620,left=200,top=100,resizable=yes,scrollbars=yes'
      );
      popupRef.current = popup;

      await new Promise<void>((resolve, reject) => {
        let channel: BroadcastChannel | null = null;

        const cleanup = () => {
          channel?.close();
          channel = null;
          window.removeEventListener('focus', onFocus);
        };

        // Detect token coming back from the popup via BroadcastChannel
        channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = async (event) => {
          if (event.data.type === 'AUTH_SUCCESS') {
            const tokenData: GoogleAuthData = event.data.data;
            try {
              // Persist token to AsyncStorage before resolving so that
              // ConnectGoogleAccountBody's checkForExistingToken finds it
              // as soon as isSigningIn flips back to false.
              await handleGoogleSignIn(tokenData);
            } catch (e) {
              console.error('Failed to persist Google sign-in data:', e);
            }
            setAuthData(tokenData);
            cleanup();
            resolve();
          } else if (event.data.type === 'AUTH_ERROR') {
            cleanup();
            reject(new Error(event.data.error));
          }
        };

        // When the main window regains focus the popup was likely closed by the user
        // without completing auth (we can't check popup.closed due to COOP)
        const onFocus = () => {
          // Give the BroadcastChannel a tick to deliver any in-flight message first
          setTimeout(() => {
            if (channel) {
              // Channel is still open, meaning no AUTH_SUCCESS/ERROR arrived → dismissed
              cleanup();
              resolve(); // treat as dismiss, not an error
            }
          }, 200);
        };

        window.addEventListener('focus', onFocus);

        if (!popup) {
          // Popup was blocked by the browser
          cleanup();
          reject(new Error('Popup blocked. Please allow popups for this site.'));
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar('error', t('snackbar.googleAuth.signInError', { error: errorMessage }));
    } finally {
      setIsSigningIn(false);
      popupRef.current = null;
    }
  };

  return {
    authData,
    isSigningIn,
    promptAsync,
  };
};
