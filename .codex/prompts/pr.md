---
description: Create a PR, wait for user confirmation, then merge and cleanup
---

1. Sync with master:
   - Run `git fetch origin && git rebase origin/master`

2. Push current branch:
   - Run `git push -u origin HEAD`

3. Create PR via web:
   - Run `gh pr create --fill --web`

4. **WAIT FOR USER INTERACTION**:
   - Ask the user to review the PR on the web.
   - Ask the user to confirm when they are ready to merge.

5. Merge and cleanup:
   - Run `gh pr merge --squash --delete-branch --auto`
   - Run `git remote prune origin`
