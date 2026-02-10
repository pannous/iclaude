# AppleLamps Security Fork

**Fork**: https://github.com/AppleLamps/companion
**Status**: Not yet merged into main
**Date Found**: 2026-02-10

## Overview

AppleLamps created a comprehensive security audit and fixes for the companion codebase, addressing **9 critical/high severity vulnerabilities** and 8 additional improvements.

## Critical Security Vulnerabilities Fixed

### 1. Command Injection - RCE Risk ⚠️ CRITICAL
- **Location**: `cli-launcher.ts:100`, `ws-bridge.ts:397`
- **Issue**: Unsafe `execSync` with string interpolation
- **Impact**: Remote Code Execution via malicious binary names
- **Fix**: Replaced with `execFileSync` + regex validation `/^[a-zA-Z0-9_\-\/\.]+$/`

### 2. Path Traversal - Arbitrary File Access ⚠️ CRITICAL
- **Location**: `routes.ts:60-83`
- **Issue**: No path validation in filesystem API
- **Impact**: Access to `/etc/passwd`, `/root/.ssh`, etc.
- **Fix**: Added `realpath()` + prefix validation against home directory

### 3. Missing Input Validation ⚠️ CRITICAL
- **Location**: `routes.ts:13-93`
- **Issue**: No validation for API parameters
- **Impact**: Command injection, path traversal, DoS
- **Fix**: Type checking, length limits, regex validation, whitelisted env vars

### 4. Unhandled Promise Rejections ⚠️ HIGH
- **Location**: `cli-launcher.ts:317-326`, UI components
- **Issue**: Missing error handlers on async ops
- **Fix**: Added `.catch()` handlers and try-catch blocks

### 5. Race Condition - Resource Leak ⚠️ HIGH
- **Location**: `ws.ts:382-401`
- **Issue**: Reconnection to deleted sessions
- **Fix**: Double-check session state before reconnect

### 6. No Session Validation ⚠️ HIGH
- **Location**: `index.ts:47-80`
- **Issue**: Accepted any UUID-shaped string
- **Fix**: UUID format + existence validation

### 7. Missing Resource Cleanup ⚠️ HIGH
- **Location**: `cli-launcher.ts`, `session-store.ts`
- **Issue**: Stream readers not released, timers not cleared
- **Fix**: Added `finally` blocks and cleanup methods

### 8. JSON Type Confusion ⚠️ MEDIUM
- **Location**: `ws-bridge.ts:191-310`
- **Issue**: No schema validation after parse
- **Fix**: Structure and field validation

### 9. Infinite Stream Blocking - DoS ⚠️ MEDIUM
- **Location**: `cli-launcher.ts:285-326`
- **Issue**: No timeout on stream reads
- **Fix**: 30s timeout with proper cleanup

## Additional Improvements

1. React error boundaries for graceful error handling
2. Improved error logging throughout codebase
3. Fixed error state management in UI
4. Graceful shutdown handlers (SIGTERM/SIGINT)
5. Comprehensive SECURITY.md documentation
6. Inline comments for security-critical code
7. Documented prevention patterns
8. Code quality improvements

## Files Modified (13)

### Server (7 files)
- `web/server/cli-launcher.ts` - Command injection fix, stream handling, timeouts
- `web/server/routes.ts` - Path traversal fix, input validation
- `web/server/ws-bridge.ts` - Git command fix, JSON validation
- `web/server/index.ts` - Session validation, graceful shutdown
- `web/server/session-store.ts` - Timer cleanup
- `web/server/session-types.ts` - Type improvements

### Client (5 files)
- `web/src/components/HomePage.tsx` - Error handling
- `web/src/components/Sidebar.tsx` - Error handling
- `web/src/components/ErrorBoundary.tsx` - NEW: Error boundary component
- `web/src/App.tsx` - Error boundary integration
- `web/src/main.tsx` - Error handling improvements
- `web/src/ws.ts` - Race condition fixes

### Documentation (2 new files)
- `AUDIT_SUMMARY.md` - Comprehensive audit documentation
- `SECURITY.md` - Security improvements and prevention patterns

## Commit History

```
33a9cfb - Merge pull request #1 from AppleLamps/copilot/fix-major-flaws-in-codebase
a5b9044 - Add comprehensive audit summary document
8d9fd08 - Address code review feedback: fix timeout cleanup, expand env vars, extract UUID constant
15417d3 - Add stream timeout handling and comprehensive security documentation
2e0fb31 - Add JSON schema validation for WebSocket messages and React error boundaries
f023bf6 - Add error handling, race condition fixes, session validation, and cleanup handlers
53da313 - Fix critical security vulnerabilities (command injection, path traversal, input validation)
7f2c7af - Initial plan
```

## Prevention Patterns to Adopt

### Command Execution
```typescript
// ❌ UNSAFE
execSync(`which ${binary}`)

// ✅ SAFE
execFileSync("which", [binary])
```

### Path Validation
```typescript
const realPath = await realpath(basePath);
const allowedBase = homedir();
if (!realPath.startsWith(allowedBase + sep) && realPath !== allowedBase) {
  return error(403, "Access denied");
}
```

### Input Validation
```typescript
// Type checking, length limits, format validation, whitelisting
if (!model || typeof model !== "string" || model.length > 100) {
  return error(400, "Invalid model");
}
```

### WebSocket Message Validation
```typescript
const msg = JSON.parse(data);
if (!msg || typeof msg !== "object" || !msg.type || typeof msg.type !== "string") {
  return; // reject
}
```

## Next Steps (When Ready to Integrate)

1. Review the full SECURITY.md and AUDIT_SUMMARY.md in the fork
2. Test the security fixes thoroughly
3. Consider cherry-picking specific commits or creating a PR
4. Reach out to AppleLamps (@AppleLamps) to collaborate
5. Add security testing to the CI/CD pipeline

## Why Not Merged Yet?

- Needs thorough review and testing
- May conflict with recent changes in main
- Should coordinate with upstream maintainers
- Requires security audit verification

## Links

- Fork: https://github.com/AppleLamps/companion
- Compare: https://github.com/The-Vibe-Company/companion/compare/main...AppleLamps:companion:main
- Original repo: https://github.com/The-Vibe-Company/companion
