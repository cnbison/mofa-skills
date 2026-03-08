---
name: mofa-github
description: "Interact with GitHub using the gh CLI — issues, PRs, CI runs, API queries, release management. Triggers: github, gh, pull request, issue, CI, workflow, 代码审查"
requires_bins: [gh]
requires_env: []
---

# mofa-github

Use the `gh` CLI to interact with GitHub. Always specify `--repo owner/repo` when not in a git directory, or use URLs directly.

## Pull Requests

Check CI status on a PR:

```bash
gh pr checks 55 --repo owner/repo
```

List open PRs:

```bash
gh pr list --repo owner/repo --limit 10
```

View PR details:

```bash
gh pr view 55 --repo owner/repo
```

Create a PR:

```bash
gh pr create --title "feat: add feature" --body "Description" --repo owner/repo
```

## Issues

List open issues:

```bash
gh issue list --repo owner/repo --limit 10
```

Create an issue:

```bash
gh issue create --title "Bug: description" --body "Steps to reproduce..." --repo owner/repo
```

## CI / Workflow Runs

List recent workflow runs:

```bash
gh run list --repo owner/repo --limit 10
```

View a specific run:

```bash
gh run view <run-id> --repo owner/repo
```

View logs for failed steps only:

```bash
gh run view <run-id> --repo owner/repo --log-failed
```

Watch a run in progress:

```bash
gh run watch <run-id> --repo owner/repo
```

## API for Advanced Queries

The `gh api` command accesses any GitHub REST or GraphQL endpoint:

```bash
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'
```

List PR review comments:

```bash
gh api repos/owner/repo/pulls/55/comments --jq '.[].body'
```

## JSON Output

Most commands support `--json` for structured output with `--jq` filtering:

```bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
```

## Releases

Create a release:

```bash
gh release create v1.0.0 --title "v1.0.0" --notes "Release notes" --repo owner/repo
```

List releases:

```bash
gh release list --repo owner/repo
```

## Install

```bash
brew install gh        # macOS
sudo apt install gh    # Ubuntu/Debian
```

Then authenticate: `gh auth login`
