import fs from "fs";
import os from "os";
import path from "path";

const CURRENT_KEY_PREFIX = "gitid_";
const LEGACY_KEY_PREFIX = "gitta_";

interface SSHHostEntry {
  patterns: string[];
  options: Record<string, string>;
}

export type SSHIdentityStatus = "ready" | "legacy" | "broken";

export interface SSHIdentityInspection {
  alias: string;
  hostName: string;
  user: string;
  identityFile?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
  status: SSHIdentityStatus;
  issue?: string;
  repairPath?: string;
  repairBlock?: string;
}

export class SSHConfigInspector {
  public constructor(
    private readonly sshFolderPath: string = `${os.homedir()}/.ssh`,
    private readonly sshConfigFilePath: string = `${sshFolderPath}/config`
  ) {}

  public configExists(): boolean {
    return fs.existsSync(this.sshConfigFilePath);
  }

  public hasExactHost(alias: string): boolean {
    return this.getHostEntries().some(
      (entry) => entry.patterns.length === 1 && entry.patterns[0] === alias
    );
  }

  public listIdentities(): SSHIdentityInspection[] {
    return this.getHostEntries()
      .filter(
        (entry) =>
          entry.patterns.length === 1 && !this.hasWildcardPattern(entry.patterns[0])
      )
      .map((entry) => this.inspectEntry(entry, entry.patterns[0]));
  }

  public getIdentity(alias: string): SSHIdentityInspection | null {
    const hostEntries = this.getHostEntries();
    const exactEntry = hostEntries.find(
      (entry) => entry.patterns.length === 1 && entry.patterns[0] === alias
    );

    if (exactEntry) {
      return this.inspectEntry(exactEntry, alias);
    }

    const matchingEntry = hostEntries.find((entry) => entry.patterns.includes(alias));
    return matchingEntry ? this.inspectEntry(matchingEntry, alias) : null;
  }

  private getHostEntries(): SSHHostEntry[] {
    if (!this.configExists()) {
      return [];
    }

    const configFileContents = fs.readFileSync(this.sshConfigFilePath, "utf8");
    const lines = configFileContents.split(/\r?\n/);
    const hostEntries: SSHHostEntry[] = [];
    let currentEntry: SSHHostEntry | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      if (/^Host\s+/i.test(trimmedLine)) {
        if (currentEntry) {
          hostEntries.push(currentEntry);
        }

        currentEntry = {
          patterns: trimmedLine
            .replace(/^Host\s+/i, "")
            .trim()
            .split(/\s+/)
            .filter(Boolean),
          options: {},
        };
        continue;
      }

      if (!currentEntry) {
        continue;
      }

      const optionMatch = trimmedLine.match(/^([A-Za-z][A-Za-z0-9]*)\s+(.+)$/);

      if (!optionMatch || !optionMatch[1] || !optionMatch[2]) {
        continue;
      }

      currentEntry.options[optionMatch[1].toLowerCase()] = optionMatch[2].trim();
    }

    if (currentEntry) {
      hostEntries.push(currentEntry);
    }

    return hostEntries;
  }

  private inspectEntry(
    hostEntry: SSHHostEntry,
    alias: string
  ): SSHIdentityInspection {
    const hostName = hostEntry.options.hostname || "github.com";
    const user = hostEntry.options.user || "git";
    const identityFile = hostEntry.options.identityfile;
    const currentKeyPath = path.join(this.sshFolderPath, `${CURRENT_KEY_PREFIX}${alias}`);
    const legacyKeyPath = path.join(this.sshFolderPath, `${LEGACY_KEY_PREFIX}${alias}`);

    if (
      hostEntry.patterns.length !== 1 ||
      this.hasWildcardPattern(hostEntry.patterns[0])
    ) {
      const repairPath = this.findExistingPath([currentKeyPath, legacyKeyPath]);

      return {
        alias,
        hostName,
        user,
        identityFile,
        status: "broken",
        issue:
          "This Host entry uses multiple patterns or wildcards, which GitID cannot safely manage.",
        repairPath,
        repairBlock: repairPath
          ? this.buildHostString(alias, repairPath, hostName, user)
          : undefined,
      };
    }

    if (!identityFile) {
      const repairPath =
        this.findExistingPath([currentKeyPath, legacyKeyPath]) || currentKeyPath;

      return {
        alias,
        hostName,
        user,
        status: "broken",
        issue: "The Host entry is missing an IdentityFile value.",
        repairPath,
        repairBlock: this.buildHostString(alias, repairPath, hostName, user),
      };
    }

    const privateKeyPath = this.resolveIdentityFilePath(identityFile);
    const publicKeyPath = this.buildPublicKeyPath(privateKeyPath);

    if (fs.existsSync(privateKeyPath)) {
      const keyBaseName = path.basename(privateKeyPath);

      if (keyBaseName === `${LEGACY_KEY_PREFIX}${alias}`) {
        return {
          alias,
          hostName,
          user,
          identityFile,
          privateKeyPath,
          publicKeyPath,
          status: "legacy",
          issue:
            "This identity still uses the legacy 'gitta_' key naming from an older GitID release.",
        };
      }

      return {
        alias,
        hostName,
        user,
        identityFile,
        privateKeyPath,
        publicKeyPath,
        status: "ready",
      };
    }

    const repairPath =
      this.findExistingPath([currentKeyPath, legacyKeyPath]) || currentKeyPath;
    const missingPathMessage = `IdentityFile points to '${privateKeyPath}', but that file does not exist.`;

    return {
      alias,
      hostName,
      user,
      identityFile,
      privateKeyPath,
      publicKeyPath,
      status: "broken",
      issue:
        repairPath === currentKeyPath && !fs.existsSync(currentKeyPath)
          ? `${missingPathMessage} No matching GitID key was found for this alias.`
          : `${missingPathMessage} A matching key was found at '${repairPath}'.`,
      repairPath,
      repairBlock: this.buildHostString(alias, repairPath, hostName, user),
    };
  }

  private resolveIdentityFilePath(identityFile: string): string {
    const trimmedIdentityFile = identityFile.trim().replace(/^["']|["']$/g, "");

    if (trimmedIdentityFile.startsWith("~/")) {
      return path.join(os.homedir(), trimmedIdentityFile.slice(2));
    }

    return trimmedIdentityFile;
  }

  private buildPublicKeyPath(privateKeyPath: string): string {
    return privateKeyPath.endsWith(".pub")
      ? privateKeyPath
      : `${privateKeyPath}.pub`;
  }

  private hasWildcardPattern(pattern: string): boolean {
    return /[*?!]/.test(pattern);
  }

  private findExistingPath(paths: string[]): string | undefined {
    return paths.find((candidatePath) => fs.existsSync(candidatePath));
  }

  private buildHostString(
    alias: string,
    identityFilePath: string,
    hostName: string,
    user: string
  ): string {
    return [
      `Host ${alias}`,
      `   HostName ${hostName}`,
      `   User ${user}`,
      `   IdentityFile ${identityFilePath}`,
      "   IdentitiesOnly yes",
    ].join("\n");
  }
}

export function formatIdentityRepairPrompt(
  inspection: SSHIdentityInspection,
  sshConfigFilePath: string
): string {
  const lines = [
    `SSH config for identity '${inspection.alias}' needs attention.`,
    inspection.issue || "This SSH config entry is not supported by GitID.",
  ];

  if (inspection.repairBlock) {
    lines.push(`Update ${sshConfigFilePath} so the Host block looks like this:`);
    lines.push(inspection.repairBlock);
  }

  return lines.join("\n");
}

export function formatLegacyIdentityWarning(
  inspection: SSHIdentityInspection
): string {
  return [
    `Identity '${inspection.alias}' is using a legacy SSH key path.`,
    inspection.issue || "This entry was created by an older GitID release.",
  ].join("\n");
}
