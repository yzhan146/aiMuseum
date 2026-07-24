import { spawnSync } from "node:child_process";

// These advisories are currently pulled in by Next.js itself. Next 15.5.21 and
// the current Next 16 release still pin the affected transitive packages, while
// `npm audit fix --force` incorrectly proposes downgrading the app to Next 9.
// Keep this list narrow and temporary: after the deadline CI fails even if no
// new advisories have appeared, forcing us to re-check the upstream releases.
const temporaryAllowlist = new Map([
  [1117015, "PostCSS CSS stringify XSS"],
  [1124252, "PostCSS sourceMappingURL file disclosure"],
  [1124066, "sharp/libvips inherited vulnerabilities"],
]);
const allowlistExpiresAt = new Date("2026-08-31T00:00:00Z");

const audit = spawnSync("npm", ["audit", "--audit-level=high", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

let report;
try {
  report = JSON.parse(audit.stdout || "{}");
} catch {
  console.error(audit.stdout);
  console.error(audit.stderr);
  console.error("Unable to parse npm audit output.");
  process.exit(1);
}

const highSeverityAdvisories = [];
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const advisory of vulnerability.via ?? []) {
    if (
      typeof advisory === "object" &&
      advisory !== null &&
      ["high", "critical"].includes(advisory.severity)
    ) {
      highSeverityAdvisories.push(advisory);
    }
  }
}

const unexpected = highSeverityAdvisories.filter(
  (advisory) => !temporaryAllowlist.has(advisory.source),
);
const expired = Date.now() >= allowlistExpiresAt.getTime();

if (unexpected.length > 0 || expired) {
  if (expired) {
    console.error(
      `The temporary audit allowlist expired on ${allowlistExpiresAt.toISOString()}.`,
    );
  }
  for (const advisory of unexpected) {
    console.error(
      `Unexpected ${advisory.severity} advisory ${advisory.source}: ${advisory.title}`,
    );
  }
  process.exit(1);
}

if (highSeverityAdvisories.length > 0) {
  console.warn("Temporarily allowing known Next.js transitive advisories:");
  for (const advisory of highSeverityAdvisories) {
    console.warn(`- ${advisory.source}: ${temporaryAllowlist.get(advisory.source)}`);
  }
  console.warn(`Allowlist expires ${allowlistExpiresAt.toISOString()}.`);
}

process.exit(0);
