# Git Safety Measures

After the merge corruption incident on 2026-02-12, the following safety measures were implemented:

## Git Config Changes (Global)

```bash
git config --global mergetool.keepbackup true
git config --global merge.conflictstyle diff3
git config --global merge.renormalize true
```

## Git Hooks (Local)

### Pre-commit Hook
- **Location**: `.git/hooks/pre-commit`
- **Purpose**: Prevents committing empty TypeScript files
- **Action**: Scans all staged `.ts` and `.tsx` files and blocks commit if any are empty
- **Also runs**: `bun run typecheck && bun run test`

### Post-merge Hook
- **Location**: `.git/hooks/post-merge`
- **Purpose**: Detects file corruption immediately after merges
- **Action**: Checks critical files (routes.ts, App.tsx, store.ts, EditorPanel.tsx) and exits with error if any are empty
- **Benefit**: Catches corruption before you waste time debugging

## Critical Files Monitored

- `web/server/routes.ts`
- `web/src/App.tsx`
- `web/src/store.ts`
- `web/src/components/EditorPanel.tsx`

## Recovery Procedure

If corruption is detected:

```bash
# Restore from backup branch
git show backup-before-remerge:<file> > <file>

# Or check for .orig backups (now kept by default)
ls -la *.orig
```

## Future Merge Strategy

For complex upstream merges:
1. Create backup branch first
2. Use `git merge --no-commit` to stage without committing
3. Review changes before final commit
4. Or let human handle merge with IDE merge tool
