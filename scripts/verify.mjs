import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "test:judge"]],
  ["npm", ["run", "test:supabase"]],
  ["npm", ["run", "test:supabase-migrate"]],
  ["npm", ["run", "test:workflows"]],
  ["npm", ["run", "test:docs"]],
  ["npm", ["run", "test:vercel-env-sync"]],
  ["npm", ["run", "test:github-create"]],
  ["npm", ["run", "test:github-publish"]],
  ["npm", ["run", "test:deployment"]],
  ["npm", ["run", "setup:check"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:smoke"]],
];

for (const [command, args] of steps) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`Verification failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nVerification passed");
