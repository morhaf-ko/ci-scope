import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, it } from "node:test";

const script = fileURLToPath(new URL("../scope.sh", import.meta.url));
const roots = [];
const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function git(root, ...args) {
  const result = spawnSync("git", ["-c", "user.name=CI scope fixture", "-c", "user.email=ci-scope@example.test", ...args], { cwd: root, env, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, path, content = "changed\n") {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "morhaf-ci-scope-"));
  roots.push(root);
  git(root, "init", "-q");
  write(root, "src/runtime.ts", "export const value = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "Initial fixture");
  return { root, base: git(root, "rev-parse", "HEAD") };
}

function scope(root, base, head, profile = "default") {
  const result = spawnSync("bash", [script, base, head, profile], { cwd: root, env, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout.trim();
}

it("default policy works without a language runtime or repository-specific commands", () => {
  const { root, base } = fixture();
  for (const path of ["docs/guide.md", "README.md", "AGENTS.md", ".github/ISSUE_TEMPLATE/request.yml"]) write(root, path);
  git(root, "add", ".");
  git(root, "commit", "-qm", "Metadata fixture");
  assert.equal(scope(root, base, git(root, "rev-parse", "HEAD")), "false");
});

it("Founder producer-only changes are skipped only under the explicit Founder profile", () => {
  const { root, base } = fixture();
  for (const path of ["tests/generator/contract.test.ts", "template/VERSION", "template/core/files/AGENTS.md", "template/core/files/README.md", "template/core/files/DEVELOPMENT.md", "template/core/files/UX.md", "template/targets/web/files/BROWSER.md"]) write(root, path);
  git(root, "add", ".");
  git(root, "commit", "-qm", "Producer fixture");
  const head = git(root, "rev-parse", "HEAD");
  assert.equal(scope(root, base, head), "true");
  assert.equal(scope(root, base, head, "founder-template"), "false");
  assert.equal(scope(root, base, head, "unknown-profile"), "true");
});

for (const path of ["src/runtime.ts", "scripts/generator.ts", ".github/workflows/ci.yml", ".github/actions/ci-scope/scope.sh", "package.json", "bun.lock", "go.mod", "template/manifests/catalog.ts", "template/core/files/lib/runtime.ts", "template/core/files/tests/runtime.test.ts", "template/modules/blog/files/content/post.mdx", "template/new-capability.md", "unknown-input"]) {
  it(`${path} requires runtime validation in both profiles`, () => {
    const { root, base } = fixture();
    write(root, path);
    git(root, "add", ".");
    git(root, "commit", "-qm", "Runtime fixture");
    const head = git(root, "rev-parse", "HEAD");
    for (const profile of ["default", "founder-template"]) assert.equal(scope(root, base, head, profile), "true");
  });
}

it("renaming runtime source into metadata cannot hide its deletion", () => {
  const { root, base } = fixture();
  renameSync(join(root, "src/runtime.ts"), join(root, "README.md"));
  git(root, "add", "-A");
  git(root, "commit", "-qm", "Rename fixture");
  assert.equal(scope(root, base, git(root, "rev-parse", "HEAD")), "true");
});

it("large native Git diffs and newline filenames cannot hide runtime input", () => {
  const { root, base } = fixture();
  write(root, "z-runtime\ninput.ts");
  git(root, "add", ".");
  const blob = git(root, "rev-parse", "HEAD:src/runtime.ts");
  const input = Array.from({ length: 3100 }, (_, index) => `100644 ${blob}\tdocs/${index}.md\n`).join("");
  const indexed = spawnSync("git", ["update-index", "--index-info"], { cwd: root, env, input, encoding: "utf8", timeout: 5000 });
  assert.equal(indexed.status, 0, indexed.stderr);
  git(root, "commit", "-qm", "Large fixture");
  assert.equal(scope(root, base, git(root, "rev-parse", "HEAD")), "true");
});

it("unavailable history and malformed revisions fail closed", () => {
  const { root, base } = fixture();
  for (const revision of ["", "0".repeat(40), "f".repeat(40), "HEAD", "--output=other"]) {
    assert.equal(scope(root, revision, base), "true");
    assert.equal(scope(root, base, revision), "true");
  }
});
