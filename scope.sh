#!/usr/bin/env bash
set -euo pipefail

base_commit=${1:-}
head_commit=${2:-}
scope_profile=${3:-default}
full_validation() { printf '%s\n' true; exit 0; }

case "$scope_profile" in default|founder-template|runtime-docs) ;; *) full_validation ;; esac
[[ $base_commit =~ ^[0-9a-f]{40}$ && $head_commit =~ ^[0-9a-f]{40}$ ]] || full_validation
git cat-file -e "$base_commit^{commit}" 2>/dev/null || full_validation
git cat-file -e "$head_commit^{commit}" 2>/dev/null || full_validation

change_list=$(mktemp)
trap 'rm -f -- "$change_list"' EXIT
git diff --no-renames --no-ext-diff --name-only -z "$base_commit" "$head_commit" -- > "$change_list" || full_validation

while IFS= read -r -d '' changed_path; do
  case "$changed_path" in
    docs/*) [[ $scope_profile == runtime-docs ]] || continue ;;
    README.md|AGENTS.md|.github/ISSUE_TEMPLATE/*) continue ;;
  esac
  if [[ $scope_profile == founder-template ]]; then
    case "$changed_path" in
      tests/generator/*|template/VERSION|template/core/files/AGENTS.md|\
      template/core/files/README.md|template/core/files/DEVELOPMENT.md|\
      template/core/files/UX.md|template/targets/web/files/BROWSER.md) continue ;;
    esac
  fi
  full_validation
done < "$change_list"

printf '%s\n' false
