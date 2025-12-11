# Claude Instructions for App Store Connect MCP Server

## Security - CRITICAL

### NEVER PRINT THE STRING VALUES OF THE KEYS TO THE SCREEN

This includes:
- **NEVER** echo, print, display, or log the actual values of:
  - `APP_STORE_CONNECT_KEY_ID`
  - `APP_STORE_CONNECT_ISSUER_ID`
  - `APP_STORE_CONNECT_P8_PATH` contents
  - `APP_STORE_CONNECT_VENDOR_NUMBER`
  - Any `.p8` private key file contents
  - Any JWT tokens or Bearer tokens

- **NEVER** run commands like:
  - `echo $APP_STORE_CONNECT_KEY_ID`
  - `cat *.p8`
  - `printenv | grep APP_STORE`
  - Any command that would expose credential values

- When checking if environment variables are set, use existence checks only:
  ```bash
  # CORRECT - check existence without revealing value
  test -n "$APP_STORE_CONNECT_KEY_ID" && echo "KEY_ID is set"

  # WRONG - exposes the actual value
  echo $APP_STORE_CONNECT_KEY_ID
  ```

- When verifying the `.p8` file, only check that it exists:
  ```bash
  # CORRECT
  test -f "$APP_STORE_CONNECT_P8_PATH" && echo "P8 file exists"

  # WRONG - exposes private key
  cat "$APP_STORE_CONNECT_P8_PATH"
  ```

## Configuration

The MCP server uses a `.env` file that references environment variables by name, never storing actual values:

```bash
# CORRECT .env format - references variables
APP_STORE_CONNECT_KEY_ID=${MY_KEY_ID_VAR}
APP_STORE_CONNECT_P8_PATH=${HOME}/.appstore/AuthKey.p8

# WRONG - never store actual values
APP_STORE_CONNECT_KEY_ID=ABC123DEF4
```

## Setup

Run the setup script to configure the server:
```bash
npm run setup
```

This will scan for matching environment variables and create a safe `.env` file.
