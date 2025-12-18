#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';

import { AppStoreConnectConfig } from './types/index.js';
import { AppStoreConnectClient } from './services/index.js';
import {
  AppHandlers,
  BetaHandlers,
  BundleHandlers,
  DeviceHandlers,
  UserHandlers,
  AnalyticsHandlers,
  XcodeHandlers,
  LocalizationHandlers,
  XcodeCloudHandlers
} from './handlers/index.js';
import { getConfig, ConfigurationError, ENV_VARS } from './config.js';

// Validate configuration at startup - fail fast with clear error messages
let config: AppStoreConnectConfig;
try {
  config = getConfig();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(`\n❌ Configuration Error:\n${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

class AppStoreConnectServer {
  private server: Server;
  private client: AppStoreConnectClient;
  private appHandlers: AppHandlers;
  private betaHandlers: BetaHandlers;
  private bundleHandlers: BundleHandlers;
  private deviceHandlers: DeviceHandlers;
  private userHandlers: UserHandlers;
  private analyticsHandlers: AnalyticsHandlers;
  private xcodeHandlers: XcodeHandlers;
  private localizationHandlers: LocalizationHandlers;
  private xcodeCloudHandlers: XcodeCloudHandlers;

  constructor() {
    this.server = new Server({
      name: "appstore-connect-server",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.client = new AppStoreConnectClient(config);
    this.appHandlers = new AppHandlers(this.client);
    this.betaHandlers = new BetaHandlers(this.client);
    this.bundleHandlers = new BundleHandlers(this.client);
    this.deviceHandlers = new DeviceHandlers(this.client);
    this.userHandlers = new UserHandlers(this.client);
    this.analyticsHandlers = new AnalyticsHandlers(this.client, config);
    this.xcodeHandlers = new XcodeHandlers();
    this.localizationHandlers = new LocalizationHandlers(this.client);
    this.xcodeCloudHandlers = new XcodeCloudHandlers(this.client);

    this.setupHandlers();
  }

  private buildToolsList() {
    const baseTools = [
        // App Management Tools
        {
          name: "list_apps",
          description: "Get a list of all apps in App Store Connect",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of apps to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            }
          }
        },
        {
          name: "get_app_info",
          description: "Get detailed information about a specific app",
          inputSchema: {
            type: "object", 
            properties: {
              appId: {
                type: "string",
                description: "The ID of the app to get information for"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "appClips", "appInfos", "appStoreVersions", "availableTerritories",
                    "betaAppReviewDetail", "betaGroups", "betaLicenseAgreement", "builds",
                    "endUserLicenseAgreement", "gameCenterEnabledVersions", "inAppPurchases",
                    "preOrder", "prices", "reviewSubmissions"
                  ]
                },
                description: "Optional relationships to include in the response"
              }
            },
            required: ["appId"]
          }
        },

        // Beta Testing Tools
        {
          name: "list_beta_groups",
          description: "Get a list of all beta groups (internal and external)",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of groups to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            }
          }
        },
        {
          name: "list_group_testers",
          description: "Get a list of all testers in a specific beta group",
          inputSchema: {
            type: "object",
            properties: {
              groupId: {
                type: "string",
                description: "The ID of the beta group"
              },
              limit: {
                type: "number",
                description: "Maximum number of testers to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            },
            required: ["groupId"]
          }
        },
        {
          name: "add_tester_to_group",
          description: "Add a new tester to a beta group",
          inputSchema: {
            type: "object",
            properties: {
              groupId: {
                type: "string",
                description: "The ID of the beta group"
              },
              email: {
                type: "string",
                description: "Email address of the tester"
              },
              firstName: {
                type: "string",
                description: "First name of the tester"
              },
              lastName: {
                type: "string",
                description: "Last name of the tester"
              }
            },
            required: ["groupId", "email", "firstName", "lastName"]
          }
        },
        {
          name: "remove_tester_from_group",
          description: "Remove a tester from a beta group",
          inputSchema: {
            type: "object",
            properties: {
              groupId: {
                type: "string",
                description: "The ID of the beta group"
              },
              testerId: {
                type: "string",
                description: "The ID of the beta tester"
              }
            },
            required: ["groupId", "testerId"]
          }
        },
        {
          name: "list_beta_feedback_screenshots",
          description: "List all beta feedback screenshot submissions for an app. This includes feedback with screenshots, device information, and tester comments. You can identify the app using either appId or bundleId.",
          inputSchema: {
            type: "object",
            properties: {
              appId: {
                type: "string",
                description: "The ID of the app to get feedback for (e.g., '6747745091')"
              },
              bundleId: {
                type: "string",
                description: "The bundle ID of the app (e.g., 'com.example.app'). Can be used instead of appId."
              },
              buildId: {
                type: "string",
                description: "Filter by specific build ID (optional)"
              },
              devicePlatform: {
                type: "string",
                enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
                description: "Filter by device platform (optional)"
              },
              appPlatform: {
                type: "string",
                enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
                description: "Filter by app platform (optional)"
              },
              deviceModel: {
                type: "string",
                description: "Filter by device model (e.g., 'iPhone15_2') (optional)"
              },
              osVersion: {
                type: "string",
                description: "Filter by OS version (e.g., '18.4.1') (optional)"
              },
              testerId: {
                type: "string",
                description: "Filter by specific tester ID (optional)"
              },
              limit: {
                type: "number",
                description: "Maximum number of feedback items to return (default: 50, max: 200)",
                minimum: 1,
                maximum: 200
              },
              sort: {
                type: "string",
                enum: ["createdDate", "-createdDate"],
                description: "Sort order for results (default: -createdDate for newest first)"
              },
              includeBuilds: {
                type: "boolean",
                description: "Include build information in response (optional)",
                default: false
              },
              includeTesters: {
                type: "boolean",
                description: "Include tester information in response (optional)",
                default: false
              }
            },
            required: []
          }
        },
        {
          name: "get_beta_feedback_screenshot",
          description: "Get detailed information about a specific beta feedback screenshot submission. By default, downloads and returns the screenshot image.",
          inputSchema: {
            type: "object",
            properties: {
              feedbackId: {
                type: "string",
                description: "The ID of the beta feedback screenshot submission"
              },
              includeBuilds: {
                type: "boolean",
                description: "Include build information in response (optional)",
                default: false
              },
              includeTesters: {
                type: "boolean",
                description: "Include tester information in response (optional)",
                default: false
              },
              downloadScreenshot: {
                type: "boolean",
                description: "Download and return the screenshot as an image (default: true)",
                default: true
              }
            },
            required: ["feedbackId"]
          }
        },
        
        // App Store Version Localization Tools
        {
          name: "create_app_store_version",
          description: "Create a new app store version for an app",
          inputSchema: {
            type: "object",
            properties: {
              appId: {
                type: "string",
                description: "The ID of the app"
              },
              platform: {
                type: "string",
                description: "The platform for this version",
                enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"]
              },
              versionString: {
                type: "string",
                description: "Version string in format X.Y or X.Y.Z (e.g., '1.0' or '1.0.0')"
              },
              copyright: {
                type: "string",
                description: "Copyright text for this version (optional)"
              },
              releaseType: {
                type: "string",
                description: "How the app should be released",
                enum: ["MANUAL", "AFTER_APPROVAL", "SCHEDULED"]
              },
              earliestReleaseDate: {
                type: "string",
                description: "Earliest release date in ISO 8601 format (required when releaseType is SCHEDULED)"
              },
              buildId: {
                type: "string",
                description: "ID of the build to associate with this version (optional)"
              }
            },
            required: ["appId", "platform", "versionString"]
          }
        },
        {
          name: "list_app_store_versions",
          description: "Get all app store versions for a specific app",
          inputSchema: {
            type: "object",
            properties: {
              appId: {
                type: "string",
                description: "The ID of the app"
              },
              limit: {
                type: "number",
                description: "Maximum number of versions to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              filter: {
                type: "object",
                properties: {
                  platform: {
                    type: "string",
                    description: "Filter by platform (IOS, MAC_OS, TV_OS)",
                    enum: ["IOS", "MAC_OS", "TV_OS"]
                  },
                  versionString: {
                    type: "string",
                    description: "Filter by version string (e.g., '1.0.0')"
                  },
                  appStoreState: {
                    type: "string",
                    description: "Filter by app store state",
                    enum: [
                      "DEVELOPER_REMOVED_FROM_SALE",
                      "DEVELOPER_REJECTED", 
                      "IN_REVIEW",
                      "INVALID_BINARY",
                      "METADATA_REJECTED",
                      "PENDING_APPLE_RELEASE",
                      "PENDING_CONTRACT",
                      "PENDING_DEVELOPER_RELEASE",
                      "PREPARE_FOR_SUBMISSION",
                      "PREORDER_READY_FOR_SALE",
                      "PROCESSING_FOR_APP_STORE",
                      "READY_FOR_SALE",
                      "REJECTED",
                      "REMOVED_FROM_SALE",
                      "WAITING_FOR_EXPORT_COMPLIANCE",
                      "WAITING_FOR_REVIEW",
                      "REPLACED_WITH_NEW_VERSION"
                    ]
                  }
                },
                description: "Optional filters for app store versions"
              }
            },
            required: ["appId"]
          }
        },
        {
          name: "list_app_store_version_localizations",
          description: "Get all localizations for a specific app store version",
          inputSchema: {
            type: "object",
            properties: {
              appStoreVersionId: {
                type: "string",
                description: "The ID of the app store version"
              },
              limit: {
                type: "number",
                description: "Maximum number of localizations to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            },
            required: ["appStoreVersionId"]
          }
        },
        {
          name: "get_app_store_version_localization",
          description: "Get detailed information about a specific app store version localization",
          inputSchema: {
            type: "object",
            properties: {
              localizationId: {
                type: "string",
                description: "The ID of the app store version localization"
              }
            },
            required: ["localizationId"]
          }
        },
        {
          name: "update_app_store_version_localization",
          description: "Update a specific field in an app store version localization",
          inputSchema: {
            type: "object",
            properties: {
              localizationId: {
                type: "string",
                description: "The ID of the app store version localization to update"
              },
              field: {
                type: "string",
                enum: ["description", "keywords", "marketingUrl", "promotionalText", "supportUrl", "whatsNew"],
                description: "The field to update"
              },
              value: {
                type: "string",
                description: "The new value for the field"
              }
            },
            required: ["localizationId", "field", "value"]
          }
        },

        // Bundle ID Tools
        {
          name: "create_bundle_id",
          description: "Register a new bundle ID for app development",
          inputSchema: {
            type: "object",
            properties: {
              identifier: {
                type: "string",
                description: "The bundle ID string (e.g., 'com.example.app')"
              },
              name: {
                type: "string",
                description: "A name for the bundle ID"
              },
              platform: {
                type: "string",
                enum: ["IOS", "MAC_OS", "UNIVERSAL"],
                description: "The platform for this bundle ID"
              },
              seedId: {
                type: "string",
                description: "Your team's seed ID (optional)"
              }
            },
            required: ["identifier", "name", "platform"]
          }
        },
        {
          name: "list_bundle_ids",
          description: "Find and list bundle IDs that are registered to your team",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of bundle IDs to return (default: 100, max: 200)",
                minimum: 1,
                maximum: 200
              },
              sort: {
                type: "string",
                description: "Sort order for the results",
                enum: [
                  "name", "-name", "platform", "-platform", 
                  "identifier", "-identifier", "seedId", "-seedId", "id", "-id"
                ]
              },
              filter: {
                type: "object",
                properties: {
                  identifier: { type: "string", description: "Filter by bundle identifier" },
                  name: { type: "string", description: "Filter by name" },
                  platform: { 
                    type: "string", 
                    description: "Filter by platform",
                    enum: ["IOS", "MAC_OS", "UNIVERSAL"]
                  },
                  seedId: { type: "string", description: "Filter by seed ID" }
                }
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["profiles", "bundleIdCapabilities", "app"]
                },
                description: "Related resources to include in the response"
              }
            }
          }
        },
        {
          name: "get_bundle_id_info",
          description: "Get detailed information about a specific bundle ID",
          inputSchema: {
            type: "object",
            properties: {
              bundleIdId: {
                type: "string",
                description: "The ID of the bundle ID to get information for"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["profiles", "bundleIdCapabilities", "app"]
                },
                description: "Optional relationships to include in the response"
              },
              fields: {
                type: "object",
                properties: {
                  bundleIds: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["name", "platform", "identifier", "seedId"]
                    },
                    description: "Fields to include for the bundle ID"
                  }
                },
                description: "Specific fields to include in the response"
              }
            },
            required: ["bundleIdId"]
          }
        },
        {
          name: "enable_bundle_capability",
          description: "Enable a capability for a bundle ID",
          inputSchema: {
            type: "object",
            properties: {
              bundleIdId: {
                type: "string",
                description: "The ID of the bundle ID"
              },
              capabilityType: {
                type: "string",
                description: "The type of capability to enable",
                enum: [
                  "ICLOUD", "IN_APP_PURCHASE", "GAME_CENTER", "PUSH_NOTIFICATIONS", "WALLET",
                  "INTER_APP_AUDIO", "MAPS", "ASSOCIATED_DOMAINS", "PERSONAL_VPN", "APP_GROUPS",
                  "HEALTHKIT", "HOMEKIT", "WIRELESS_ACCESSORY_CONFIGURATION", "APPLE_PAY",
                  "DATA_PROTECTION", "SIRIKIT", "NETWORK_EXTENSIONS", "MULTIPATH", "HOT_SPOT",
                  "NFC_TAG_READING", "CLASSKIT", "AUTOFILL_CREDENTIAL_PROVIDER", "ACCESS_WIFI_INFORMATION",
                  "NETWORK_CUSTOM_PROTOCOL", "COREMEDIA_HLS_LOW_LATENCY", "SYSTEM_EXTENSION_INSTALL",
                  "USER_MANAGEMENT", "APPLE_ID_AUTH"
                ]
              },
              settings: {
                type: "array",
                description: "Optional capability settings",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "The setting key" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          enabled: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            required: ["bundleIdId", "capabilityType"]
          }
        },
        {
          name: "disable_bundle_capability",
          description: "Disable a capability for a bundle ID",
          inputSchema: {
            type: "object",
            properties: {
              capabilityId: {
                type: "string",
                description: "The ID of the capability to disable"
              }
            },
            required: ["capabilityId"]
          }
        },

        // Device Management Tools
        {
          name: "list_devices",
          description: "Get a list of all devices registered to your team",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of devices to return (default: 100, max: 200)",
                minimum: 1,
                maximum: 200
              },
              sort: {
                type: "string",
                description: "Sort order for the results",
                enum: [
                  "name", "-name", "platform", "-platform", "status", "-status",
                  "udid", "-udid", "deviceClass", "-deviceClass", "model", "-model",
                  "addedDate", "-addedDate"
                ]
              },
              filter: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Filter by device name" },
                  platform: { 
                    type: "string", 
                    description: "Filter by platform",
                    enum: ["IOS", "MAC_OS"]
                  },
                  status: { 
                    type: "string", 
                    description: "Filter by status",
                    enum: ["ENABLED", "DISABLED"]
                  },
                  udid: { type: "string", description: "Filter by device UDID" },
                  deviceClass: { 
                    type: "string", 
                    description: "Filter by device class",
                    enum: ["APPLE_WATCH", "IPAD", "IPHONE", "IPOD", "APPLE_TV", "MAC"]
                  }
                }
              },
              fields: {
                type: "object",
                properties: {
                  devices: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["name", "platform", "udid", "deviceClass", "status", "model", "addedDate"]
                    },
                    description: "Fields to include for each device"
                  }
                }
              }
            }
          }
        },

        // User Management Tools
        {
          name: "list_users",
          description: "Get a list of all users registered on your App Store Connect team",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of users to return (default: 100, max: 200)",
                minimum: 1,
                maximum: 200
              },
              sort: {
                type: "string",
                description: "Sort order for the results",
                enum: ["username", "-username", "firstName", "-firstName", "lastName", "-lastName", "roles", "-roles"]
              },
              filter: {
                type: "object",
                properties: {
                  username: { type: "string", description: "Filter by username" },
                  roles: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "ADMIN", "FINANCE", "TECHNICAL", "SALES", "MARKETING", "DEVELOPER",
                        "ACCOUNT_HOLDER", "READ_ONLY", "APP_MANAGER", "ACCESS_TO_REPORTS", "CUSTOMER_SUPPORT"
                      ]
                    },
                    description: "Filter by user roles"
                  },
                  visibleApps: {
                    type: "array",
                    items: { type: "string" },
                    description: "Filter by apps the user can see (app IDs)"
                  }
                }
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["visibleApps"]
                },
                description: "Related resources to include in the response"
              }
            }
          }
        },

        // Analytics & Reports Tools
        {
          name: "create_analytics_report_request",
          description: "Create a new analytics report request for an app",
          inputSchema: {
            type: "object",
            properties: {
              appId: {
                type: "string",
                description: "The ID of the app to generate analytics reports for"
              },
              accessType: {
                type: "string",
                enum: ["ONGOING", "ONE_TIME_SNAPSHOT"],
                description: "Access type for the analytics report (ONGOING for daily data, ONE_TIME_SNAPSHOT for historical data)",
                default: "ONE_TIME_SNAPSHOT"
              }
            },
            required: ["appId"]
          }
        },
        {
          name: "list_analytics_reports",
          description: "Get available analytics reports for a specific report request",
          inputSchema: {
            type: "object",
            properties: {
              reportRequestId: {
                type: "string",
                description: "The ID of the analytics report request"
              },
              limit: {
                type: "number",
                description: "Maximum number of reports to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              filter: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["APP_STORE_ENGAGEMENT", "APP_STORE_COMMERCE", "APP_USAGE", "FRAMEWORKS_USAGE", "PERFORMANCE"],
                    description: "Filter by report category"
                  }
                }
              }
            },
            required: ["reportRequestId"]
          }
        },
        {
          name: "list_analytics_report_segments",
          description: "Get segments for a specific analytics report (contains download URLs)",
          inputSchema: {
            type: "object",
            properties: {
              reportId: {
                type: "string",
                description: "The ID of the analytics report"
              },
              limit: {
                type: "number",
                description: "Maximum number of segments to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            },
            required: ["reportId"]
          }
        },
        {
          name: "download_analytics_report_segment",
          description: "Download data from an analytics report segment URL",
          inputSchema: {
            type: "object",
            properties: {
              segmentUrl: {
                type: "string",
                description: "The URL of the analytics report segment to download"
              }
            },
            required: ["segmentUrl"]
          }
        },

        // Xcode Development Tools (Local)
        {
          name: "list_schemes",
          description: "List all available schemes in an Xcode project or workspace",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to the Xcode project (.xcodeproj) or workspace (.xcworkspace)"
              }
            },
            required: ["projectPath"]
          }
        },

        // Xcode Cloud CI/CD Tools
        {
          name: "list_ci_products",
          description: "List all Xcode Cloud products (apps/frameworks configured for CI/CD)",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of products to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["primaryRepositories", "app", "bundleId"]
                },
                description: "Related resources to include in the response"
              },
              filterProductType: {
                type: "string",
                enum: ["APP", "FRAMEWORK"],
                description: "Filter by product type"
              }
            }
          }
        },
        {
          name: "get_ci_product",
          description: "Get detailed information about a specific Xcode Cloud product",
          inputSchema: {
            type: "object",
            properties: {
              productId: {
                type: "string",
                description: "The ID of the CI product"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["primaryRepositories", "app", "bundleId"]
                },
                description: "Related resources to include in the response"
              }
            },
            required: ["productId"]
          }
        },
        {
          name: "list_ci_workflows",
          description: "List all Xcode Cloud workflows for a product",
          inputSchema: {
            type: "object",
            properties: {
              productId: {
                type: "string",
                description: "The ID of the CI product"
              },
              limit: {
                type: "number",
                description: "Maximum number of workflows to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            },
            required: ["productId"]
          }
        },
        {
          name: "get_ci_workflow",
          description: "Get detailed information about a specific Xcode Cloud workflow",
          inputSchema: {
            type: "object",
            properties: {
              workflowId: {
                type: "string",
                description: "The ID of the CI workflow"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["product", "repository", "xcodeVersion", "macOsVersion"]
                },
                description: "Related resources to include in the response"
              }
            },
            required: ["workflowId"]
          }
        },
        {
          name: "list_ci_build_runs",
          description: "List Xcode Cloud build runs for a workflow or product",
          inputSchema: {
            type: "object",
            properties: {
              workflowId: {
                type: "string",
                description: "The ID of the workflow (provide this OR productId)"
              },
              productId: {
                type: "string",
                description: "The ID of the product (provide this OR workflowId)"
              },
              limit: {
                type: "number",
                description: "Maximum number of build runs to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              filterExecutionProgress: {
                type: "string",
                enum: ["PENDING", "RUNNING", "COMPLETE"],
                description: "Filter by execution progress"
              },
              filterCompletionStatus: {
                type: "string",
                enum: ["SUCCEEDED", "FAILED", "ERRORED", "CANCELED", "SKIPPED"],
                description: "Filter by completion status"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["builds", "workflow", "product", "sourceBranchOrTag", "destinationBranch", "pullRequest"]
                },
                description: "Related resources to include in the response"
              },
              sort: {
                type: "string",
                enum: ["number", "-number", "createdDate", "-createdDate"],
                description: "Sort order (prefix with - for descending)"
              }
            }
          }
        },
        {
          name: "get_ci_build_run",
          description: "Get detailed information about a specific Xcode Cloud build run. Use errorsOnly to reduce context by returning only essential error summary data.",
          inputSchema: {
            type: "object",
            properties: {
              buildRunId: {
                type: "string",
                description: "The ID of the build run"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["builds", "workflow", "product", "sourceBranchOrTag", "destinationBranch", "pullRequest"]
                },
                description: "Related resources to include in the response (ignored when errorsOnly is true)"
              },
              errorsOnly: {
                type: "boolean",
                description: "If true, return only essential build info and error counts (reduces context size). Default: false",
                default: false
              }
            },
            required: ["buildRunId"]
          }
        },
        {
          name: "start_ci_build_run",
          description: "Start a new Xcode Cloud build run for a workflow",
          inputSchema: {
            type: "object",
            properties: {
              workflowId: {
                type: "string",
                description: "The ID of the workflow to run"
              },
              gitReferenceId: {
                type: "string",
                description: "The ID of the git reference (branch/tag) to build (optional)"
              },
              clean: {
                type: "boolean",
                description: "Whether to perform a clean build (optional)"
              }
            },
            required: ["workflowId"]
          }
        },
        {
          name: "cancel_ci_build_run",
          description: "Cancel a running Xcode Cloud build",
          inputSchema: {
            type: "object",
            properties: {
              buildRunId: {
                type: "string",
                description: "The ID of the build run to cancel"
              }
            },
            required: ["buildRunId"]
          }
        },
        {
          name: "list_ci_build_actions",
          description: "List all build actions (build, test, analyze, archive) for a build run. Use errorsOnly to reduce context by filtering to only failed/errored actions.",
          inputSchema: {
            type: "object",
            properties: {
              buildRunId: {
                type: "string",
                description: "The ID of the build run"
              },
              limit: {
                type: "number",
                description: "Maximum number of actions to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              errorsOnly: {
                type: "boolean",
                description: "If true, only return failed or errored actions (reduces context size). Default: false",
                default: false
              }
            },
            required: ["buildRunId"]
          }
        },
        {
          name: "get_ci_build_action",
          description: "Get detailed information about a specific build action",
          inputSchema: {
            type: "object",
            properties: {
              actionId: {
                type: "string",
                description: "The ID of the build action"
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["buildRun"]
                },
                description: "Related resources to include in the response"
              }
            },
            required: ["actionId"]
          }
        },
        {
          name: "list_ci_issues",
          description: "List all issues (errors, warnings, test failures) for a build action. Use errorsOnly to reduce context by filtering to only errors (excludes warnings).",
          inputSchema: {
            type: "object",
            properties: {
              buildActionId: {
                type: "string",
                description: "The ID of the build action"
              },
              limit: {
                type: "number",
                description: "Maximum number of issues to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              errorsOnly: {
                type: "boolean",
                description: "If true, only return errors and critical issues (excludes warnings to reduce context size). Default: false",
                default: false
              }
            },
            required: ["buildActionId"]
          }
        },
        {
          name: "list_ci_test_results",
          description: "List all test results for a test action. Use errorsOnly to reduce context by filtering to only failed tests.",
          inputSchema: {
            type: "object",
            properties: {
              buildActionId: {
                type: "string",
                description: "The ID of the test action"
              },
              limit: {
                type: "number",
                description: "Maximum number of test results to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              errorsOnly: {
                type: "boolean",
                description: "If true, only return failed tests (reduces context size). Default: false",
                default: false
              }
            },
            required: ["buildActionId"]
          }
        },
        {
          name: "list_ci_artifacts",
          description: "List all artifacts (logs, archives) for a build action",
          inputSchema: {
            type: "object",
            properties: {
              buildActionId: {
                type: "string",
                description: "The ID of the build action"
              },
              limit: {
                type: "number",
                description: "Maximum number of artifacts to return (default: 100)",
                minimum: 1,
                maximum: 200
              }
            },
            required: ["buildActionId"]
          }
        },
        {
          name: "download_ci_artifact",
          description: "Get download URL for a build artifact",
          inputSchema: {
            type: "object",
            properties: {
              artifactId: {
                type: "string",
                description: "The ID of the artifact to download"
              }
            },
            required: ["artifactId"]
          }
        },
        {
          name: "list_git_references",
          description: "List git branches and tags for a repository",
          inputSchema: {
            type: "object",
            properties: {
              repositoryId: {
                type: "string",
                description: "The ID of the SCM repository"
              },
              limit: {
                type: "number",
                description: "Maximum number of references to return (default: 100)",
                minimum: 1,
                maximum: 200
              },
              filterKind: {
                type: "string",
                enum: ["BRANCH", "TAG"],
                description: "Filter by reference type (branch or tag)"
              }
            },
            required: ["repositoryId"]
          }
        },
        {
          name: "get_build_runs_summary",
          description: "Get a summary of recent build runs with statistics (useful for CI/CD monitoring)",
          inputSchema: {
            type: "object",
            properties: {
              workflowId: {
                type: "string",
                description: "The ID of the workflow (provide this OR productId)"
              },
              productId: {
                type: "string",
                description: "The ID of the product (provide this OR workflowId)"
              },
              limit: {
                type: "number",
                description: "Maximum number of build runs to include (default: 50)",
                minimum: 1,
                maximum: 200
              }
            }
          }
        },
        {
          name: "get_build_failure_details",
          description: "Get detailed failure information for a failed build run (useful for debugging)",
          inputSchema: {
            type: "object",
            properties: {
              buildRunId: {
                type: "string",
                description: "The ID of the failed build run"
              }
            },
            required: ["buildRunId"]
          }
        }
    ];

    // Sales and Finance Report tools - only available if vendor number is configured
    const paymentReportTools = [
      {
        name: "download_sales_report",
        description: "Download sales and trends reports",
        inputSchema: {
          type: "object",
          properties: {
            vendorNumber: {
              type: "string",
              description: "Your vendor number from App Store Connect (optional if set as environment variable)",
              default: config.vendorNumber
            },
            reportType: {
              type: "string",
              enum: ["SALES"],
              description: "Type of report to download",
              default: "SALES"
            },
            reportSubType: {
              type: "string",
              enum: ["SUMMARY", "DETAILED"],
              description: "Sub-type of the report",
              default: "SUMMARY"
            },
            frequency: {
              type: "string",
              enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
              description: "Frequency of the report",
              default: "MONTHLY"
            },
            reportDate: {
              type: "string",
              description: "Report date in YYYY-MM format (e.g., '2024-01')"
            }
          },
          required: ["reportDate"]
        }
      },
      {
        name: "download_finance_report",
        description: "Download finance reports for a specific region",
        inputSchema: {
          type: "object",
          properties: {
            vendorNumber: {
              type: "string",
              description: "Your vendor number from App Store Connect (optional if set as environment variable)",
              default: config.vendorNumber
            },
            reportDate: {
              type: "string",
              description: "Report date in YYYY-MM format (e.g., '2024-01')"
            },
            regionCode: {
              type: "string",
              description: "Region code (e.g., 'Z1' for worldwide, 'WW' for Europe)"
            }
          },
          required: ["reportDate", "regionCode"]
        }
      }
    ];

    // Only include payment report tools if vendor number is configured
    if (config.vendorNumber) {
      return [...baseTools, ...paymentReportTools];
    }

    return baseTools;
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.buildToolsList()
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments || {};
        
        // Helper to format responses
        const formatResponse = (data: any) => {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(data, null, 2)
            }]
          };
        };
        
        switch (request.params.name) {
          // App Management
          case "list_apps":
            const appsData = await this.appHandlers.listApps(args as any);
            return formatResponse(appsData);
          
          case "get_app_info":
            const appInfo = await this.appHandlers.getAppInfo(args as any);
            return formatResponse(appInfo);

          // Beta Testing
          case "list_beta_groups":
            return { toolResult: await this.betaHandlers.listBetaGroups(args as any) };
          
          case "list_group_testers":
            return { toolResult: await this.betaHandlers.listGroupTesters(args as any) };
          
          case "add_tester_to_group":
            return { toolResult: await this.betaHandlers.addTesterToGroup(args as any) };
          
          case "remove_tester_from_group":
            return { toolResult: await this.betaHandlers.removeTesterFromGroup(args as any) };
          
          case "list_beta_feedback_screenshots":
            const feedbackData = await this.betaHandlers.listBetaFeedbackScreenshots(args as any);
            return formatResponse(feedbackData);
          
          case "get_beta_feedback_screenshot":
            const result = await this.betaHandlers.getBetaFeedbackScreenshot(args as any);
            // If the result already contains content (image), return it directly
            if (result.content) {
              return result;
            }
            // Otherwise format as text
            return formatResponse(result);

          // App Store Version Localizations
          case "create_app_store_version":
            return { toolResult: await this.localizationHandlers.createAppStoreVersion(args as any) };
          
          case "list_app_store_versions":
            return { toolResult: await this.localizationHandlers.listAppStoreVersions(args as any) };
          
          case "list_app_store_version_localizations":
            return { toolResult: await this.localizationHandlers.listAppStoreVersionLocalizations(args as any) };
          
          case "get_app_store_version_localization":
            return { toolResult: await this.localizationHandlers.getAppStoreVersionLocalization(args as any) };
          
          case "update_app_store_version_localization":
            return { toolResult: await this.localizationHandlers.updateAppStoreVersionLocalization(args as any) };

          // Bundle IDs
          case "create_bundle_id":
            return { toolResult: await this.bundleHandlers.createBundleId(args as any) };
          
          case "list_bundle_ids":
            return { toolResult: await this.bundleHandlers.listBundleIds(args as any) };
          
          case "get_bundle_id_info":
            return { toolResult: await this.bundleHandlers.getBundleIdInfo(args as any) };
          
          case "enable_bundle_capability":
            return { toolResult: await this.bundleHandlers.enableBundleCapability(args as any) };
          
          case "disable_bundle_capability":
            return { toolResult: await this.bundleHandlers.disableBundleCapability(args as any) };

          // Devices
          case "list_devices":
            return { toolResult: await this.deviceHandlers.listDevices(args as any) };

          // Users
          case "list_users":
            return { toolResult: await this.userHandlers.listUsers(args as any) };

          // Analytics & Reports
          case "create_analytics_report_request":
            return { toolResult: await this.analyticsHandlers.createAnalyticsReportRequest(args as any) };
          
          case "list_analytics_reports":
            return { toolResult: await this.analyticsHandlers.listAnalyticsReports(args as any) };
          
          case "list_analytics_report_segments":
            return { toolResult: await this.analyticsHandlers.listAnalyticsReportSegments(args as any) };
          
          case "download_analytics_report_segment":
            return { toolResult: await this.analyticsHandlers.downloadAnalyticsReportSegment(args as any) };
          
          case "download_sales_report":
            if (!config.vendorNumber) {
              throw new McpError(
                ErrorCode.MethodNotFound,
                "Sales reports are not available. Please set APP_STORE_CONNECT_VENDOR_NUMBER environment variable."
              );
            }
            return { toolResult: await this.analyticsHandlers.downloadSalesReport(args as any) };
          
          case "download_finance_report":
            if (!config.vendorNumber) {
              throw new McpError(
                ErrorCode.MethodNotFound,
                "Finance reports are not available. Please set APP_STORE_CONNECT_VENDOR_NUMBER environment variable."
              );
            }
            return { toolResult: await this.analyticsHandlers.downloadFinanceReport(args as any) };

          // Xcode Development Tools (Local)
          case "list_schemes":
            return { toolResult: await this.xcodeHandlers.listSchemes(args as any) };

          // Xcode Cloud CI/CD Tools
          case "list_ci_products":
            return formatResponse(await this.xcodeCloudHandlers.listCiProducts(args as any));

          case "get_ci_product":
            return formatResponse(await this.xcodeCloudHandlers.getCiProduct(args as any));

          case "list_ci_workflows":
            return formatResponse(await this.xcodeCloudHandlers.listCiWorkflows(args as any));

          case "get_ci_workflow":
            return formatResponse(await this.xcodeCloudHandlers.getCiWorkflow(args as any));

          case "list_ci_build_runs":
            return formatResponse(await this.xcodeCloudHandlers.listCiBuildRuns(args as any));

          case "get_ci_build_run":
            return formatResponse(await this.xcodeCloudHandlers.getCiBuildRun(args as any));

          case "start_ci_build_run":
            return formatResponse(await this.xcodeCloudHandlers.startCiBuildRun(args as any));

          case "cancel_ci_build_run":
            await this.xcodeCloudHandlers.cancelCiBuildRun(args as any);
            return formatResponse({ success: true, message: "Build run cancelled" });

          case "list_ci_build_actions":
            return formatResponse(await this.xcodeCloudHandlers.listCiBuildActions(args as any));

          case "get_ci_build_action":
            return formatResponse(await this.xcodeCloudHandlers.getCiBuildAction(args as any));

          case "list_ci_issues":
            return formatResponse(await this.xcodeCloudHandlers.listCiIssues(args as any));

          case "list_ci_test_results":
            return formatResponse(await this.xcodeCloudHandlers.listCiTestResults(args as any));

          case "list_ci_artifacts":
            return formatResponse(await this.xcodeCloudHandlers.listCiArtifacts(args as any));

          case "download_ci_artifact":
            return formatResponse(await this.xcodeCloudHandlers.downloadCiArtifact(args as any));

          case "list_git_references":
            return formatResponse(await this.xcodeCloudHandlers.listGitReferences(args as any));

          case "get_build_runs_summary":
            return formatResponse(await this.xcodeCloudHandlers.getBuildRunsSummary(args as any));

          case "get_build_failure_details":
            return formatResponse(await this.xcodeCloudHandlers.getBuildFailureDetails(args as any));

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `App Store Connect API error: ${error.response?.data?.errors?.[0]?.detail ?? error.message}`
          );
        }
        throw error;
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("App Store Connect MCP server running on stdio");
  }
}

// Start the server
const server = new AppStoreConnectServer();
server.run().catch(console.error);