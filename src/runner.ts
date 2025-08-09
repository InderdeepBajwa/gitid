import { Command } from "commander";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

type KeyType = "ed25519" | "rsa";

type IdentityRecord = {
  alias: string;
  hostName: string;
  identityFile: string; // absolute path without .pub
  createdAt: string; // ISO timestamp
  gitUserName?: string;
  gitUserEmail?: string;
};

const SSH_DIR = path.join(os.homedir(), ".ssh");
const SSH_CONFIG = path.join(SSH_DIR, "config");
const KEYS_DIR = path.join(SSH_DIR, "gitid");
const APP_CONFIG_DIR = path.join(os.homedir(), ".config", "gitid");
const IDENTITIES_DB = path.join(APP_CONFIG_DIR, "identities.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function readIdentities(): IdentityRecord[] {
  try {
    if (!fs.existsSync(IDENTITIES_DB)) return [];
    const raw = fs.readFileSync(IDENTITIES_DB, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as IdentityRecord[];
    return [];
  } catch {
    return [];
  }
}

function writeIdentities(records: IdentityRecord[]) {
  ensureDir(APP_CONFIG_DIR);
  fs.writeFileSync(IDENTITIES_DB, JSON.stringify(records, null, 2));
}

function buildConfigBlock(alias: string, hostName: string, identityFileAbs: string): string {
  const begin = `# >>> gitid: identity ${alias} BEGIN`;
  const end = `# <<< gitid: identity ${alias} END`;
  const body = [
    `Host ${alias}`,
    `  HostName ${hostName}`,
    `  User git`,
    `  IdentityFile ${identityFileAbs}`,
    `  IdentitiesOnly yes`,
  ].join("\n");
  return `\n${begin}\n${body}\n${end}\n`;
}

function readSshConfig(): string {
  if (!fs.existsSync(SSH_CONFIG)) return "";
  return fs.readFileSync(SSH_CONFIG, "utf8");
}

function writeSshConfig(content: string) {
  ensureDir(SSH_DIR);
  fs.writeFileSync(SSH_CONFIG, content, { mode: 0o600 });
}

function hasIdentityBlock(configText: string, alias: string): boolean {
  return configText.includes(`# >>> gitid: identity ${alias} BEGIN`);
}

function addIdentityBlock(alias: string, hostName: string, identityFileAbs: string) {
  const current = readSshConfig();
  if (hasIdentityBlock(current, alias)) {
    throw new Error(`Identity '${alias}' already exists in SSH config.`);
  }
  const next = current + buildConfigBlock(alias, hostName, identityFileAbs);
  writeSshConfig(next);
}

function removeIdentityBlock(alias: string) {
  const current = readSshConfig();
  const begin = `# >>> gitid: identity ${alias} BEGIN`;
  const end = `# <<< gitid: identity ${alias} END`;
  if (!current.includes(begin)) return; // nothing to do
  const regex = new RegExp(`\n?${escapeRegex(begin)}[\s\S]*?${escapeRegex(end)}\n?`, "g");
  const next = current.replace(regex, "");
  writeSshConfig(next);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|\[\]\\]/g, "\\$&");
}

function getIdentityFileForAlias(alias: string): string | undefined {
  // Prefer DB, fallback to parsing config block
  const fromDb = readIdentities().find((r) => r.alias === alias)?.identityFile;
  if (fromDb) return fromDb;

  const current = readSshConfig();
  const begin = `# >>> gitid: identity ${alias} BEGIN`;
  const end = `# <<< gitid: identity ${alias} END`;
  const startIdx = current.indexOf(begin);
  if (startIdx === -1) return undefined;
  const endIdx = current.indexOf(end, startIdx);
  if (endIdx === -1) return undefined;
  const block = current.slice(startIdx, endIdx);
  const match = block.match(/\n\s*IdentityFile\s+(.+)\n/);
  return match ? match[1].trim() : undefined;
}

function assertGitRepo(): void {
  try {
    const res = execSync("git rev-parse --is-inside-work-tree", { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" })
      .toString()
      .trim();
    if (res !== "true") throw new Error();
  } catch {
    throw new Error("Not a git repository (or any of the parent directories)");
  }
}

function getRemoteUrl(remote: string): string {
  return execSync(`git remote get-url ${remote}`, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" })
    .toString()
    .trim();
}

function setRemoteUrl(remote: string, url: string) {
  execSync(`git remote set-url ${remote} ${shellEscape(url)}`, { stdio: "inherit" });
}

function shellEscape(s: string): string {
  if (/^[A-Za-z0-9@._:\/+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function parseRemote(url: string): { host: string; path: string; type: "ssh" | "https" | "other" } {
  // git@host:owner/repo(.git)?
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], path: sshMatch[2], type: "ssh" };
  }
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1], path: httpsMatch[2], type: "https" };
  }
  return { host: "", path: url, type: "other" };
}

function identityExists(alias: string): boolean {
  const current = readSshConfig();
  return hasIdentityBlock(current, alias);
}

function createKey(alias: string, keyType: KeyType, passphrase?: string, comment?: string): { privateKey: string; publicKey: string } {
  ensureDir(KEYS_DIR);
  const keyBase = path.join(KEYS_DIR, alias);
  const args = ["-t", keyType, "-f", keyBase, "-N", passphrase ?? "", "-C", comment ?? os.hostname()];
  execSync(`ssh-keygen ${args.map((a) => shellEscape(a)).join(" ")}`, { stdio: "inherit" });
  return { privateKey: keyBase, publicKey: `${keyBase}.pub` };
}

function updateGitConfigForRepo(opts: { name?: string; email?: string }) {
  if (opts.name) execSync(`git config user.name ${shellEscape(opts.name)}`, { stdio: "inherit" });
  if (opts.email) execSync(`git config user.email ${shellEscape(opts.email)}`, { stdio: "inherit" });
}

export async function run() {
  const program = new Command();
  program
    .name("gitid")
    .description("Manage multiple git SSH identities across any provider")
    .version("1.0.0");

  program
    .command("new")
    .argument("alias", "name of the identity alias to create")
    .option("--host <host>", "git provider host (e.g. github.com, gitlab.com, bitbucket.org)", "github.com")
    .option("--type <type>", "ssh key type: ed25519|rsa", "ed25519")
    .option("--passphrase <pass>", "optional passphrase for the key")
    .option("--name <gitUserName>", "optional git user.name to apply when using this identity")
    .option("--email <gitUserEmail>", "optional git user.email to apply when using this identity")
    .action((alias: string, options: { host: string; type: KeyType; passphrase?: string; name?: string; email?: string }) => {
      const keyType: KeyType = options.type === "rsa" ? "rsa" : "ed25519";
      if (identityExists(alias)) {
        console.error(`Identity '${alias}' already exists.`);
        process.exitCode = 1;
        return;
      }
      try {
        const { privateKey } = createKey(alias, keyType, options.passphrase, `${alias}@${os.hostname()}`);
        addIdentityBlock(alias, options.host, privateKey);

        const records = readIdentities();
        records.push({
          alias,
          hostName: options.host,
          identityFile: privateKey,
          createdAt: new Date().toISOString(),
          gitUserName: options.name,
          gitUserEmail: options.email,
        });
        writeIdentities(records);

        console.log(`Identity '${alias}' created for host '${options.host}'.`);
        console.log(`Public key: ${privateKey}.pub`);
      } catch (err: any) {
        console.error(`Failed to create identity: ${err?.message ?? err}`);
        process.exitCode = 1;
      }
    });

  program
    .command("list")
    .description("List all identities managed by gitid")
    .action(() => {
      const records = readIdentities();
      if (records.length === 0) {
        console.log("No identities found.");
        return;
      }
      for (const r of records) {
        const extras = [r.hostName, r.gitUserEmail && `email=${r.gitUserEmail}`, r.gitUserName && `name=${r.gitUserName}`]
          .filter(Boolean)
          .join(", ");
        console.log(`- ${r.alias} (${extras})`);
      }
    });

  program
    .command("show")
    .argument("alias", "identity alias")
    .description("Print public key for an identity")
    .action((alias: string) => {
      const file = getIdentityFileForAlias(alias);
      if (!file) {
        console.error(`Identity '${alias}' not found.`);
        process.exitCode = 1;
        return;
      }
      const pub = `${file}.pub`;
      if (!fs.existsSync(pub)) {
        console.error("Public key not found. Did you delete it?");
        process.exitCode = 1;
        return;
      }
      const content = fs.readFileSync(pub, "utf8");
      console.log(content.trim());
    });

  program
    .command("current")
    .option("--remote <name>", "git remote name", "origin")
    .description("Show the current identity in use for the repository")
    .action((options: { remote: string }) => {
      try {
        assertGitRepo();
        const url = getRemoteUrl(options.remote);
        const parsed = parseRemote(url);
        if (parsed.type === "ssh") {
          const alias = parsed.host; // could be an identity alias or a real host
          const isAlias = identityExists(alias);
          if (isAlias) {
            console.log(`Current identity: ${alias}`);
          } else {
            console.log(`Using SSH with host '${alias}' (not a gitid alias).`);
          }
        } else if (parsed.type === "https") {
          console.log(`Using HTTPS remote on '${parsed.host}'.`);
        } else {
          console.log("Remote URL type is not recognized.");
        }
      } catch (err: any) {
        console.error(err?.message ?? String(err));
        process.exitCode = 1;
      }
    });

  program
    .command("use")
    .argument("alias", "identity alias to use for this repo")
    .option("--remote <name>", "git remote name", "origin")
    .description("Switch the current repository to use the given identity alias")
    .action((alias: string, options: { remote: string }) => {
      if (!identityExists(alias)) {
        console.error(`Identity '${alias}' does not exist.`);
        process.exitCode = 1;
        return;
      }
      try {
        assertGitRepo();
        const currentUrl = getRemoteUrl(options.remote);
        const parsed = parseRemote(currentUrl);
        if (parsed.type === "other") {
          console.error("Unsupported remote URL format.");
          process.exitCode = 1;
          return;
        }
        const newUrl = `git@${alias}:${parsed.path.replace(/\.git$/, "")}.git`;
        setRemoteUrl(options.remote, newUrl);

        const rec = readIdentities().find((r) => r.alias === alias);
        if (rec && (rec.gitUserEmail || rec.gitUserName)) {
          updateGitConfigForRepo({ name: rec.gitUserName, email: rec.gitUserEmail });
        }
        console.log(`Identity switched to '${alias}'.`);
      } catch (err: any) {
        console.error(err?.message ?? String(err));
        process.exitCode = 1;
      }
    });

  program
    .command("remove")
    .argument("alias", "identity alias to remove")
    .option("--delete-keys", "also delete private/public key files", false)
    .description("Remove an identity from SSH config and metadata")
    .action((alias: string, options: { deleteKeys: boolean }) => {
      if (!identityExists(alias)) {
        console.error(`Identity '${alias}' does not exist.`);
        process.exitCode = 1;
        return;
      }
      try {
        const records = readIdentities();
        const rec = records.find((r) => r.alias === alias);
        removeIdentityBlock(alias);
        writeIdentities(records.filter((r) => r.alias !== alias));
        if (options.deleteKeys) {
          const file = rec?.identityFile ?? getIdentityFileForAlias(alias);
          if (file && fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch {}
          }
          if (file && fs.existsSync(`${file}.pub`)) {
            try { fs.unlinkSync(`${file}.pub`); } catch {}
          }
        }
        console.log(`Identity '${alias}' removed.`);
      } catch (err: any) {
        console.error(err?.message ?? String(err));
        process.exitCode = 1;
      }
    });

  program
    .command("rename")
    .argument("oldAlias", "current alias")
    .argument("newAlias", "new alias")
    .description("Rename an identity alias")
    .action((oldAlias: string, newAlias: string) => {
      if (!identityExists(oldAlias)) {
        console.error(`Identity '${oldAlias}' does not exist.`);
        process.exitCode = 1;
        return;
      }
      if (identityExists(newAlias)) {
        console.error(`Identity '${newAlias}' already exists.`);
        process.exitCode = 1;
        return;
      }
      try {
        const records = readIdentities();
        const rec = records.find((r) => r.alias === oldAlias);
        const hostName = rec?.hostName ?? "github.com";
        const oldFile = rec?.identityFile ?? getIdentityFileForAlias(oldAlias);
        if (!oldFile) throw new Error("Could not resolve identity file.");

        // Move key files
        const newFile = path.join(KEYS_DIR, newAlias);
        ensureDir(KEYS_DIR);
        if (fs.existsSync(oldFile)) fs.renameSync(oldFile, newFile);
        if (fs.existsSync(`${oldFile}.pub`)) fs.renameSync(`${oldFile}.pub`, `${newFile}.pub`);

        // Update SSH config blocks
        removeIdentityBlock(oldAlias);
        addIdentityBlock(newAlias, hostName, newFile);

        // Update DB
        const updated: IdentityRecord = {
          alias: newAlias,
          hostName,
          identityFile: newFile,
          createdAt: rec?.createdAt ?? new Date().toISOString(),
          gitUserEmail: rec?.gitUserEmail,
          gitUserName: rec?.gitUserName,
        };
        writeIdentities(records.filter((r) => r.alias !== oldAlias).concat(updated));
        console.log(`Identity renamed '${oldAlias}' → '${newAlias}'.`);
      } catch (err: any) {
        console.error(err?.message ?? String(err));
        process.exitCode = 1;
      }
    });

  program
    .command("config")
    .argument("alias", "identity alias to update")
    .option("--name <gitUserName>", "set git user.name for this identity")
    .option("--email <gitUserEmail>", "set git user.email for this identity")
    .option("--clear-name", "clear git user.name for this identity", false)
    .option("--clear-email", "clear git user.email for this identity", false)
    .description("Update metadata (git name/email) attached to an identity")
    .action((alias: string, options: { name?: string; email?: string; clearName?: boolean; clearEmail?: boolean }) => {
      const records = readIdentities();
      const rec = records.find((r) => r.alias === alias);
      if (!rec) {
        console.error(`Identity '${alias}' does not exist.`);
        process.exitCode = 1;
        return;
      }
      if (!options.clearName && !options.clearEmail && !options.name && !options.email) {
        console.log(`Current settings for '${alias}': name=${rec.gitUserName ?? "<unset>"}, email=${rec.gitUserEmail ?? "<unset>"}`);
        return;
      }
      if (options.clearName) delete rec.gitUserName;
      if (options.clearEmail) delete rec.gitUserEmail;
      if (typeof options.name === "string") rec.gitUserName = options.name;
      if (typeof options.email === "string") rec.gitUserEmail = options.email;
      writeIdentities(records);
      console.log(`Updated '${alias}': name=${rec.gitUserName ?? "<unset>"}, email=${rec.gitUserEmail ?? "<unset>"}`);
    });

  program
    .command("apply")
    .argument("alias", "identity alias whose git name/email will be applied to this repo")
    .description("Apply the stored git user.name and user.email for an identity to the current repository")
    .action((alias: string) => {
      try {
        assertGitRepo();
        const rec = readIdentities().find((r) => r.alias === alias);
        if (!rec) {
          console.error(`Identity '${alias}' does not exist.`);
          process.exitCode = 1;
          return;
        }
        if (!rec.gitUserEmail && !rec.gitUserName) {
          console.error(`Identity '${alias}' has no git name/email configured.`);
          process.exitCode = 1;
          return;
        }
        updateGitConfigForRepo({ name: rec.gitUserName, email: rec.gitUserEmail });
        console.log(`Applied git config for '${alias}'.`);
      } catch (err: any) {
        console.error(err?.message ?? String(err));
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}


