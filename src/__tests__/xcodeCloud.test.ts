/**
 * Tests for Xcode Cloud Handlers
 *
 * These tests verify the XcodeCloudHandlers class methods work correctly
 * by mocking the AppStoreConnectClient.
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { XcodeCloudHandlers } from '../handlers/xcodeCloud.js';
import { AppStoreConnectClient } from '../services/appstore-client.js';

// Mock the AppStoreConnectClient
vi.mock('../services/appstore-client.js', () => {
  return {
    AppStoreConnectClient: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    })),
  };
});

// Mock sample data
const mockCiProduct = {
  id: 'product-123',
  type: 'ciProducts',
  attributes: {
    name: 'My App',
    createdDate: '2024-01-01T00:00:00Z',
    productType: 'APP',
  },
};

const mockCiWorkflow = {
  id: 'workflow-456',
  type: 'ciWorkflows',
  attributes: {
    name: 'Build and Test',
    description: 'Main CI workflow',
    isEnabled: true,
    isLockedForEditing: false,
    lastModifiedDate: '2024-01-15T00:00:00Z',
  },
};

const mockCiBuildRun = {
  id: 'buildrun-789',
  type: 'ciBuildRuns',
  attributes: {
    number: 42,
    createdDate: '2024-01-20T10:00:00Z',
    startedDate: '2024-01-20T10:01:00Z',
    finishedDate: '2024-01-20T10:15:00Z',
    executionProgress: 'COMPLETE',
    completionStatus: 'SUCCEEDED',
    isPullRequestBuild: false,
    sourceCommit: {
      commitSha: 'abc123def456',
      author: { displayName: 'John Doe' },
      message: 'Fix bug in authentication',
    },
    issueCounts: {
      errors: 0,
      warnings: 2,
      testFailures: 0,
    },
  },
};

const mockFailedBuildRun = {
  id: 'buildrun-failed',
  type: 'ciBuildRuns',
  attributes: {
    number: 43,
    createdDate: '2024-01-21T10:00:00Z',
    startedDate: '2024-01-21T10:01:00Z',
    finishedDate: '2024-01-21T10:10:00Z',
    executionProgress: 'COMPLETE',
    completionStatus: 'FAILED',
    isPullRequestBuild: false,
    sourceCommit: {
      commitSha: 'def789ghi012',
      author: { displayName: 'Jane Smith' },
      message: 'Add new feature',
    },
    issueCounts: {
      errors: 3,
      warnings: 1,
      testFailures: 2,
    },
  },
};

const mockCiBuildAction = {
  id: 'action-101',
  type: 'ciBuildActions',
  attributes: {
    name: 'TEST',
    actionType: 'test',
    startedDate: '2024-01-20T10:05:00Z',
    finishedDate: '2024-01-20T10:10:00Z',
    executionProgress: 'COMPLETE',
    completionStatus: 'FAILED',
    isRequiredToPass: true,
    issueCounts: {
      errors: 1,
      testFailures: 2,
    },
  },
};

const mockCiIssue = {
  id: 'issue-201',
  type: 'ciIssues',
  attributes: {
    issueType: 'ERROR',
    message: 'Cannot find module \'./missing\'',
    fileSource: {
      path: 'src/index.ts',
      lineNumber: 42,
    },
    category: 'Compiler',
  },
};

const mockCiTestResult = {
  id: 'testresult-301',
  type: 'ciTestResults',
  attributes: {
    className: 'AuthenticationTests',
    name: 'testLoginWithValidCredentials',
    status: 'FAILURE',
    message: 'Expected true but got false',
    fileSource: {
      path: 'Tests/AuthenticationTests.swift',
      lineNumber: 25,
    },
  },
};

const mockCiArtifact = {
  id: 'artifact-401',
  type: 'ciArtifacts',
  attributes: {
    fileType: 'LOG_BUNDLE',
    fileName: 'build-logs.zip',
    fileSize: 1024000,
    downloadUrl: 'https://example.com/artifacts/build-logs.zip',
  },
};

const mockGitReference = {
  id: 'gitref-501',
  type: 'scmGitReferences',
  attributes: {
    name: 'main',
    canonicalName: 'refs/heads/main',
    isDeleted: false,
    kind: 'BRANCH',
  },
};

describe('XcodeCloudHandlers', () => {
  let handlers: XcodeCloudHandlers;
  let mockClient: {
    get: Mock;
    post: Mock;
    delete: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    handlers = new XcodeCloudHandlers(mockClient as unknown as AppStoreConnectClient);
  });

  // ============================================================================
  // CI Products Tests
  // ============================================================================

  describe('listCiProducts', () => {
    it('should list CI products with default parameters', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiProduct] });

      const result = await handlers.listCiProducts();

      expect(mockClient.get).toHaveBeenCalledWith('/ciProducts', { limit: 100 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('product-123');
    });

    it('should list CI products with custom limit and filter', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiProduct] });

      const result = await handlers.listCiProducts({
        limit: 50,
        filterProductType: 'APP',
        include: ['primaryRepositories'],
      });

      expect(mockClient.get).toHaveBeenCalledWith('/ciProducts', {
        limit: 50,
        include: 'primaryRepositories',
        'filter[productType]': 'APP',
      });
    });
  });

  describe('getCiProduct', () => {
    it('should get a specific CI product', async () => {
      mockClient.get.mockResolvedValue({ data: mockCiProduct });

      const result = await handlers.getCiProduct({ productId: 'product-123' });

      expect(mockClient.get).toHaveBeenCalledWith('/ciProducts/product-123', {});
      expect(result.data.id).toBe('product-123');
    });

    it('should throw error when productId is missing', async () => {
      await expect(handlers.getCiProduct({ productId: '' })).rejects.toThrow();
    });
  });

  // ============================================================================
  // CI Workflows Tests
  // ============================================================================

  describe('listCiWorkflows', () => {
    it('should list workflows for a product', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiWorkflow] });

      const result = await handlers.listCiWorkflows({ productId: 'product-123' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciProducts/product-123/workflows',
        { limit: 100 }
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].attributes.name).toBe('Build and Test');
    });

    it('should throw error when productId is missing', async () => {
      await expect(handlers.listCiWorkflows({ productId: '' })).rejects.toThrow();
    });
  });

  describe('getCiWorkflow', () => {
    it('should get a specific workflow with includes', async () => {
      mockClient.get.mockResolvedValue({ data: mockCiWorkflow });

      const result = await handlers.getCiWorkflow({
        workflowId: 'workflow-456',
        include: ['product', 'repository'],
      });

      expect(mockClient.get).toHaveBeenCalledWith('/ciWorkflows/workflow-456', {
        include: 'product,repository',
      });
      expect(result.data.attributes.isEnabled).toBe(true);
    });
  });

  // ============================================================================
  // CI Build Runs Tests
  // ============================================================================

  describe('listCiBuildRuns', () => {
    it('should list build runs for a workflow', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiBuildRun] });

      const result = await handlers.listCiBuildRuns({ workflowId: 'workflow-456' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciWorkflows/workflow-456/buildRuns',
        { limit: 100 }
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].attributes.number).toBe(42);
    });

    it('should list build runs for a product', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiBuildRun] });

      const result = await handlers.listCiBuildRuns({ productId: 'product-123' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciProducts/product-123/buildRuns',
        { limit: 100 }
      );
    });

    it('should filter by execution progress and completion status', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiBuildRun] });

      await handlers.listCiBuildRuns({
        workflowId: 'workflow-456',
        filterExecutionProgress: 'COMPLETE',
        filterCompletionStatus: 'SUCCEEDED',
        sort: '-number',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciWorkflows/workflow-456/buildRuns',
        {
          limit: 100,
          'filter[executionProgress]': 'COMPLETE',
          'filter[completionStatus]': 'SUCCEEDED',
          sort: '-number',
        }
      );
    });

    it('should throw error when neither workflowId nor productId provided', async () => {
      await expect(handlers.listCiBuildRuns({})).rejects.toThrow(
        'Either workflowId or productId is required'
      );
    });
  });

  describe('getCiBuildRun', () => {
    it('should get a specific build run', async () => {
      mockClient.get.mockResolvedValue({ data: mockCiBuildRun });

      const result = await handlers.getCiBuildRun({ buildRunId: 'buildrun-789' });

      expect(mockClient.get).toHaveBeenCalledWith('/ciBuildRuns/buildrun-789', {});
      expect(result.data.attributes.completionStatus).toBe('SUCCEEDED');
    });
  });

  describe('startCiBuildRun', () => {
    it('should start a new build run', async () => {
      mockClient.post.mockResolvedValue({ data: mockCiBuildRun });

      const result = await handlers.startCiBuildRun({ workflowId: 'workflow-456' });

      expect(mockClient.post).toHaveBeenCalledWith('/ciBuildRuns', {
        data: {
          type: 'ciBuildRuns',
          attributes: undefined,
          relationships: {
            workflow: {
              data: {
                id: 'workflow-456',
                type: 'ciWorkflows',
              },
            },
          },
        },
      });
    });

    it('should start a clean build with git reference', async () => {
      mockClient.post.mockResolvedValue({ data: mockCiBuildRun });

      await handlers.startCiBuildRun({
        workflowId: 'workflow-456',
        gitReferenceId: 'gitref-501',
        clean: true,
      });

      expect(mockClient.post).toHaveBeenCalledWith('/ciBuildRuns', {
        data: {
          type: 'ciBuildRuns',
          attributes: { clean: true },
          relationships: {
            workflow: {
              data: {
                id: 'workflow-456',
                type: 'ciWorkflows',
              },
            },
            sourceBranchOrTag: {
              data: {
                id: 'gitref-501',
                type: 'scmGitReferences',
              },
            },
          },
        },
      });
    });
  });

  describe('cancelCiBuildRun', () => {
    it('should cancel a running build', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      await handlers.cancelCiBuildRun({ buildRunId: 'buildrun-789' });

      expect(mockClient.delete).toHaveBeenCalledWith('/ciBuildRuns/buildrun-789');
    });
  });

  // ============================================================================
  // CI Build Actions Tests
  // ============================================================================

  describe('listCiBuildActions', () => {
    it('should list actions for a build run', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiBuildAction] });

      const result = await handlers.listCiBuildActions({ buildRunId: 'buildrun-789' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciBuildRuns/buildrun-789/actions',
        { limit: 100 }
      );
      expect(result.data[0].attributes.name).toBe('TEST');
    });
  });

  describe('getCiBuildAction', () => {
    it('should get a specific build action', async () => {
      mockClient.get.mockResolvedValue({ data: mockCiBuildAction });

      const result = await handlers.getCiBuildAction({
        actionId: 'action-101',
        include: ['buildRun'],
      });

      expect(mockClient.get).toHaveBeenCalledWith('/ciBuildActions/action-101', {
        include: 'buildRun',
      });
      expect(result.data.attributes.isRequiredToPass).toBe(true);
    });
  });

  // ============================================================================
  // CI Issues Tests
  // ============================================================================

  describe('listCiIssues', () => {
    it('should list issues for a build action', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiIssue] });

      const result = await handlers.listCiIssues({ buildActionId: 'action-101' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciBuildActions/action-101/issues',
        { limit: 100 }
      );
      expect(result.data[0].attributes.issueType).toBe('ERROR');
      expect(result.data[0].attributes.fileSource?.path).toBe('src/index.ts');
    });
  });

  // ============================================================================
  // CI Test Results Tests
  // ============================================================================

  describe('listCiTestResults', () => {
    it('should list test results for a build action', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiTestResult] });

      const result = await handlers.listCiTestResults({ buildActionId: 'action-101' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciBuildActions/action-101/testResults',
        { limit: 100 }
      );
      expect(result.data[0].attributes.status).toBe('FAILURE');
      expect(result.data[0].attributes.className).toBe('AuthenticationTests');
    });
  });

  // ============================================================================
  // CI Artifacts Tests
  // ============================================================================

  describe('listCiArtifacts', () => {
    it('should list artifacts for a build action', async () => {
      mockClient.get.mockResolvedValue({ data: [mockCiArtifact] });

      const result = await handlers.listCiArtifacts({ buildActionId: 'action-101' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/ciBuildActions/action-101/artifacts',
        { limit: 100 }
      );
      expect(result.data[0].attributes.fileType).toBe('LOG_BUNDLE');
    });
  });

  describe('downloadCiArtifact', () => {
    it('should get artifact download URL', async () => {
      mockClient.get.mockResolvedValue({
        data: {
          attributes: {
            downloadUrl: 'https://example.com/download',
            fileName: 'logs.zip',
            fileSize: 1024,
          },
        },
      });

      const result = await handlers.downloadCiArtifact({ artifactId: 'artifact-401' });

      expect(mockClient.get).toHaveBeenCalledWith('/ciArtifacts/artifact-401');
      expect(result.downloadUrl).toBe('https://example.com/download');
      expect(result.fileName).toBe('logs.zip');
    });
  });

  // ============================================================================
  // Git References Tests
  // ============================================================================

  describe('listGitReferences', () => {
    it('should list git references for a repository', async () => {
      mockClient.get.mockResolvedValue({ data: [mockGitReference] });

      const result = await handlers.listGitReferences({ repositoryId: 'repo-123' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/scmRepositories/repo-123/gitReferences',
        { limit: 100 }
      );
      expect(result.data[0].attributes.kind).toBe('BRANCH');
    });

    it('should filter by branch or tag', async () => {
      mockClient.get.mockResolvedValue({ data: [mockGitReference] });

      await handlers.listGitReferences({
        repositoryId: 'repo-123',
        filterKind: 'BRANCH',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/scmRepositories/repo-123/gitReferences',
        { limit: 100, 'filter[kind]': 'BRANCH' }
      );
    });
  });

  // ============================================================================
  // Convenience Methods Tests
  // ============================================================================

  describe('getBuildRunsSummary', () => {
    it('should return build summary with statistics', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          mockCiBuildRun,
          mockFailedBuildRun,
          {
            ...mockCiBuildRun,
            id: 'buildrun-running',
            attributes: {
              ...mockCiBuildRun.attributes,
              number: 44,
              executionProgress: 'RUNNING',
              completionStatus: undefined,
            },
          },
          {
            ...mockCiBuildRun,
            id: 'buildrun-pending',
            attributes: {
              ...mockCiBuildRun.attributes,
              number: 45,
              executionProgress: 'PENDING',
              completionStatus: undefined,
            },
          },
        ],
      });

      const result = await handlers.getBuildRunsSummary({ workflowId: 'workflow-456' });

      expect(result.total).toBe(4);
      expect(result.statistics.succeeded).toBe(1);
      expect(result.statistics.failed).toBe(1);
      expect(result.statistics.running).toBe(1);
      expect(result.statistics.pending).toBe(1);
      expect(result.builds[0].commitAuthor).toBe('John Doe');
    });
  });

  describe('getBuildFailureDetails', () => {
    it('should return detailed failure information', async () => {
      // Mock the build run response
      mockClient.get
        .mockResolvedValueOnce({ data: mockFailedBuildRun })
        // Mock the actions response
        .mockResolvedValueOnce({ data: [mockCiBuildAction] })
        // Mock the issues response for the failed action
        .mockResolvedValueOnce({ data: [mockCiIssue] })
        // Mock the test results response for the test action
        .mockResolvedValueOnce({ data: [mockCiTestResult] });

      const result = await handlers.getBuildFailureDetails({ buildRunId: 'buildrun-failed' });

      expect(result.buildRun.id).toBe('buildrun-failed');
      expect(result.failedActions).toHaveLength(1);
      expect(result.failedActions[0].issues).toHaveLength(1);
      expect(result.failedActions[0].testResults).toHaveLength(1);
    });

    it('should handle builds with no failed actions', async () => {
      const passingAction = {
        ...mockCiBuildAction,
        attributes: {
          ...mockCiBuildAction.attributes,
          completionStatus: 'SUCCEEDED',
        },
      };

      mockClient.get
        .mockResolvedValueOnce({ data: mockCiBuildRun })
        .mockResolvedValueOnce({ data: [passingAction] });

      const result = await handlers.getBuildFailureDetails({ buildRunId: 'buildrun-789' });

      expect(result.failedActions).toHaveLength(0);
    });
  });
});

describe('XcodeCloudHandlers - Validation', () => {
  let handlers: XcodeCloudHandlers;
  let mockClient: {
    get: Mock;
    post: Mock;
    delete: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    handlers = new XcodeCloudHandlers(mockClient as unknown as AppStoreConnectClient);
  });

  it('getCiProduct should require productId', async () => {
    await expect(
      handlers.getCiProduct({ productId: '' })
    ).rejects.toThrow();
  });

  it('listCiWorkflows should require productId', async () => {
    await expect(
      handlers.listCiWorkflows({ productId: '' })
    ).rejects.toThrow();
  });

  it('getCiWorkflow should require workflowId', async () => {
    await expect(
      handlers.getCiWorkflow({ workflowId: '' })
    ).rejects.toThrow();
  });

  it('getCiBuildRun should require buildRunId', async () => {
    await expect(
      handlers.getCiBuildRun({ buildRunId: '' })
    ).rejects.toThrow();
  });

  it('startCiBuildRun should require workflowId', async () => {
    await expect(
      handlers.startCiBuildRun({ workflowId: '' })
    ).rejects.toThrow();
  });

  it('cancelCiBuildRun should require buildRunId', async () => {
    await expect(
      handlers.cancelCiBuildRun({ buildRunId: '' })
    ).rejects.toThrow();
  });

  it('listCiBuildActions should require buildRunId', async () => {
    await expect(
      handlers.listCiBuildActions({ buildRunId: '' })
    ).rejects.toThrow();
  });

  it('getCiBuildAction should require actionId', async () => {
    await expect(
      handlers.getCiBuildAction({ actionId: '' })
    ).rejects.toThrow();
  });

  it('listCiIssues should require buildActionId', async () => {
    await expect(
      handlers.listCiIssues({ buildActionId: '' })
    ).rejects.toThrow();
  });

  it('listCiTestResults should require buildActionId', async () => {
    await expect(
      handlers.listCiTestResults({ buildActionId: '' })
    ).rejects.toThrow();
  });

  it('listCiArtifacts should require buildActionId', async () => {
    await expect(
      handlers.listCiArtifacts({ buildActionId: '' })
    ).rejects.toThrow();
  });

  it('downloadCiArtifact should require artifactId', async () => {
    await expect(
      handlers.downloadCiArtifact({ artifactId: '' })
    ).rejects.toThrow();
  });

  it('listGitReferences should require repositoryId', async () => {
    await expect(
      handlers.listGitReferences({ repositoryId: '' })
    ).rejects.toThrow();
  });

  it('getBuildFailureDetails should require buildRunId', async () => {
    await expect(
      handlers.getBuildFailureDetails({ buildRunId: '' })
    ).rejects.toThrow();
  });
});
