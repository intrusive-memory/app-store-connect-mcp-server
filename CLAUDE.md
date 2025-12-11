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

## Xcode Cloud CI/CD API

This MCP server provides comprehensive support for Xcode Cloud CI/CD operations through the App Store Connect API.

### API Documentation References

- **Apple Developer Documentation**: https://developer.apple.com/documentation/appstoreconnectapi
- **Implementation Guide**: https://www.polpiella.dev/using-app-store-connect-api-to-trigger-xcode-cloud-workflows
- **WWDC24 Session**: https://developer.apple.com/videos/play/wwdc2024/10200/

### Available Xcode Cloud Tools

**CI Products**:
- `list_ci_products` - List all apps/frameworks configured for Xcode Cloud
- `get_ci_product` - Get details about a specific CI product

**CI Workflows**:
- `list_ci_workflows` - List all workflows for a product
- `get_ci_workflow` - Get details about a specific workflow

**CI Build Runs**:
- `list_ci_build_runs` - List build runs for a workflow or product
- `get_ci_build_run` - Get details about a specific build run
- `start_ci_build_run` - Start a new build run for a workflow
- `cancel_ci_build_run` - Cancel a running build

**CI Build Actions**:
- `list_ci_build_actions` - List actions (build, test, analyze, archive) for a build run
- `get_ci_build_action` - Get details about a specific action

**Debugging & Monitoring**:
- `list_ci_issues` - List errors, warnings, and test failures for a build action
- `list_ci_test_results` - List test results for a test action
- `list_ci_artifacts` - List build artifacts (logs, archives)
- `download_ci_artifact` - Get download URL for an artifact
- `get_build_runs_summary` - Get a summary with statistics for recent builds
- `get_build_failure_details` - Get detailed failure information for debugging

**Git References**:
- `list_git_references` - List branches and tags for a repository

### Build Status Values

**executionProgress** (describes if the build is running):
- `PENDING` - Build is queued
- `RUNNING` - Build is in progress
- `COMPLETE` - Build has finished

**completionStatus** (describes the outcome):
- `SUCCEEDED` - Build completed successfully
- `FAILED` - Build failed
- `ERRORED` - Build encountered an error
- `CANCELED` - Build was cancelled
- `SKIPPED` - Build was skipped

### Example: Debugging a Failed Build

```
1. List recent builds: list_ci_build_runs (with workflowId)
2. Find failed build ID from the response
3. Get failure details: get_build_failure_details (with buildRunId)
4. Review issues, test failures, and error messages
5. Download logs: list_ci_artifacts then download_ci_artifact
```

## Development

### Running Tests

```bash
npm run test           # Run tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

### CI/CD

This project uses GitHub Actions for continuous integration. The CI workflow:
- Runs on all pull requests to `main`
- Runs on pushes to `main`
- Executes the full test suite

Branch protection rules require:
- All CI tests must pass before merging to `main`
- Changes must go through pull requests (no direct pushes to `main`)
