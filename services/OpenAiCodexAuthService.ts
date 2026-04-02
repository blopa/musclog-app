import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { OPENAI_CODEX_CONFIG } from '../constants/ai';

WebBrowser.maybeCompleteAuthSession();

const TOKENS_KEY = 'openai_codex_tokens';

export type CodexTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp in ms
};

export class OpenAiCodexAuthService {
  /**
   * Initiates the OAuth 2.0 PKCE login flow for OpenAI Codex.
   */
  static async login(): Promise<boolean> {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'com.werules.logger',
        path: 'oauth',
      });

      const discovery = {
        authorizationEndpoint: `${OPENAI_CODEX_CONFIG.issuer}/v1/authorize`,
        tokenEndpoint: `${OPENAI_CODEX_CONFIG.issuer}/v1/token`,
      };

      const request = new AuthSession.AuthRequest({
        clientId: OPENAI_CODEX_CONFIG.clientId,
        scopes: OPENAI_CODEX_CONFIG.scopes,
        redirectUri,
        usePKCE: true,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success') {
        const { code } = result.params;
        const { codeVerifier } = request;

        if (!codeVerifier) {
          throw new Error('Code verifier is missing');
        }

        const response = await AuthSession.exchangeCodeAsync(
          {
            clientId: OPENAI_CODEX_CONFIG.clientId,
            code,
            redirectUri,
            extraParams: {
              code_verifier: codeVerifier,
            },
          },
          discovery
        );

        if (response.accessToken) {
          const expiresAt = Date.now() + (response.expiresIn || 3600) * 1000;
          await this.saveTokens({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt,
          });
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[OpenAiCodexAuthService] Login error:', error);
      return false;
    }
  }

  /**
   * Refreshes the access token using the refresh token.
   */
  static async refreshToken(): Promise<string | null> {
    try {
      const tokens = await this.getTokens();
      if (!tokens || !tokens.refreshToken) {
        return null;
      }

      const discovery = {
        authorizationEndpoint: `${OPENAI_CODEX_CONFIG.issuer}/v1/authorize`,
        tokenEndpoint: `${OPENAI_CODEX_CONFIG.issuer}/v1/token`,
      };

      const response = await AuthSession.refreshAsync(
        {
          clientId: OPENAI_CODEX_CONFIG.clientId,
          refreshToken: tokens.refreshToken,
        },
        discovery
      );

      if (response.accessToken) {
        const expiresAt = Date.now() + (response.expiresIn || 3600) * 1000;
        await this.saveTokens({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken || tokens.refreshToken,
          expiresAt,
        });
        return response.accessToken;
      }
      return null;
    } catch (error) {
      console.error('[OpenAiCodexAuthService] Refresh error:', error);
      await this.logout();
      return null;
    }
  }

  /**
   * Returns a valid access token, refreshing it if necessary.
   */
  static async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    if (!tokens) {
      return null;
    }

    // Refresh if expiring within 5 minutes
    if (Date.now() + 5 * 60 * 1000 >= tokens.expiresAt) {
      return await this.refreshToken();
    }

    return tokens.accessToken;
  }

  /**
   * Clears all stored tokens.
   */
  static async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  }

  /**
   * Checks if the user is currently connected to Codex.
   */
  static async isConnected(): Promise<boolean> {
    const tokens = await this.getTokens();
    return !!tokens;
  }

  // --- Private Helpers ---

  private static async saveTokens(tokens: CodexTokens): Promise<void> {
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
  }

  private static async getTokens(): Promise<CodexTokens | null> {
    const data = await SecureStore.getItemAsync(TOKENS_KEY);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data) as CodexTokens;
    } catch {
      return null;
    }
  }
}
