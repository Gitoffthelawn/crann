# Release Process

This document explains how to contribute to Crann and how releases are published.

## Overview

Crann uses a **tag-based release workflow**:
- Pushing to `main` does **not** trigger a release
- Only pushing a version tag (e.g., `v2.0.3`) triggers the release workflow
- The release workflow builds, tests, and publishes to npm

This gives full control over when releases happen while keeping automation benefits.

---

## Day-to-Day Development

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
# or: fix/bug-description, docs/update-readme, etc.
```

### 2. Make Your Changes

- Write code
- Add/update tests
- Run tests locally: `npm test`
- Run build locally: `npm run build`

### 3. Commit and Push

```bash
git add .
git commit -m "feat: add new feature"
git push -u origin feature/my-feature
```

### 4. Create a Pull Request

- Open a PR on GitHub
- Get review if needed
- Merge when ready

### 5. After Merge

Your changes are now on `main` but **not yet released**. They'll be included in the next release.

---

## Creating a Release

When you're ready to publish a new version to npm:

### 1. Pull Latest Main

```bash
git checkout main
git pull origin main
```

### 2. Decide Version Bump

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking changes | `major` | 2.0.0 → 3.0.0 |
| New features (backward compatible) | `minor` | 2.0.0 → 2.1.0 |
| Bug fixes | `patch` | 2.0.0 → 2.0.1 |

### 3. Bump the Version

```bash
npm version patch --no-git-tag-version
# or: npm version minor --no-git-tag-version
# or: npm version major --no-git-tag-version
```

This updates `package.json` and `package-lock.json` but does NOT create a git tag (we do that manually for control).

### 4. Commit the Version Bump

```bash
git add .
git commit -m "chore: bump to x.x.x"
git push origin main
```

### 5. Create and Push the Tag

```bash
git tag v2.0.4  # Use the actual version number
git push origin v2.0.4
```

### 6. Watch the Release

The GitHub Actions workflow will:
1. Build the package
2. Run all tests
3. Verify the tag matches `package.json` version
4. Create a GitHub Release with auto-generated notes
5. Publish to npm

Check progress at: https://github.com/moclei/crann/actions

---

## Quick Reference

```bash
# Full release flow (after merging PRs)
git checkout main
git pull origin main
npm version patch --no-git-tag-version  # or minor/major
git add . && git commit -m "chore: bump to x.x.x"
git push origin main
git tag vx.x.x
git push origin vx.x.x
```

---

## Troubleshooting

### Release Failed

Check the GitHub Actions log. Common issues:

1. **Version mismatch**: Tag version doesn't match `package.json`
   - Fix: Create a new tag with the correct version

2. **Tests failed**: A test is failing
   - Fix: Fix the test, bump version again, create new tag

3. **npm auth failed**: `NPM_TOKEN` secret is invalid
   - Fix: Update the secret in GitHub repo settings

### Wrong Version Published

If you published the wrong version:
1. You can publish a new patch version with the fix
2. npm allows deprecating versions: `npm deprecate crann@x.x.x "Use x.x.y instead"`
3. npm does NOT allow unpublishing recent versions (security policy)

### Need to Re-release Same Version

You can't publish the same version twice to npm. Bump to the next patch version instead.

---

## Commit Message Convention

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix a bug
docs: documentation changes
chore: maintenance (deps, config, etc.)
refactor: code changes that don't add features or fix bugs
test: adding or updating tests
```

Examples:
```
feat: add useCrannReady hook
fix: prevent state race condition on reconnect
docs: update README with v2 migration guide
chore: bump to 2.0.4
```

---

## Branch Naming

Use descriptive prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance

Examples:
```
feature/add-persistence-option
fix/agent-disconnect-cleanup
docs/update-api-reference
```

