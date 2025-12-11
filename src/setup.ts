#!/usr/bin/env node

/**
 * Setup script for App Store Connect MCP Server
 *
 * This script scans the current environment for variables that match
 * the patterns needed for App Store Connect API authentication and
 * creates a .env file that references them by name (never storing actual values).
 *
 * SECURITY: This script NEVER prints or stores actual credential values.
 * The .env file only contains references like ${EXISTING_VAR_NAME}.
 *
 * Usage:
 *   npm run setup           # Interactive mode
 *   npm run setup -- --auto # Auto-select best matches (non-interactive)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Check for --auto flag
const AUTO_MODE = process.argv.includes('--auto');

// Get the directory where this module is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find the module root
const moduleRoot = __dirname.includes('dist')
  ? path.resolve(__dirname, '..', '..')
  : path.resolve(__dirname, '..');

// Patterns to search for in environment variable names (ordered by priority - most specific first)
const PATTERNS = {
  KEY_ID: [
    /^APP_STORE.*KEY.*ID$/i,      // Exact App Store Key ID match (highest priority)
    /^ASC.*KEY.*ID$/i,            // ASC Key ID
    /app.?store.*key/i,           // App Store with key
    /asc.*key/i,                  // ASC with key
    /key.?id/i,                   // Generic key id
  ],
  ISSUER_ID: [
    /^APP_STORE.*ISSUER.*ID$/i,   // Exact App Store Issuer ID match
    /^ASC.*ISSUER/i,              // ASC Issuer
    /app.?store.*issuer/i,        // App Store with issuer
    /issuer/i,                    // Generic issuer
  ],
  P8_PATH: [
    /^APP_STORE.*P8/i,            // Exact App Store P8 match
    /^APP_STORE.*PRIVATE.*KEY.*PATH$/i, // App Store Private Key Path
    /^ASC.*P8/i,                  // ASC P8
    /^ASC.*KEY.*PATH$/i,          // ASC Key Path
    /p8.*path/i,                  // P8 path
    /private.?key.*path/i,        // Private key path
    /auth.?key.*path/i,           // Auth key path
  ],
  VENDOR_NUMBER: [
    /^APP_STORE.*VENDOR/i,        // Exact App Store Vendor match
    /^ASC.*VENDOR/i,              // ASC Vendor
    /vendor.*number/i,            // Vendor number
    /vendor/i,                    // Generic vendor
  ],
};

// Target variable names for the .env file
const TARGET_VARS = {
  KEY_ID: 'APP_STORE_CONNECT_KEY_ID',
  ISSUER_ID: 'APP_STORE_CONNECT_ISSUER_ID',
  P8_PATH: 'APP_STORE_CONNECT_P8_PATH',
  VENDOR_NUMBER: 'APP_STORE_CONNECT_VENDOR_NUMBER',
};

interface FoundVariable {
  envName: string;
  targetVar: string;
  category: string;
  priority: number; // Lower = higher priority (matched earlier pattern)
}

/**
 * Scans environment variables for matches against our patterns
 * NEVER accesses or prints the actual values
 * Results are sorted by priority (most specific matches first)
 */
function scanEnvironmentVariables(): Map<string, FoundVariable[]> {
  const results = new Map<string, FoundVariable[]>();

  for (const [category, patterns] of Object.entries(PATTERNS)) {
    const matches: FoundVariable[] = [];

    for (const envName of Object.keys(process.env)) {
      // Check if this env var name matches any of our patterns
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(envName)) {
          matches.push({
            envName,
            targetVar: TARGET_VARS[category as keyof typeof TARGET_VARS],
            category,
            priority: i, // Earlier patterns have higher priority (lower number)
          });
          break; // Don't add the same var multiple times
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    matches.sort((a, b) => a.priority - b.priority);
    results.set(category, matches);
  }

  return results;
}

/**
 * Auto-selects the best match for each category (highest priority)
 */
function autoSelectMatches(matches: Map<string, FoundVariable[]>): Map<string, string | null> {
  const selections = new Map<string, string | null>();

  for (const [category, foundVars] of matches) {
    if (foundVars.length > 0) {
      // Select the highest priority match (first in sorted list)
      selections.set(category, foundVars[0].envName);
    } else {
      selections.set(category, null);
    }
  }

  return selections;
}

/**
 * Creates a readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts the user to select from a list of options
 */
async function promptSelection(
  rl: readline.Interface,
  category: string,
  targetVar: string,
  options: string[],
  required: boolean
): Promise<string | null> {
  return new Promise((resolve) => {
    console.log(`\n${required ? '(Required)' : '(Optional)'} ${targetVar}:`);

    if (options.length === 0) {
      if (required) {
        console.log('  ⚠️  No matching environment variables found.');
        console.log('  Please enter the name of an environment variable to use:');
        rl.question('  > ', (answer) => {
          resolve(answer.trim() || null);
        });
      } else {
        console.log('  No matching environment variables found. Skipping.');
        resolve(null);
      }
      return;
    }

    console.log('  Found matching environment variables:');
    options.forEach((opt, idx) => {
      console.log(`    ${idx + 1}. ${opt}`);
    });
    console.log(`    ${options.length + 1}. Enter a different variable name`);
    if (!required) {
      console.log(`    ${options.length + 2}. Skip (leave unset)`);
    }

    rl.question('  Select an option: ', (answer) => {
      const selection = parseInt(answer.trim(), 10);

      if (selection >= 1 && selection <= options.length) {
        resolve(options[selection - 1]);
      } else if (selection === options.length + 1) {
        rl.question('  Enter environment variable name: ', (customVar) => {
          resolve(customVar.trim() || null);
        });
      } else if (!required && selection === options.length + 2) {
        resolve(null);
      } else {
        // Default to first option if available
        resolve(options.length > 0 ? options[0] : null);
      }
    });
  });
}

/**
 * Generates the .env file content
 * NEVER includes actual values, only variable references
 */
function generateEnvFileContent(selections: Map<string, string | null>): string {
  const lines: string[] = [
    '# App Store Connect MCP Server Configuration',
    '# Generated by setup script',
    '#',
    '# SECURITY: This file contains references to environment variables,',
    '# not actual credential values. The referenced variables must be set',
    '# in your shell environment.',
    '',
  ];

  // Required variables
  const keyId = selections.get('KEY_ID');
  const issuerId = selections.get('ISSUER_ID');
  const p8Path = selections.get('P8_PATH');
  const vendorNumber = selections.get('VENDOR_NUMBER');

  lines.push('# Required variables');
  if (keyId) {
    lines.push(`${TARGET_VARS.KEY_ID}=\${${keyId}}`);
  } else {
    lines.push(`# ${TARGET_VARS.KEY_ID}=\${YOUR_KEY_ID_VAR}`);
  }

  if (issuerId) {
    lines.push(`${TARGET_VARS.ISSUER_ID}=\${${issuerId}}`);
  } else {
    lines.push(`# ${TARGET_VARS.ISSUER_ID}=\${YOUR_ISSUER_ID_VAR}`);
  }

  if (p8Path) {
    lines.push(`${TARGET_VARS.P8_PATH}=\${${p8Path}}`);
  } else {
    lines.push(`# ${TARGET_VARS.P8_PATH}=\${YOUR_P8_PATH_VAR}`);
  }

  lines.push('');
  lines.push('# Optional variables');
  if (vendorNumber) {
    lines.push(`${TARGET_VARS.VENDOR_NUMBER}=\${${vendorNumber}}`);
  } else {
    lines.push(`# ${TARGET_VARS.VENDOR_NUMBER}=\${YOUR_VENDOR_NUMBER_VAR}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Main setup function
 */
async function setup(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     App Store Connect MCP Server - Setup                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('This script will help you configure the MCP server by');
  console.log('detecting environment variables that match the required');
  console.log('App Store Connect API credentials.');
  console.log('');
  console.log('🔒 SECURITY: Actual credential values are NEVER displayed');
  console.log('   or stored. Only variable names are used.');
  console.log('');

  if (AUTO_MODE) {
    console.log('Running in AUTO mode - selecting best matches automatically.');
    console.log('');
  }

  // Scan for matching environment variables
  console.log('Scanning environment variables...');
  const matches = scanEnvironmentVariables();

  let selections: Map<string, string | null>;
  const envPath = path.join(moduleRoot, '.env');

  if (AUTO_MODE) {
    // Auto-select best matches
    selections = autoSelectMatches(matches);

    // Display what was selected
    console.log('\nAuto-selected environment variables:');
    for (const [category, envName] of selections) {
      const targetVar = TARGET_VARS[category as keyof typeof TARGET_VARS];
      if (envName) {
        console.log(`  ✓ ${targetVar} -> \${${envName}}`);
      } else {
        const isRequired = category !== 'VENDOR_NUMBER';
        console.log(`  ${isRequired ? '⚠️' : '○'} ${targetVar} -> (not found)`);
      }
    }

    // In auto mode, always overwrite
    if (fs.existsSync(envPath)) {
      console.log('\nOverwriting existing .env file...');
    }
  } else {
    // Interactive mode
    const rl = createReadlineInterface();
    selections = new Map<string, string | null>();

    try {
      // Prompt for each required variable
      const keyIdOptions = matches.get('KEY_ID')?.map((m) => m.envName) ?? [];
      selections.set(
        'KEY_ID',
        await promptSelection(rl, 'KEY_ID', TARGET_VARS.KEY_ID, keyIdOptions, true)
      );

      const issuerIdOptions = matches.get('ISSUER_ID')?.map((m) => m.envName) ?? [];
      selections.set(
        'ISSUER_ID',
        await promptSelection(rl, 'ISSUER_ID', TARGET_VARS.ISSUER_ID, issuerIdOptions, true)
      );

      const p8PathOptions = matches.get('P8_PATH')?.map((m) => m.envName) ?? [];
      selections.set(
        'P8_PATH',
        await promptSelection(rl, 'P8_PATH', TARGET_VARS.P8_PATH, p8PathOptions, true)
      );

      // Optional variable
      const vendorOptions = matches.get('VENDOR_NUMBER')?.map((m) => m.envName) ?? [];
      selections.set(
        'VENDOR_NUMBER',
        await promptSelection(rl, 'VENDOR_NUMBER', TARGET_VARS.VENDOR_NUMBER, vendorOptions, false)
      );

      // Check if .env already exists
      if (fs.existsSync(envPath)) {
        const overwrite = await new Promise<boolean>((resolve) => {
          rl.question('\n.env file already exists. Overwrite? (y/N): ', (answer) => {
            resolve(answer.toLowerCase() === 'y');
          });
        });

        if (!overwrite) {
          console.log('\nSetup cancelled. Existing .env file preserved.');
          rl.close();
          return;
        }
      }
    } finally {
      rl.close();
    }
  }

  // Generate and write .env file
  const envContent = generateEnvFileContent(selections);
  fs.writeFileSync(envPath, envContent, 'utf-8');

  console.log('\n✅ .env file created successfully!');
  console.log(`   Location: ${envPath}`);
  console.log('');
  console.log('Make sure the referenced environment variables are set');
  console.log('in your shell before starting the MCP server.');
}

// Run setup
setup().catch((error) => {
  console.error('Setup failed:', error.message);
  process.exit(1);
});
