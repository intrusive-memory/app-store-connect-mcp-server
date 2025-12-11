import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import { AppStoreConnectConfig } from '../types/index.js';
import { getConfig, ConfigurationError } from '../config.js';

/**
 * AuthService handles JWT Bearer token generation for App Store Connect API
 *
 * The App Store Connect API uses JWT (JSON Web Token) authentication with ES256 algorithm.
 * Tokens are valid for up to 20 minutes per Apple's specification.
 *
 * Token structure:
 * - algorithm: ES256 (ECDSA with SHA-256)
 * - audience: 'appstoreconnect-v1'
 * - issuer: Issuer ID from App Store Connect
 * - keyid: Key ID from App Store Connect API Keys
 * - expiry: 20 minutes from generation time
 */
export class AuthService {
  private config: AppStoreConnectConfig;
  private cachedPrivateKey: string | null = null;

  constructor(config?: AppStoreConnectConfig) {
    // Use provided config or get from centralized config
    this.config = config ?? getConfig();
  }

  /**
   * Generates a JWT Bearer token for App Store Connect API authentication
   * @returns Promise<string> The signed JWT token
   * @throws Error if private key cannot be read or token generation fails
   */
  async generateToken(): Promise<string> {
    // Cache the private key to avoid repeated file I/O
    if (!this.cachedPrivateKey) {
      this.cachedPrivateKey = await fs.readFile(this.config.privateKeyPath, 'utf-8');
    }

    const token = jwt.sign({}, this.cachedPrivateKey, {
      algorithm: 'ES256',
      expiresIn: '20m', // App Store Connect tokens can be valid for up to 20 minutes
      audience: 'appstoreconnect-v1',
      keyid: this.config.keyId,
      issuer: this.config.issuerId,
    });

    return token;
  }

  /**
   * @deprecated Use getConfig() from config.ts for validation at startup
   * This method is kept for backwards compatibility
   */
  validateConfig(): void {
    if (!this.config.keyId || !this.config.issuerId || !this.config.privateKeyPath) {
      throw new ConfigurationError(
        "Missing required environment variables. Please set: " +
        "APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_P8_PATH"
      );
    }
  }
}