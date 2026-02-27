import type { PermissionRequest, ChatMessage, SessionState } from "../types.js";
import type { TaskItem } from "../types.js";
import type { UpdateInfo, GitHubPRInfo, LinearIssue, LinearComment } from "../api.js";
import type { McpServerDetail } from "../types.js";

// ─── Mock Data ──────────────────────────────────────────────────────────────

export const MOCK_SESSION_ID = "playground-session";

export function mockPermission(overrides: Partial<PermissionRequest> & { tool_name: string; input: Record<string, unknown> }): PermissionRequest {
  return {
    request_id: `perm-${Math.random().toString(36).slice(2, 8)}`,
    tool_use_id: `tu-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...overrides,
  };
}

export const PERM_BASH = mockPermission({
  tool_name: "Bash",
  input: {
    command: "git log --oneline -20 && npm run build",
    description: "View recent commits and build the project",
  },
  permission_suggestions: [
    {
      type: "addRules" as const,
      rules: [{ toolName: "Bash", ruleContent: "git log --oneline -20 && npm run build" }],
      behavior: "allow" as const,
      destination: "session" as const,
    },
    {
      type: "addRules" as const,
      rules: [{ toolName: "Bash", ruleContent: "git log --oneline -20 && npm run build" }],
      behavior: "allow" as const,
      destination: "projectSettings" as const,
    },
  ],
});

export const PERM_EDIT = mockPermission({
  tool_name: "Edit",
  input: {
    file_path: "/Users/stan/Dev/project/src/utils/format.ts",
    old_string: 'export function formatDate(d: Date) {\n  return d.toISOString();\n}',
    new_string: 'export function formatDate(d: Date, locale = "en-US") {\n  return d.toLocaleDateString(locale, {\n    year: "numeric",\n    month: "short",\n    day: "numeric",\n  });\n}',
  },
  permission_suggestions: [
    {
      type: "addRules" as const,
      rules: [{ toolName: "Edit" }],
      behavior: "allow" as const,
      destination: "session" as const,
    },
  ],
});

export const PERM_WRITE = mockPermission({
  tool_name: "Write",
  input: {
    file_path: "/Users/stan/Dev/project/src/config.ts",
    content: 'export const config = {\n  apiUrl: "https://api.example.com",\n  timeout: 5000,\n  retries: 3,\n  debug: process.env.NODE_ENV !== "production",\n};\n',
  },
});

export const PERM_READ = mockPermission({
  tool_name: "Read",
  input: { file_path: "/Users/stan/Dev/project/package.json" },
  permission_suggestions: [
    {
      type: "addRules" as const,
      rules: [{ toolName: "Read" }],
      behavior: "allow" as const,
      destination: "session" as const,
    },
    {
      type: "addRules" as const,
      rules: [{ toolName: "Read" }],
      behavior: "allow" as const,
      destination: "userSettings" as const,
    },
  ],
});

export const PERM_GLOB = mockPermission({
  tool_name: "Glob",
  input: { pattern: "**/*.test.ts", path: "/Users/stan/Dev/project/src" },
});

export const PERM_GREP = mockPermission({
  tool_name: "Grep",
  input: { pattern: "TODO|FIXME|HACK", path: "/Users/stan/Dev/project/src", glob: "*.ts" },
});

export const PERM_EXIT_PLAN = mockPermission({
  tool_name: "ExitPlanMode",
  input: {
    plan: `## Summary\nRefactor the authentication module to use JWT tokens instead of session cookies.\n\n## Changes\n1. **Add JWT utility** — new \`src/auth/jwt.ts\` with sign/verify helpers\n2. **Update middleware** — modify \`src/middleware/auth.ts\` to validate Bearer tokens\n3. **Migrate login endpoint** — return JWT in response body instead of Set-Cookie\n4. **Update tests** — adapt all auth tests to use token-based flow\n\n## Test plan\n- Run \`npm test -- --grep auth\`\n- Manual test with curl`,
    allowedPrompts: [
      { tool: "Bash", prompt: "run tests" },
      { tool: "Bash", prompt: "install dependencies" },
    ],
  },
});

export const PERM_GENERIC = mockPermission({
  tool_name: "WebSearch",
  input: { query: "TypeScript 5.5 new features", allowed_domains: ["typescriptlang.org", "github.com"] },
  description: "Search the web for TypeScript 5.5 features",
});

export const PERM_DYNAMIC = mockPermission({
  tool_name: "dynamic:code_interpreter",
  input: { code: "print('hello from dynamic tool')" },
  description: "Custom tool call: code_interpreter",
});

export const PERM_ASK_SINGLE = mockPermission({
  tool_name: "AskUserQuestion",
  input: {
    questions: [
      {
        header: "Auth method",
        question: "Which authentication method should we use for the API?",
        options: [
          { label: "JWT tokens (Recommended)", description: "Stateless, scalable, works well with microservices" },
          { label: "Session cookies", description: "Traditional approach, simpler but requires session storage" },
          { label: "OAuth 2.0", description: "Delegated auth, best for third-party integrations" },
        ],
        multiSelect: false,
      },
    ],
  },
});

export const PERM_ASK_MULTI = mockPermission({
  tool_name: "AskUserQuestion",
  input: {
    questions: [
      {
        header: "Database",
        question: "Which database should we use?",
        options: [
          { label: "PostgreSQL", description: "Relational, strong consistency" },
          { label: "MongoDB", description: "Document store, flexible schema" },
        ],
        multiSelect: false,
      },
      {
        header: "Cache",
        question: "Do you want to add a caching layer?",
        options: [
          { label: "Redis", description: "In-memory, fast, supports pub/sub" },
          { label: "No cache", description: "Keep it simple for now" },
        ],
        multiSelect: false,
      },
    ],
  },
});

// AI Validation mock: uncertain verdict (shown to user with recommendation)
export const PERM_AI_UNCERTAIN = mockPermission({
  tool_name: "Bash",
  input: { command: "npm install --save-dev @types/react" },
  ai_validation: { verdict: "uncertain", reason: "Package installation modifies node_modules", ruleBasedOnly: false },
});

// AI Validation mock: safe recommendation (shown when auto-approve is off)
export const PERM_AI_SAFE = mockPermission({
  tool_name: "Bash",
  input: { command: "git status" },
  ai_validation: { verdict: "safe", reason: "Read-only git command", ruleBasedOnly: false },
});

// AI Validation mock: dangerous recommendation (shown when auto-deny is off)
export const PERM_AI_DANGEROUS = mockPermission({
  tool_name: "Bash",
  input: { command: "rm -rf node_modules && rm -rf .git" },
  ai_validation: { verdict: "dangerous", reason: "Recursive delete of project files", ruleBasedOnly: false },
});

// Messages
export const MSG_USER: ChatMessage = {
  id: "msg-1",
  role: "user",
  content: "Can you help me refactor the authentication module to use JWT tokens?",
  timestamp: Date.now() - 60000,
};

export const MSG_USER_IMAGE: ChatMessage = {
  id: "msg-2",
  role: "user",
  content: "Here's a screenshot of the error I'm seeing",
  images: [
    {
      media_type: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==",
    },
  ],
  timestamp: Date.now() - 55000,
};

export const MSG_ASSISTANT: ChatMessage = {
  id: "msg-3",
  role: "assistant",
  content: "",
  contentBlocks: [
    {
      type: "text",
      text: "I'll help you refactor the authentication module. Let me first look at the current implementation.\n\nHere's what I found:\n- The current auth uses **session cookies** via `express-session`\n- Sessions are stored in a `MemoryStore` (not production-ready)\n- The middleware checks `req.session.userId`\n\n```typescript\n// Current implementation\napp.use(session({\n  secret: process.env.SESSION_SECRET,\n  resave: false,\n  saveUninitialized: false,\n}));\n```\n\n| Feature | Cookies | JWT |\n|---------|---------|-----|\n| Stateless | No | Yes |\n| Scalable | Limited | Excellent |\n| Revocation | Easy | Needs blocklist |\n",
    },
  ],
  timestamp: Date.now() - 50000,
};

export const MSG_ASSISTANT_TOOLS: ChatMessage = {
  id: "msg-4",
  role: "assistant",
  content: "",
  contentBlocks: [
    { type: "text", text: "Let me check the current auth files." },
    {
      type: "tool_use",
      id: "tu-1",
      name: "Glob",
      input: { pattern: "src/auth/**/*.ts" },
    },
    {
      type: "tool_result",
      tool_use_id: "tu-1",
      content: "src/auth/middleware.ts\nsrc/auth/login.ts\nsrc/auth/session.ts",
    },
    {
      type: "tool_use",
      id: "tu-2",
      name: "Read",
      input: { file_path: "src/auth/middleware.ts" },
    },
    {
      type: "tool_result",
      tool_use_id: "tu-2",
      content: 'export function authMiddleware(req, res, next) {\n  if (!req.session.userId) {\n    return res.status(401).json({ error: "Unauthorized" });\n  }\n  next();\n}',
    },
    { type: "text", text: "Now I understand the current structure. Let me create the JWT utility." },
  ],
  timestamp: Date.now() - 45000,
};

export const MSG_ASSISTANT_THINKING: ChatMessage = {
  id: "msg-5",
  role: "assistant",
  content: "",
  contentBlocks: [
    {
      type: "thinking",
      thinking: "Let me think about the best approach here. The user wants to migrate from session cookies to JWT. I need to:\n1. Create a JWT sign/verify utility\n2. Update the middleware to read Authorization header\n3. Change the login endpoint to return a token\n4. Update all tests\n\nI should use jsonwebtoken package for signing and jose for verification in edge environments. But since this is a Node.js server, jsonwebtoken is fine.\n\nThe token should contain: userId, role, iat, exp. Expiry should be configurable. I'll also add a refresh token mechanism.",
    },
    { type: "text", text: "I've analyzed the codebase and have a clear plan. Let me start implementing." },
  ],
  timestamp: Date.now() - 40000,
};

export const MSG_ASSISTANT_STREAMING: ChatMessage = {
  id: "msg-streaming",
  role: "assistant",
  content: "Scanning auth files and drafting migration steps...",
  isStreaming: true,
  timestamp: Date.now() - 35000,
};

export const MSG_SYSTEM: ChatMessage = {
  id: "msg-6",
  role: "system",
  content: "Context compacted successfully",
  timestamp: Date.now() - 30000,
};

// Tool result with error
export const MSG_TOOL_ERROR: ChatMessage = {
  id: "msg-7",
  role: "assistant",
  content: "",
  contentBlocks: [
    { type: "text", text: "Let me try running the tests." },
    {
      type: "tool_use",
      id: "tu-3",
      name: "Bash",
      input: { command: "npm test -- --grep auth" },
    },
    {
      type: "tool_result",
      tool_use_id: "tu-3",
      content: "FAIL src/auth/__tests__/middleware.test.ts\n  ● Auth Middleware › should reject expired tokens\n    Expected: 401\n    Received: 500\n\n    TypeError: Cannot read property 'verify' of undefined",
      is_error: true,
    },
    { type: "text", text: "There's a test failure. Let me fix the issue." },
  ],
  timestamp: Date.now() - 20000,
};

// Tasks
export const MOCK_TASKS: TaskItem[] = [
  { id: "1", subject: "Create JWT utility module", description: "", status: "completed" },
  { id: "2", subject: "Update auth middleware", description: "", status: "completed", activeForm: "Updating auth middleware" },
  { id: "3", subject: "Migrate login endpoint", description: "", status: "in_progress", activeForm: "Refactoring login to return JWT" },
  { id: "4", subject: "Add refresh token support", description: "", status: "pending" },
  { id: "5", subject: "Update all auth tests", description: "", status: "pending", blockedBy: ["3"] },
  { id: "6", subject: "Run full test suite and fix failures", description: "", status: "pending", blockedBy: ["5"] },
];

// Tool group items (for ToolMessageGroup mock)
export const MOCK_TOOL_GROUP_ITEMS = [
  { id: "tg-1", name: "Read", input: { file_path: "src/auth/middleware.ts" } },
  { id: "tg-2", name: "Read", input: { file_path: "src/auth/login.ts" } },
  { id: "tg-3", name: "Read", input: { file_path: "src/auth/session.ts" } },
  { id: "tg-4", name: "Read", input: { file_path: "src/auth/types.ts" } },
];

export const MOCK_SUBAGENT_TOOL_ITEMS = [
  { id: "sa-1", name: "Grep", input: { pattern: "useAuth", path: "src/" } },
  { id: "sa-2", name: "Grep", input: { pattern: "session.userId", path: "src/" } },
];

// GitHub PR mock data
export const MOCK_PR_FAILING: GitHubPRInfo = {
  number: 162,
  title: "feat: add dark mode toggle to application settings",
  url: "https://github.com/example/project/pull/162",
  state: "OPEN",
  isDraft: false,
  reviewDecision: "CHANGES_REQUESTED",
  additions: 91,
  deletions: 88,
  changedFiles: 24,
  checks: [
    { name: "CI / Build", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "CI / Test", status: "COMPLETED", conclusion: "FAILURE" },
    { name: "CI / Lint", status: "COMPLETED", conclusion: "SUCCESS" },
  ],
  checksSummary: { total: 3, success: 2, failure: 1, pending: 0 },
  reviewThreads: { total: 4, resolved: 2, unresolved: 2 },
};

export const MOCK_PR_PASSING: GitHubPRInfo = {
  number: 158,
  title: "fix: prevent mobile keyboard layout shift and iOS zoom",
  url: "https://github.com/example/project/pull/158",
  state: "OPEN",
  isDraft: false,
  reviewDecision: "APPROVED",
  additions: 42,
  deletions: 12,
  changedFiles: 3,
  checks: [
    { name: "CI / Build", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "CI / Test", status: "COMPLETED", conclusion: "SUCCESS" },
  ],
  checksSummary: { total: 2, success: 2, failure: 0, pending: 0 },
  reviewThreads: { total: 1, resolved: 1, unresolved: 0 },
};

export const MOCK_PR_DRAFT: GitHubPRInfo = {
  number: 165,
  title: "refactor: migrate auth module to JWT tokens with refresh support",
  url: "https://github.com/example/project/pull/165",
  state: "OPEN",
  isDraft: true,
  reviewDecision: null,
  additions: 340,
  deletions: 156,
  changedFiles: 18,
  checks: [
    { name: "CI / Build", status: "IN_PROGRESS", conclusion: null },
    { name: "CI / Test", status: "QUEUED", conclusion: null },
  ],
  checksSummary: { total: 2, success: 0, failure: 0, pending: 2 },
  reviewThreads: { total: 0, resolved: 0, unresolved: 0 },
};

export const MOCK_PR_MERGED: GitHubPRInfo = {
  number: 155,
  title: "feat(cli): add service install/uninstall and separate dev/prod ports",
  url: "https://github.com/example/project/pull/155",
  state: "MERGED",
  isDraft: false,
  reviewDecision: "APPROVED",
  additions: 287,
  deletions: 63,
  changedFiles: 11,
  checks: [
    { name: "CI / Build", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "CI / Test", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "CI / Lint", status: "COMPLETED", conclusion: "SUCCESS" },
  ],
  checksSummary: { total: 3, success: 3, failure: 0, pending: 0 },
  reviewThreads: { total: 3, resolved: 3, unresolved: 0 },
};

// MCP server mock data
export const MOCK_MCP_SERVERS: McpServerDetail[] = [
  {
    name: "filesystem",
    status: "connected",
    config: { type: "stdio", command: "npx", args: ["-y", "@anthropic/mcp-fs"] },
    scope: "project",
    tools: [
      { name: "read_file", annotations: { readOnly: true } },
      { name: "write_file", annotations: { destructive: true } },
      { name: "list_directory", annotations: { readOnly: true } },
    ],
  },
  {
    name: "github",
    status: "connected",
    config: { type: "stdio", command: "npx", args: ["-y", "@anthropic/mcp-github"] },
    scope: "user",
    tools: [
      { name: "create_issue" },
      { name: "list_prs", annotations: { readOnly: true } },
      { name: "create_pr" },
    ],
  },
  {
    name: "postgres",
    status: "failed",
    error: "Connection refused: ECONNREFUSED 127.0.0.1:5432",
    config: { type: "stdio", command: "npx", args: ["-y", "@anthropic/mcp-postgres"] },
    scope: "project",
    tools: [],
  },
  {
    name: "web-search",
    status: "disabled",
    config: { type: "sse", url: "http://localhost:8080/sse" },
    scope: "user",
    tools: [{ name: "search", annotations: { readOnly: true, openWorld: true } }],
  },
  {
    name: "docker",
    status: "connecting",
    config: { type: "stdio", command: "docker-mcp-server" },
    scope: "project",
    tools: [],
  },
];

// Linear issue mock data
export const MOCK_LINEAR_ISSUE_ACTIVE: LinearIssue = {
  id: "issue-1",
  identifier: "THE-147",
  title: "Associer un ticket Linear a une session dans le panneau lateral droit",
  description: "Pouvoir associer un ticket Linear a une session.",
  url: "https://linear.app/thevibecompany/issue/THE-147",
  branchName: "the-147-associer-un-ticket-linear",
  priorityLabel: "High",
  stateName: "In Progress",
  stateType: "started",
  teamName: "Thevibecompany",
  teamKey: "THE",
  teamId: "team-the",
};

export const MOCK_LINEAR_ISSUE_DONE: LinearIssue = {
  id: "issue-2",
  identifier: "ENG-256",
  title: "Fix authentication flow for SSO users",
  description: "SSO users get a blank page after login redirect.",
  url: "https://linear.app/team/issue/ENG-256",
  branchName: "eng-256-fix-auth-flow-sso",
  priorityLabel: "Urgent",
  stateName: "Done",
  stateType: "completed",
  teamName: "Engineering",
  teamKey: "ENG",
  teamId: "team-eng",
};

export const MOCK_LINEAR_COMMENTS: LinearComment[] = [
  { id: "c1", body: "Started working on the sidebar integration", createdAt: new Date(Date.now() - 3600_000).toISOString(), userName: "Alice" },
  { id: "c2", body: "Added the search component, LGTM", createdAt: new Date(Date.now() - 1800_000).toISOString(), userName: "Bob" },
  { id: "c3", body: "Testing the polling flow now", createdAt: new Date(Date.now() - 300_000).toISOString(), userName: "Alice" },
];

// Mock session for the main playground useEffect
export function createMockSession(): SessionState {
  return {
    session_id: MOCK_SESSION_ID,
    backend_type: "claude",
    model: "claude-sonnet-4-5",
    cwd: "/Users/stan/Dev/project",
    tools: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "WebSearch"],
    permissionMode: "default",
    claude_code_version: "1.0.0",
    mcp_servers: [],
    agents: [],
    slash_commands: ["explain", "review", "fix"],
    skills: ["doc-coauthoring", "frontend-design"],
    total_cost_usd: 0.1847,
    num_turns: 14,
    context_used_percent: 62,
    is_compacting: false,
    git_branch: "feat/jwt-auth",
    is_worktree: false,
    is_containerized: true,
    repo_root: "/Users/stan/Dev/project",
    git_ahead: 3,
    git_behind: 0,
    total_lines_added: 142,
    total_lines_removed: 38,
  };
}

// Tool item type used in playground group components
export interface ToolItem { id: string; name: string; input: Record<string, unknown> }
