/**
 * Xcode Cloud Types for App Store Connect API
 *
 * These types represent the Xcode Cloud CI/CD resources available through
 * the App Store Connect API.
 *
 * API Reference: https://developer.apple.com/documentation/appstoreconnectapi
 * Implementation Guide: https://www.polpiella.dev/using-app-store-connect-api-to-trigger-xcode-cloud-workflows
 */

// ============================================================================
// Enums and Union Types
// ============================================================================

/** Execution progress states for a build run */
export type CiBuildRunExecutionProgress =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETE';

/** Completion status for a finished build run */
export type CiBuildRunCompletionStatus =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'ERRORED'
  | 'CANCELED'
  | 'SKIPPED';

/** Types of build actions */
export type CiBuildActionExecutionProgress =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETE';

export type CiBuildActionCompletionStatus =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'ERRORED'
  | 'CANCELED'
  | 'SKIPPED';

export type CiBuildActionName =
  | 'BUILD'
  | 'ANALYZE'
  | 'TEST'
  | 'ARCHIVE';

/** Product types for CI products */
export type CiProductProductType =
  | 'APP'
  | 'FRAMEWORK';

/** Source control provider */
export type ScmProviderType =
  | 'BITBUCKET_CLOUD'
  | 'BITBUCKET_SERVER'
  | 'GITHUB'
  | 'GITHUB_ENTERPRISE'
  | 'GITLAB'
  | 'GITLAB_SELF_MANAGED';

/** Git reference type */
export type CiGitRefKind =
  | 'BRANCH'
  | 'TAG';

// ============================================================================
// Core Resource Types
// ============================================================================

/** Xcode Cloud Product - represents an app or framework configured for CI/CD */
export interface CiProduct {
  id: string;
  type: 'ciProducts';
  attributes: {
    name: string;
    createdDate: string;
    productType: CiProductProductType;
  };
  relationships?: {
    app?: {
      data?: {
        id: string;
        type: 'apps';
      };
    };
    bundleId?: {
      data?: {
        id: string;
        type: 'bundleIds';
      };
    };
    primaryRepositories?: {
      data?: Array<{
        id: string;
        type: 'scmRepositories';
      }>;
    };
  };
}

/** Xcode Cloud Workflow - defines build, test, and archive configurations */
export interface CiWorkflow {
  id: string;
  type: 'ciWorkflows';
  attributes: {
    name: string;
    description?: string;
    isEnabled: boolean;
    isLockedForEditing: boolean;
    lastModifiedDate: string;
    branchStartCondition?: {
      source: {
        branchName?: string;
        isAllMatch: boolean;
      };
      filesAndFoldersRule?: {
        mode: string;
        matchers?: Array<{
          directory: string;
          fileExtension?: string;
          fileName?: string;
        }>;
      };
      autoCancel: boolean;
    };
    tagStartCondition?: {
      source: {
        tagName?: string;
        isAllMatch: boolean;
      };
      autoCancel: boolean;
    };
    pullRequestStartCondition?: {
      source: {
        branchName?: string;
        isAllMatch: boolean;
      };
      destination: {
        branchName?: string;
        isAllMatch: boolean;
      };
      autoCancel: boolean;
    };
    scheduledStartCondition?: {
      schedule: {
        frequency: string;
        days?: string[];
        hour?: number;
        minute?: number;
        timezone?: string;
      };
    };
    manualBranchStartCondition?: {
      source: {
        branchName?: string;
        isAllMatch: boolean;
      };
    };
    manualTagStartCondition?: {
      source: {
        tagName?: string;
        isAllMatch: boolean;
      };
    };
    manualPullRequestStartCondition?: {
      source: {
        branchName?: string;
        isAllMatch: boolean;
      };
      destination: {
        branchName?: string;
        isAllMatch: boolean;
      };
    };
  };
  relationships?: {
    product?: {
      data?: {
        id: string;
        type: 'ciProducts';
      };
    };
    repository?: {
      data?: {
        id: string;
        type: 'scmRepositories';
      };
    };
    xcodeVersion?: {
      data?: {
        id: string;
        type: 'ciXcodeVersions';
      };
    };
    macOsVersion?: {
      data?: {
        id: string;
        type: 'ciMacOsVersions';
      };
    };
  };
}

/** Xcode Cloud Build Run - represents a single execution of a workflow */
export interface CiBuildRun {
  id: string;
  type: 'ciBuildRuns';
  attributes: {
    number?: number;
    createdDate: string;
    startedDate?: string;
    finishedDate?: string;
    sourceCommit?: {
      commitSha: string;
      author?: {
        displayName?: string;
        avatarUrl?: string;
      };
      committer?: {
        displayName?: string;
        avatarUrl?: string;
      };
      htmlUrl?: string;
      message?: string;
    };
    destinationCommit?: {
      commitSha: string;
      author?: {
        displayName?: string;
      };
      committer?: {
        displayName?: string;
      };
      htmlUrl?: string;
      message?: string;
    };
    isPullRequestBuild: boolean;
    issueCounts?: {
      analyzerWarnings?: number;
      errors?: number;
      testFailures?: number;
      warnings?: number;
    };
    executionProgress: CiBuildRunExecutionProgress;
    completionStatus?: CiBuildRunCompletionStatus;
    startReason?: string;
    cancelReason?: string;
  };
  relationships?: {
    workflow?: {
      data?: {
        id: string;
        type: 'ciWorkflows';
      };
    };
    product?: {
      data?: {
        id: string;
        type: 'ciProducts';
      };
    };
    sourceBranchOrTag?: {
      data?: {
        id: string;
        type: 'scmGitReferences';
      };
    };
    destinationBranch?: {
      data?: {
        id: string;
        type: 'scmGitReferences';
      };
    };
    pullRequest?: {
      data?: {
        id: string;
        type: 'scmPullRequests';
      };
    };
    builds?: {
      data?: Array<{
        id: string;
        type: 'builds';
      }>;
    };
  };
}

/** Xcode Cloud Build Action - represents a specific action within a build run */
export interface CiBuildAction {
  id: string;
  type: 'ciBuildActions';
  attributes: {
    name: CiBuildActionName;
    actionType: string;
    startedDate?: string;
    finishedDate?: string;
    issueCounts?: {
      analyzerWarnings?: number;
      errors?: number;
      testFailures?: number;
      warnings?: number;
    };
    executionProgress: CiBuildActionExecutionProgress;
    completionStatus?: CiBuildActionCompletionStatus;
    isRequiredToPass: boolean;
  };
  relationships?: {
    buildRun?: {
      data?: {
        id: string;
        type: 'ciBuildRuns';
      };
    };
  };
}

/** CI Issue - represents a build warning, error, or test failure */
export interface CiIssue {
  id: string;
  type: 'ciIssues';
  attributes: {
    issueType: 'ERROR' | 'WARNING' | 'TEST_FAILURE' | 'ANALYZER_WARNING';
    message: string;
    fileSource?: {
      path?: string;
      lineNumber?: number;
    };
    category?: string;
  };
}

/** CI Test Result - represents test execution results */
export interface CiTestResult {
  id: string;
  type: 'ciTestResults';
  attributes: {
    className?: string;
    name: string;
    status: 'EXPECTED_FAILURE' | 'FAILURE' | 'MIXED' | 'SKIPPED' | 'SUCCESS' | 'UNKNOWN';
    fileSource?: {
      path?: string;
      lineNumber?: number;
    };
    message?: string;
    destinationTestResults?: Array<{
      uuid: string;
      deviceName?: string;
      osVersion?: string;
      duration?: number;
      status: string;
    }>;
  };
}

/** CI Artifact - represents build artifacts like logs and archives */
export interface CiArtifact {
  id: string;
  type: 'ciArtifacts';
  attributes: {
    fileType: 'ARCHIVE' | 'LOG_BUNDLE' | 'RESULT_BUNDLE' | 'TEST_PRODUCTS' | 'XCODEBUILD_PRODUCTS';
    fileName: string;
    fileSize: number;
    downloadUrl?: string;
  };
}

/** SCM Repository - represents a source control repository */
export interface ScmRepository {
  id: string;
  type: 'scmRepositories';
  attributes: {
    httpCloneUrl?: string;
    sshCloneUrl?: string;
    ownerName?: string;
    repositoryName?: string;
    lastAccessedDate?: string;
  };
  relationships?: {
    scmProvider?: {
      data?: {
        id: string;
        type: 'scmProviders';
      };
    };
    defaultBranch?: {
      data?: {
        id: string;
        type: 'scmGitReferences';
      };
    };
  };
}

/** SCM Git Reference - represents a branch or tag */
export interface ScmGitReference {
  id: string;
  type: 'scmGitReferences';
  attributes: {
    name: string;
    canonicalName?: string;
    isDeleted: boolean;
    kind: CiGitRefKind;
  };
  relationships?: {
    repository?: {
      data?: {
        id: string;
        type: 'scmRepositories';
      };
    };
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ListCiProductsResponse {
  data: CiProduct[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
  included?: Array<CiWorkflow | ScmRepository>;
}

export interface CiProductResponse {
  data: CiProduct;
  included?: Array<CiWorkflow | ScmRepository>;
}

export interface ListCiWorkflowsResponse {
  data: CiWorkflow[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface CiWorkflowResponse {
  data: CiWorkflow;
}

export interface ListCiBuildRunsResponse {
  data: CiBuildRun[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
  included?: Array<CiBuildAction | CiProduct | CiWorkflow>;
}

export interface CiBuildRunResponse {
  data: CiBuildRun;
  included?: Array<CiBuildAction | CiProduct | CiWorkflow>;
}

export interface ListCiBuildActionsResponse {
  data: CiBuildAction[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface CiBuildActionResponse {
  data: CiBuildAction;
}

export interface ListCiIssuesResponse {
  data: CiIssue[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface ListCiTestResultsResponse {
  data: CiTestResult[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface ListCiArtifactsResponse {
  data: CiArtifact[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface ListScmGitReferencesResponse {
  data: ScmGitReference[];
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

// ============================================================================
// API Request Types
// ============================================================================

/** Request body to start a new build run */
export interface CiBuildRunCreateRequest {
  data: {
    type: 'ciBuildRuns';
    attributes?: {
      clean?: boolean;
    };
    relationships: {
      workflow: {
        data: {
          id: string;
          type: 'ciWorkflows';
        };
      };
      sourceBranchOrTag?: {
        data: {
          id: string;
          type: 'scmGitReferences';
        };
      };
      pullRequest?: {
        data: {
          id: string;
          type: 'scmPullRequests';
        };
      };
    };
  };
}

// ============================================================================
// Filter Types for Queries
// ============================================================================

export interface CiBuildRunFilters {
  executionProgress?: CiBuildRunExecutionProgress;
  completionStatus?: CiBuildRunCompletionStatus;
}

export interface CiBuildActionFilters {
  executionProgress?: CiBuildActionExecutionProgress;
  completionStatus?: CiBuildActionCompletionStatus;
}
