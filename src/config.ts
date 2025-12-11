/**
 * Centralized configuration module for App Store Connect MCP Server
 *
 * This module handles all environment variable loading and validation
 * for connecting to the App Store Connect API using Bearer token authentication.
 *
 * Configuration can be provided via:
 * 1. A .env file in the module's directory (supports variable substitution)
 * 2. Environment variables set in the shell
 * 3. Environment variables passed by the MCP client (e.g., Claude Desktop)
 *
 * Required Environment Variables:
 * - APP_STORE_CONNECT_KEY_ID: The Key ID from App Store Connect API Keys
 * - APP_STORE_CONNECT_ISSUER_ID: The Issuer ID from App Store Connect API Keys
 * - APP_STORE_CONNECT_P8_PATH: Absolute path to the .p8 private key file
 *
 * Optional Environment Variables:
 * - APP_STORE_CONNECT_VENDOR_NUMBER: Vendor number for sales/finance reports
 *
 * Variable Substitution in .env:
 * You can reference other variables and system environment variables:
 *   HOME=/Users/myuser
 *   APP_STORE_CONNECT_P8_PATH=${HOME}/.appstore/AuthKey.p8
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { AppStoreConnectConfig } from './types/index.js';

// Get the directory where this module is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find the module root (where package.json lives)
// In development: src/config.ts -> module root is parent
// In production: dist/src/config.js -> module root is grandparent
const moduleRoot = __dirname.includes('dist')
  ? path.resolve(__dirname, '..', '..')
  : path.resolve(__dirname, '..');

/**
 * Loads environment variables from the .env file in the module's directory
 * Supports variable substitution (e.g., ${HOME}, ${VAR_NAME})
 */
function loadEnvFile(): void {
  const envPath = path.join(moduleRoot, '.env');

  // Check if .env file exists
  if (fs.existsSync(envPath)) {
    // Load the .env file
    const env = dotenv.config({ path: envPath });

    // Expand variables (supports ${VAR} substitution)
    dotenvExpand.expand(env);
  }
}

// Environment variable names as constants
export const ENV_VARS = {
  KEY_ID: 'APP_STORE_CONNECT_KEY_ID',
  ISSUER_ID: 'APP_STORE_CONNECT_ISSUER_ID',
  P8_PATH: 'APP_STORE_CONNECT_P8_PATH',
  VENDOR_NUMBER: 'APP_STORE_CONNECT_VENDOR_NUMBER',
} as const;

/**
 * Configuration validation errors
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validates that all required environment variables are set
 * @throws ConfigurationError if any required variable is missing
 */
function validateRequiredEnvVars(): void {
  const missing: string[] = [];

  if (!process.env[ENV_VARS.KEY_ID]) {
    missing.push(ENV_VARS.KEY_ID);
  }
  if (!process.env[ENV_VARS.ISSUER_ID]) {
    missing.push(ENV_VARS.ISSUER_ID);
  }
  if (!process.env[ENV_VARS.P8_PATH]) {
    missing.push(ENV_VARS.P8_PATH);
  }

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables for App Store Connect API authentication:\n` +
      `  ${missing.join('\n  ')}\n\n` +
      `Please set these environment variables before starting the server.\n` +
      `See README.md for configuration instructions.`
    );
  }
}

/**
 * Validates that the P8 private key file exists and is readable
 * @throws ConfigurationError if the file doesn't exist or isn't readable
 */
function validateP8KeyFile(path: string): void {
  try {
    fs.accessSync(path, fs.constants.R_OK);
  } catch {
    throw new ConfigurationError(
      `Cannot read P8 private key file at: ${path}\n` +
      `Please ensure the file exists and is readable.\n` +
      `Set the correct path in ${ENV_VARS.P8_PATH} environment variable.`
    );
  }
}

/**
 * Loads and validates the configuration from environment variables
 * First loads from .env file if present, then validates
 * @returns Validated AppStoreConnectConfig
 * @throws ConfigurationError if validation fails
 */
export function loadConfig(): AppStoreConnectConfig {
  // Load .env file first (if present) - supports variable substitution
  loadEnvFile();

  // Then validate that all required env vars are set
  validateRequiredEnvVars();

  const keyId = process.env[ENV_VARS.KEY_ID]!;
  const issuerId = process.env[ENV_VARS.ISSUER_ID]!;
  const privateKeyPath = process.env[ENV_VARS.P8_PATH]!;
  const vendorNumber = process.env[ENV_VARS.VENDOR_NUMBER];

  // Validate the P8 key file exists
  validateP8KeyFile(privateKeyPath);

  return {
    keyId,
    issuerId,
    privateKeyPath,
    vendorNumber,
  };
}

// Singleton config instance - loaded once at module initialization
let _config: AppStoreConnectConfig | null = null;

/**
 * Gets the application configuration (lazy-loaded singleton)
 * @returns The validated configuration
 * @throws ConfigurationError if configuration is invalid
 */
export function getConfig(): AppStoreConnectConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Resets the configuration (useful for testing)
 */
export function resetConfig(): void {
  _config = null;
}
