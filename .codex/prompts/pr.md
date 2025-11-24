---
description: Create a PR, wait for user confirmation, then merge and cleanup
---

1. Check and create branch:
   - Check if the current branch is the default branch (e.g., `master` or `main`).
   - If it is:
     - Ask the user for a short name and create a new branch `feat/<short-name>`.
     - Switch to the new branch (uncommitted changes will be carried over automatically).

2. Check for uncommitted changes:
   - Run `git status --porcelain` to check for a dirty working tree.
   - If there are changes, **WAIT FOR USER INTERACTION**:
     - Ask the user to commit their changes.
     - Wait for the user to confirm they have committed.

3. Sync with master:
   - Run `git fetch origin && git rebase origin/master`

4. Push current branch:
   - Run `git push -u origin HEAD`

5. Create PR via web:
   - Run `gh pr create --fill --web`

6. **WAIT FOR USER INTERACTION**:
   - Ask the user to review the PR on the web.
   - Ask the user to confirm when they are ready to merge.

7. Merge and cleanup:
   - Run `gh pr merge --squash --delete-branch --auto`
   - Run `git remote prune origin`
