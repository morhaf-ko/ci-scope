# CI change scope

A composite GitHub Action that decides whether committed changes require runtime validation. It uses Bash and Git, adds no job or dependency, and prints `true` unless every changed path is explicitly allowed by the selected metadata policy.

## Caller contract

Use this action only after confirming that its metadata paths are not runtime inputs in your repository. Documentation applications whose `docs/` directory is built or served must keep runtime validation enabled instead. Keep application test, build, release and deployment commands with their owning repositories.

Check out the caller with `fetch-depth: 0` and `persist-credentials: false`. Pin this action to a reviewed full commit SHA. Run expensive validation unless `steps.scope.outputs.runtime-required` is explicitly `false`. Security and required governance checks remain independent and unconditional.

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
  with:
    persist-credentials: false
    fetch-depth: 0
- id: scope
  uses: morhaf-ko/ci-scope@REVIEWED_FULL_COMMIT_SHA
- if: ${{ steps.scope.outputs.runtime-required != 'false' }}
  run: your-native-validation-command
```

The example requires the actual reviewed commit SHA and the caller's existing validation command. No floating release tag is supported as a consumer reference.

## Interface

| Input | Default | Contract |
| --- | --- | --- |
| `base` | Pull request base SHA or push `before` SHA | Complete base commit object |
| `head` | `github.sha` | Actual checked-out commit; override for a caller that explicitly checks out another ref |
| `profile` | `default` | `default` or `founder-template` |

The `runtime-required` output is `false` only when all paths match the selected metadata policy. The default policy allows `docs/**`, root `README.md`, root `AGENTS.md` and `.github/ISSUE_TEMPLATE/**`. The explicit `founder-template` profile additionally allows generator test inputs and the producer guidance paths listed in `scope.sh`; producer tests must still run. Workflow, dependency, application and unknown paths require runtime validation.

The action inspects the complete NUL-delimited Git diff and disables rename collapsing. Missing history, malformed revisions, unsupported events and unknown profiles retain runtime validation. Infrastructure failures fail the action rather than emit an unsafe skip. It does not infer application semantics, disable security checks, authorize deployment or decide which native tests an application needs.

## Validation and releases

Run `node --test test/*.js` and `shellcheck scope.sh`. Tests use actual isolated Git repositories, including renames, more than 3,000 changed paths and newline-bearing filenames. No application service, database or credential is required.

The publisher's CI must use a fork-safe GitHub-hosted runner with read-only contents permission. It must not expose private runners, credentials or private workflow sources to fork code. The repository variable `CI_RUNNER` selects that runner. Consumers retain their own authorized runner selection.

A release requires an immutable semantic tag and successful full-SHA caller proof for metadata-only and runtime changes. Consumers update pins through their existing dependency automation and can roll back to the previous immutable SHA. Changes to the shared implementation happen here; callers retain their small input/output wiring. This action is not published to npm.
