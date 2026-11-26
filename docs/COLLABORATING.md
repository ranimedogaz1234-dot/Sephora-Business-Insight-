# Collaborating on GitHub

## Set up the repository

Use the exact repository URL supplied by the owner. This checkout has an empty local seed commit on `main`. If GitHub still has no branches, publish that seed only after the owner approves the one-time setup. Then publish the feature branch and open its pull request. If GitHub already has a `main`, use its latest commit as the base and cherry-pick the setup commit onto a branch based on that history. Resolve any README overlap and rerun the checks. Avoid replacing the remote history.

The repository owner can invite their binôme under **Settings → Collaborators → Add people**. Invite their GitHub username. A collaborator on a personal repository can contribute code and review pull requests after accepting the invitation. Each person should configure their own Git commit name and GitHub-associated email, or GitHub’s private commit email, so contributions are attributed correctly. [GitHub invitation instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)

Under **Settings → Branches**, protect `main` by requiring a pull request and at least one approving review. Dismiss stale approvals after new commits, require resolved conversations, and keep force pushes and deletion disabled. Apply the rule to administrators as appropriate. After the first workflow run appears, add the `verify` job as a required status check. Keep automatic merging disabled. [GitHub branch protection instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)

## Feature branches and reviews

1. Run `git switch main` and `git pull --ff-only origin main` before creating the approved milestone branch.
2. Run the relevant tests, stage only intended files, inspect `git diff --cached`, and run the security scan before committing.
3. After push approval, run `git push -u origin <branch>`. Open a pull request with base `main` and compare set to your feature branch.
4. Add your binôme under **Reviewers**. The reviewer reads **Files changed**, runs the checks as needed, then submits **Approve** or **Request changes** from their own account. Address requested changes on the same feature branch.
5. Merge only after required checks and a real approval pass and the owner confirms. Both collaborators then update local `main` with `git pull --ff-only origin main`.

To synchronize an existing feature branch with new work, run `git fetch origin`, switch to the feature branch, and merge `origin/main` locally. Coordinate with your binôme before rewriting a shared branch.

## Local and automated security checks

Enable the repository hooks after cloning.

```powershell
git config core.hooksPath .githooks
python scripts/check_public_repo.py
```

Use Python on PATH or set `SEPHORA_PYTHON` to the local Python executable for the hooks. The scanner checks staged content and reachable history for blocked files, common credential patterns, personal email addresses and local user paths. The hooks also block new commits made with a personal email address, so set your GitHub noreply address for this repository first (`git config user.email <id>+<username>@users.noreply.github.com`, shown under GitHub → Settings → Emails). See [SECURITY.md](../SECURITY.md) for the full list. Review the diff as well. If Git cannot execute a hook, fix the shell or Python configuration before pushing. Run the scanner again after your final commit. The read-only verification workflow checks the repository, dependencies, API import, and frontend build on GitHub.

Store credentials in backend environment variables. Keep local `.env` files, CSVs, and data caches out of Git. Before publishing any dataset, verify its redistribution license and obtain the owner’s approval. Before public API deployment, add authentication, authorization, and rate limits to sensitive routes.
