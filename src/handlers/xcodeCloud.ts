/**
 * Xcode Cloud Handlers for App Store Connect API
 *
 * Provides methods to interact with Xcode Cloud CI/CD resources including:
 * - CI Products (apps/frameworks configured for Xcode Cloud)
 * - CI Workflows (build configurations)
 * - CI Build Runs (workflow executions)
 * - CI Build Actions (individual build steps)
 * - CI Issues (errors, warnings, test failures)
 * - CI Test Results
 * - CI Artifacts (logs, archives)
 *
 * API Reference: https://developer.apple.com/documentation/appstoreconnectapi
 * Implementation Guide: https://www.polpiella.dev/using-app-store-connect-api-to-trigger-xcode-cloud-workflows
 */

import { AppStoreConnectClient } from '../services/index.js';
import {
  ListCiProductsResponse,
  CiProductResponse,
  ListCiWorkflowsResponse,
  CiWorkflowResponse,
  ListCiBuildRunsResponse,
  CiBuildRunResponse,
  ListCiBuildActionsResponse,
  CiBuildActionResponse,
  ListCiIssuesResponse,
  ListCiTestResultsResponse,
  ListCiArtifactsResponse,
  ListScmGitReferencesResponse,
  CiBuildRunCreateRequest,
  CiBuildRunExecutionProgress,
  CiBuildRunCompletionStatus,
} from '../types/index.js';
import { validateRequired, sanitizeLimit, buildFilterParams } from '../utils/index.js';

export class XcodeCloudHandlers {
  constructor(private client: AppStoreConnectClient) {}

  // ============================================================================
  // CI Products
  // ============================================================================

  /**
   * List all Xcode Cloud products (apps/frameworks configured for CI/CD)
   */
  async listCiProducts(args: {
    limit?: number;
    include?: Array<'primaryRepositories' | 'app' | 'bundleId'>;
    filterProductType?: 'APP' | 'FRAMEWORK';
  } = {}): Promise<ListCiProductsResponse> {
    const { limit = 100, include, filterProductType } = args;

    const params: Record<string, any> = {
      limit: sanitizeLimit(limit),
    };

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    if (filterProductType) {
      params['filter[productType]'] = filterProductType;
    }

    return this.client.get<ListCiProductsResponse>('/ciProducts', params);
  }

  /**
   * Get detailed information about a specific CI product
   */
  async getCiProduct(args: {
    productId: string;
    include?: Array<'primaryRepositories' | 'app' | 'bundleId'>;
  }): Promise<CiProductResponse> {
    const { productId, include } = args;

    validateRequired(args, ['productId']);

    const params: Record<string, any> = {};

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    return this.client.get<CiProductResponse>(`/ciProducts/${productId}`, params);
  }

  // ============================================================================
  // CI Workflows
  // ============================================================================

  /**
   * List all workflows for a CI product
   */
  async listCiWorkflows(args: {
    productId: string;
    limit?: number;
  }): Promise<ListCiWorkflowsResponse> {
    const { productId, limit = 100 } = args;

    validateRequired(args, ['productId']);

    return this.client.get<ListCiWorkflowsResponse>(
      `/ciProducts/${productId}/workflows`,
      { limit: sanitizeLimit(limit) }
    );
  }

  /**
   * Get detailed information about a specific workflow
   */
  async getCiWorkflow(args: {
    workflowId: string;
    include?: Array<'product' | 'repository' | 'xcodeVersion' | 'macOsVersion'>;
  }): Promise<CiWorkflowResponse> {
    const { workflowId, include } = args;

    validateRequired(args, ['workflowId']);

    const params: Record<string, any> = {};

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    return this.client.get<CiWorkflowResponse>(`/ciWorkflows/${workflowId}`, params);
  }

  // ============================================================================
  // CI Build Runs
  // ============================================================================

  /**
   * List all build runs for a workflow
   */
  async listCiBuildRuns(args: {
    workflowId?: string;
    productId?: string;
    limit?: number;
    filterExecutionProgress?: CiBuildRunExecutionProgress;
    filterCompletionStatus?: CiBuildRunCompletionStatus;
    include?: Array<'builds' | 'workflow' | 'product' | 'sourceBranchOrTag' | 'destinationBranch' | 'pullRequest'>;
    sort?: 'number' | '-number' | 'createdDate' | '-createdDate';
  }): Promise<ListCiBuildRunsResponse> {
    const {
      workflowId,
      productId,
      limit = 100,
      filterExecutionProgress,
      filterCompletionStatus,
      include,
      sort,
    } = args;

    // Must provide either workflowId or productId
    if (!workflowId && !productId) {
      throw new Error('Either workflowId or productId is required');
    }

    const params: Record<string, any> = {
      limit: sanitizeLimit(limit),
    };

    if (filterExecutionProgress) {
      params['filter[executionProgress]'] = filterExecutionProgress;
    }

    if (filterCompletionStatus) {
      params['filter[completionStatus]'] = filterCompletionStatus;
    }

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    if (sort) {
      params.sort = sort;
    }

    // Use the appropriate endpoint based on what ID was provided
    const endpoint = workflowId
      ? `/ciWorkflows/${workflowId}/buildRuns`
      : `/ciProducts/${productId}/buildRuns`;

    return this.client.get<ListCiBuildRunsResponse>(endpoint, params);
  }

  /**
   * Get detailed information about a specific build run
   */
  async getCiBuildRun(args: {
    buildRunId: string;
    include?: Array<'builds' | 'workflow' | 'product' | 'sourceBranchOrTag' | 'destinationBranch' | 'pullRequest'>;
  }): Promise<CiBuildRunResponse> {
    const { buildRunId, include } = args;

    validateRequired(args, ['buildRunId']);

    const params: Record<string, any> = {};

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    return this.client.get<CiBuildRunResponse>(`/ciBuildRuns/${buildRunId}`, params);
  }

  /**
   * Start a new build run for a workflow
   */
  async startCiBuildRun(args: {
    workflowId: string;
    gitReferenceId?: string;
    clean?: boolean;
  }): Promise<CiBuildRunResponse> {
    const { workflowId, gitReferenceId, clean } = args;

    validateRequired(args, ['workflowId']);

    const requestBody: CiBuildRunCreateRequest = {
      data: {
        type: 'ciBuildRuns',
        attributes: clean !== undefined ? { clean } : undefined,
        relationships: {
          workflow: {
            data: {
              id: workflowId,
              type: 'ciWorkflows',
            },
          },
        },
      },
    };

    // Add git reference if provided
    if (gitReferenceId) {
      requestBody.data.relationships.sourceBranchOrTag = {
        data: {
          id: gitReferenceId,
          type: 'scmGitReferences',
        },
      };
    }

    return this.client.post<CiBuildRunResponse>('/ciBuildRuns', requestBody);
  }

  /**
   * Cancel a running build
   */
  async cancelCiBuildRun(args: {
    buildRunId: string;
  }): Promise<void> {
    const { buildRunId } = args;

    validateRequired(args, ['buildRunId']);

    // Cancel is done by deleting the build run while it's in progress
    await this.client.delete(`/ciBuildRuns/${buildRunId}`);
  }

  // ============================================================================
  // CI Build Actions
  // ============================================================================

  /**
   * List all build actions for a build run
   */
  async listCiBuildActions(args: {
    buildRunId: string;
    limit?: number;
  }): Promise<ListCiBuildActionsResponse> {
    const { buildRunId, limit = 100 } = args;

    validateRequired(args, ['buildRunId']);

    return this.client.get<ListCiBuildActionsResponse>(
      `/ciBuildRuns/${buildRunId}/actions`,
      { limit: sanitizeLimit(limit) }
    );
  }

  /**
   * Get detailed information about a specific build action
   */
  async getCiBuildAction(args: {
    actionId: string;
    include?: Array<'buildRun'>;
  }): Promise<CiBuildActionResponse> {
    const { actionId, include } = args;

    validateRequired(args, ['actionId']);

    const params: Record<string, any> = {};

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    return this.client.get<CiBuildActionResponse>(`/ciBuildActions/${actionId}`, params);
  }

  // ============================================================================
  // CI Issues (Errors, Warnings, Test Failures)
  // ============================================================================

  /**
   * List all issues (errors, warnings, test failures) for a build action
   */
  async listCiIssues(args: {
    buildActionId: string;
    limit?: number;
  }): Promise<ListCiIssuesResponse> {
    const { buildActionId, limit = 100 } = args;

    validateRequired(args, ['buildActionId']);

    return this.client.get<ListCiIssuesResponse>(
      `/ciBuildActions/${buildActionId}/issues`,
      { limit: sanitizeLimit(limit) }
    );
  }

  // ============================================================================
  // CI Test Results
  // ============================================================================

  /**
   * List all test results for a build action
   */
  async listCiTestResults(args: {
    buildActionId: string;
    limit?: number;
  }): Promise<ListCiTestResultsResponse> {
    const { buildActionId, limit = 100 } = args;

    validateRequired(args, ['buildActionId']);

    return this.client.get<ListCiTestResultsResponse>(
      `/ciBuildActions/${buildActionId}/testResults`,
      { limit: sanitizeLimit(limit) }
    );
  }

  // ============================================================================
  // CI Artifacts (Logs, Archives)
  // ============================================================================

  /**
   * List all artifacts for a build action
   */
  async listCiArtifacts(args: {
    buildActionId: string;
    limit?: number;
  }): Promise<ListCiArtifactsResponse> {
    const { buildActionId, limit = 100 } = args;

    validateRequired(args, ['buildActionId']);

    return this.client.get<ListCiArtifactsResponse>(
      `/ciBuildActions/${buildActionId}/artifacts`,
      { limit: sanitizeLimit(limit) }
    );
  }

  /**
   * Download an artifact (returns the download URL)
   */
  async downloadCiArtifact(args: {
    artifactId: string;
  }): Promise<{ downloadUrl: string; fileName: string; fileSize: number }> {
    const { artifactId } = args;

    validateRequired(args, ['artifactId']);

    const response = await this.client.get<{ data: { attributes: { downloadUrl: string; fileName: string; fileSize: number } } }>(
      `/ciArtifacts/${artifactId}`
    );

    return {
      downloadUrl: response.data.attributes.downloadUrl,
      fileName: response.data.attributes.fileName,
      fileSize: response.data.attributes.fileSize,
    };
  }

  // ============================================================================
  // SCM Git References (Branches and Tags)
  // ============================================================================

  /**
   * List all git references (branches and tags) for a repository
   */
  async listGitReferences(args: {
    repositoryId: string;
    limit?: number;
    filterKind?: 'BRANCH' | 'TAG';
  }): Promise<ListScmGitReferencesResponse> {
    const { repositoryId, limit = 100, filterKind } = args;

    validateRequired(args, ['repositoryId']);

    const params: Record<string, any> = {
      limit: sanitizeLimit(limit),
    };

    if (filterKind) {
      params['filter[kind]'] = filterKind;
    }

    return this.client.get<ListScmGitReferencesResponse>(
      `/scmRepositories/${repositoryId}/gitReferences`,
      params
    );
  }

  // ============================================================================
  // Convenience Methods for Debugging
  // ============================================================================

  /**
   * Get a summary of recent build runs with their status
   * Useful for debugging and monitoring CI/CD pipelines
   */
  async getBuildRunsSummary(args: {
    workflowId?: string;
    productId?: string;
    limit?: number;
  }): Promise<{
    total: number;
    builds: Array<{
      id: string;
      number?: number;
      status: string;
      executionProgress: string;
      completionStatus?: string;
      startedDate?: string;
      finishedDate?: string;
      commitMessage?: string;
      commitAuthor?: string;
      issueCounts?: {
        errors?: number;
        warnings?: number;
        testFailures?: number;
      };
    }>;
    statistics: {
      succeeded: number;
      failed: number;
      running: number;
      pending: number;
      canceled: number;
    };
  }> {
    const response = await this.listCiBuildRuns({
      workflowId: args.workflowId,
      productId: args.productId,
      limit: args.limit || 50,
      sort: '-number',
    });

    const statistics = {
      succeeded: 0,
      failed: 0,
      running: 0,
      pending: 0,
      canceled: 0,
    };

    const builds = response.data.map((build) => {
      // Count statistics
      if (build.attributes.executionProgress === 'RUNNING') {
        statistics.running++;
      } else if (build.attributes.executionProgress === 'PENDING') {
        statistics.pending++;
      } else if (build.attributes.completionStatus === 'SUCCEEDED') {
        statistics.succeeded++;
      } else if (build.attributes.completionStatus === 'FAILED' || build.attributes.completionStatus === 'ERRORED') {
        statistics.failed++;
      } else if (build.attributes.completionStatus === 'CANCELED') {
        statistics.canceled++;
      }

      // Determine overall status
      let status: string = build.attributes.executionProgress;
      if (build.attributes.executionProgress === 'COMPLETE' && build.attributes.completionStatus) {
        status = build.attributes.completionStatus;
      }

      return {
        id: build.id,
        number: build.attributes.number,
        status,
        executionProgress: build.attributes.executionProgress,
        completionStatus: build.attributes.completionStatus,
        startedDate: build.attributes.startedDate,
        finishedDate: build.attributes.finishedDate,
        commitMessage: build.attributes.sourceCommit?.message,
        commitAuthor: build.attributes.sourceCommit?.author?.displayName,
        issueCounts: build.attributes.issueCounts,
      };
    });

    return {
      total: builds.length,
      builds,
      statistics,
    };
  }

  /**
   * Get detailed failure information for a failed build run
   * Useful for debugging build failures
   */
  async getBuildFailureDetails(args: {
    buildRunId: string;
  }): Promise<{
    buildRun: CiBuildRunResponse['data'];
    failedActions: Array<{
      action: CiBuildActionResponse['data'];
      issues: ListCiIssuesResponse['data'];
      testResults?: ListCiTestResultsResponse['data'];
    }>;
  }> {
    const { buildRunId } = args;

    validateRequired(args, ['buildRunId']);

    // Get the build run details
    const buildRunResponse = await this.getCiBuildRun({ buildRunId });
    const buildRun = buildRunResponse.data;

    // Get all actions for this build run
    const actionsResponse = await this.listCiBuildActions({ buildRunId });

    // Filter to only failed/errored actions
    const failedActions = actionsResponse.data.filter(
      (action) =>
        action.attributes.completionStatus === 'FAILED' ||
        action.attributes.completionStatus === 'ERRORED'
    );

    // Get issues and test results for each failed action
    const failedActionsWithDetails = await Promise.all(
      failedActions.map(async (action) => {
        const [issuesResponse, testResultsResponse] = await Promise.all([
          this.listCiIssues({ buildActionId: action.id }),
          action.attributes.name === 'TEST'
            ? this.listCiTestResults({ buildActionId: action.id })
            : Promise.resolve({ data: [] }),
        ]);

        return {
          action,
          issues: issuesResponse.data,
          testResults: testResultsResponse.data.length > 0 ? testResultsResponse.data : undefined,
        };
      })
    );

    return {
      buildRun,
      failedActions: failedActionsWithDetails,
    };
  }
}
