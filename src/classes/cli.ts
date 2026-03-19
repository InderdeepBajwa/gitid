import fs from "fs";
import os from "os";
import { execFileSync, execSync } from "child_process";
import {
  SSHConfigInspector,
  formatIdentityRepairPrompt,
  formatLegacyIdentityWarning,
} from "./sshConfig";
import { buildGitRemoteUrl, parseGitRemoteUrl } from "./gitRemote";
import {
  IdentityProfileStore,
  formatManagedAuthorSettings,
  hasManagedAuthorSettings,
} from "./identityProfiles";
import {
  buildCompletionScript,
  isSupportedShell,
} from "./completion";

const SSH_FOLDER_PATH = `${os.homedir()}/.ssh`;
const SSH_CONFIG_FILE_PATH = `${SSH_FOLDER_PATH}/config`;
const sshConfigInspector = new SSHConfigInspector(
  SSH_FOLDER_PATH,
  SSH_CONFIG_FILE_PATH
);
const identityProfileStore = new IdentityProfileStore();

export interface CLIFlags {
  [key: string]: string | boolean;
}

export class CLI {
  public async createNewKey(keyAlias: string = "", flags: CLIFlags = {}) {
    if (!this.isValidIdentityAlias(keyAlias)) {
      console.error("Please provide an identity name with letters, numbers, '-' or '_'.");
      return;
    }

    try {
      await this.createSSHKey(keyAlias);

      fs.existsSync(SSH_CONFIG_FILE_PATH)
        ? this.addHostToConfig(keyAlias)
        : this.createSSHConfigFile(keyAlias);

      const profileUpdates = this.parseIdentityProfileUpdates(flags);

      if (profileUpdates) {
        const savedProfile = identityProfileStore.upsertProfile(
          keyAlias,
          profileUpdates
        );

        if (hasManagedAuthorSettings(savedProfile)) {
          console.log(
            `Git author profile saved for '${keyAlias}': ${formatManagedAuthorSettings(
              savedProfile
            ).join(", ")}`
          );
        }
      }
    } catch (error: any) {
      if (error instanceof Error) {
        console.error(
          "An error occurred while creating a new key:",
          error.message
        );
      } else {
        console.error(error);
      }
    }
  }

  public printCurrentIdentity() {
    if (!this.isGitRepo()) {
      console.error("Current directory is not a git repository.");
      return;
    }

    const gitRepo = this.getGitRepo();

    if (!gitRepo) {
      console.error(
        "Could not detect an SSH remote like 'git@identity:owner/repo.git' for origin."
      );
      return;
    }

    console.log(`Current identity: ${gitRepo.host}`);
    this.printIdentityNotice(gitRepo.host);
    this.printCurrentGitAuthor(gitRepo.host);
  }

  public listAllIdentities(): void {
    if (!fs.existsSync(SSH_CONFIG_FILE_PATH)) {
      console.error("SSH config file does not exist.");
      return;
    }

    const identities = sshConfigInspector.listIdentities();
    const availableIdentities = this.getManageableIdentities(identities);
    const brokenIdentities = identities.filter(
      (identity) => identity.status === "broken"
    );

    if (availableIdentities.length === 0) {
      console.error("No usable identities found.");
    } else {
      availableIdentities.forEach((identity) => {
        const suffixes: string[] = [];
        const profile = this.getIdentityProfile(identity.alias);

        if (identity.status === "legacy") {
          suffixes.push("legacy config");
        }

        if (hasManagedAuthorSettings(profile)) {
          suffixes.push("git author managed");
        }

        console.log(
          suffixes.length > 0
            ? `- ${identity.alias} (${suffixes.join(", ")})`
            : `- ${identity.alias}`
        );
      });
    }

    brokenIdentities.forEach((identity) => {
      console.error(formatIdentityRepairPrompt(identity, SSH_CONFIG_FILE_PATH));
    });
  }

  public printCompletionScript(shell: string = ""): void {
    if (!isSupportedShell(shell)) {
      console.error("Usage: gitid completion <bash|zsh>");
      return;
    }

    console.log(buildCompletionScript(shell));
  }

  public printIdentityCompletions(): void {
    const identities = this.getManageableIdentities(sshConfigInspector.listIdentities());

    identities.forEach((identity) => {
      console.log(identity.alias);
    });
  }

  public changeIdentity(identity: string = "", flags: CLIFlags = {}): void {
    if (!this.isGitRepo()) {
      console.error("This directory is not a git repository.");
      return;
    }

    if (!this.isValidIdentityAlias(identity)) {
      console.error("Please provide an identity name with letters, numbers, '-' or '_'.");
      return;
    }

    const requestedIdentity = this.inspectIdentity(identity);
    if (!requestedIdentity) {
      console.error(`Requested identity '${identity}' is not available.`);
      return;
    }

    if (requestedIdentity.status === "broken") {
      console.error(formatIdentityRepairPrompt(requestedIdentity, SSH_CONFIG_FILE_PATH));
      return;
    }

    if (requestedIdentity.status === "legacy") {
      console.error(formatLegacyIdentityWarning(requestedIdentity));
    }

    const gitRepo = this.getGitRepo();

    if (!gitRepo) {
      console.error(
        "Could not detect an SSH remote like 'git@identity:owner/repo.git' for origin."
      );
      return;
    }

    if (gitRepo.host === identity) {
      console.error(`Identity '${identity}' is already in use.`);
      return;
    }

    const newRepoUrl = buildGitRemoteUrl({
      ...gitRepo,
      host: identity,
    });
    execFileSync("git", ["remote", "set-url", "origin", newRepoUrl], {
      stdio: "inherit",
    });
    console.log(`Identity changed to '${identity}' successfully.`);

    if (flags["skip-author"] === true) {
      console.log("Skipped applying git author settings.");
      return;
    }

    this.applyIdentityProfile(identity);
  }

  public showPublicKey(identity: string = ""): void {
    if (!this.isValidIdentityAlias(identity)) {
      console.error("Please provide an identity name with letters, numbers, '-' or '_'.");
      return;
    }

    const identityConfig = this.inspectIdentity(identity);

    if (!identityConfig) {
      console.error(`Requested identity '${identity}' is not available.`);
      return;
    }

    if (identityConfig.status === "broken") {
      console.error(formatIdentityRepairPrompt(identityConfig, SSH_CONFIG_FILE_PATH));
      return;
    }

    if (identityConfig.status === "legacy") {
      console.error(formatLegacyIdentityWarning(identityConfig));
    }

    if (!identityConfig.publicKeyPath || !fs.existsSync(identityConfig.publicKeyPath)) {
      console.error(
        `Could not find public key for identity '${identity}'. Check the key files in your SSH config.`
      );
      return;
    }

    const publicKey = fs.readFileSync(identityConfig.publicKeyPath, "utf8");
    console.log(publicKey);
  }

  public setIdentityProfile(
    identity: string = "",
    flags: CLIFlags = {}
  ): void {
    if (!this.isValidIdentityAlias(identity)) {
      console.error("Please provide an identity name with letters, numbers, '-' or '_'.");
      return;
    }

    const identityConfig = this.inspectIdentity(identity);

    if (!identityConfig) {
      console.error(`Requested identity '${identity}' is not available.`);
      return;
    }

    if (identityConfig.status === "broken") {
      console.error(formatIdentityRepairPrompt(identityConfig, SSH_CONFIG_FILE_PATH));
      return;
    }

    const profileUpdates = this.parseIdentityProfileUpdates(flags);

    if (!profileUpdates) {
      console.error(
        "Nothing to update. Use --name, --email, --clear-name, or --clear-email."
      );
      return;
    }

    const savedProfile = identityProfileStore.upsertProfile(identity, profileUpdates);
    console.log(
      `Updated git author profile for '${identity}': ${formatManagedAuthorSettings(
        savedProfile
      ).join(", ")}`
    );
  }

  private async createSSHKey(keyAlias: string) {
    try {
      execSync(
        `ssh-keygen -t ed25519 -C "${os.hostname()}" -f "${SSH_FOLDER_PATH}/gitid_${keyAlias}"`,
        { stdio: "inherit" }
      );
      console.log("SSH key created successfully.");
    } catch (err) {
      console.error(
        "An error has occured while creating the SSH key: ",
        (err as any).message
      );
    }
  }

  private async addHostToConfig(keyAlias: string) {
    const existingIdentity = this.inspectIdentity(keyAlias);

    if (existingIdentity) {
      if (existingIdentity.status === "broken") {
        console.error(formatIdentityRepairPrompt(existingIdentity, SSH_CONFIG_FILE_PATH));
        return;
      }

      console.error(
        `A host named '${keyAlias}' already exists in your SSH config. Please remove it or choose a different identity name.`
      );
      return;
    }

    const newHost = this.buildHostString(keyAlias);
    await fs.appendFileSync(SSH_CONFIG_FILE_PATH, newHost);
    console.log(`New host '${keyAlias}' added successfully.`);
  }

  private buildHostString(keyAlias: string): string {
    return (
      "\n" +
      `Host ${keyAlias}\n` +
      `   HostName github.com\n` +
      `   User git\n` +
      `   IdentityFile ${SSH_FOLDER_PATH}/gitid_${keyAlias}\n` +
      `   IdentitiesOnly yes\n`
    );
  }

  private createSSHConfigFile(keyAlias: string): void {
    const newHost = this.buildHostString(keyAlias);

    fs.writeFileSync(SSH_CONFIG_FILE_PATH, newHost);
    console.log("New Host added successfully.");
  }

  private isGitRepo(): boolean {
    try {
      return (
        execSync("git rev-parse --is-inside-work-tree", {
          encoding: "utf8",
          stdio: "pipe",
        })
          .toString()
          .trim() === "true"
      );
    } catch {
      return false;
    }
  }

  private getGitRepoUrl(): string {
    return execSync("git remote get-url origin", {
      encoding: "utf8",
      stdio: "pipe",
    })
      .toString()
      .trim();
  }

  private getGitRepo() {
    return parseGitRemoteUrl(this.getGitRepoUrl());
  }

  private inspectIdentity(identity: string) {
    if (!sshConfigInspector.configExists()) {
      return null;
    }

    return sshConfigInspector.getIdentity(identity);
  }

  private printIdentityNotice(identity: string): void {
    const identityConfig = this.inspectIdentity(identity);

    if (!identityConfig) {
      return;
    }

    if (identityConfig.status === "broken") {
      console.error(formatIdentityRepairPrompt(identityConfig, SSH_CONFIG_FILE_PATH));
      return;
    }

    if (identityConfig.status === "legacy") {
      console.error(formatLegacyIdentityWarning(identityConfig));
    }
  }

  private getIdentityProfile(identity: string) {
    try {
      return identityProfileStore.getProfile(identity);
    } catch (error: any) {
      console.error(error.message);
      return null;
    }
  }

  private parseIdentityProfileUpdates(
    flags: CLIFlags
  ): { gitUserName?: string | null; gitUserEmail?: string | null } | null {
    const profileUpdates: {
      gitUserName?: string | null;
      gitUserEmail?: string | null;
    } = {};

    if (typeof flags.name === "string") {
      const trimmedName = flags.name.trim();

      if (!trimmedName) {
        console.error("The value for --name cannot be empty.");
        return null;
      }

      profileUpdates.gitUserName = trimmedName;
    }

    if (typeof flags.email === "string") {
      const trimmedEmail = flags.email.trim();

      if (!this.isValidEmail(trimmedEmail)) {
        console.error("Please provide a valid email address for --email.");
        return null;
      }

      profileUpdates.gitUserEmail = trimmedEmail;
    }

    if (flags["clear-name"] === true) {
      profileUpdates.gitUserName = null;
    }

    if (flags["clear-email"] === true) {
      profileUpdates.gitUserEmail = null;
    }

    return Object.keys(profileUpdates).length > 0 ? profileUpdates : null;
  }

  private applyIdentityProfile(identity: string): void {
    const profile = this.getIdentityProfile(identity);

    if (!hasManagedAuthorSettings(profile)) {
      console.log(
        `No git author settings are managed for '${identity}'. Use 'gitid set ${identity} --name \"Your Name\" --email you@example.com' to add them.`
      );
      return;
    }

    if (profile.gitUserName !== undefined) {
      this.setLocalGitConfigValue("user.name", profile.gitUserName);
    }

    if (profile.gitUserEmail !== undefined) {
      this.setLocalGitConfigValue("user.email", profile.gitUserEmail);
    }

    console.log(
      `Applied git author settings for '${identity}': ${formatManagedAuthorSettings(
        profile
      ).join(", ")}`
    );
  }

  private printCurrentGitAuthor(identity: string): void {
    const currentName = this.getLocalGitConfigValue("user.name");
    const currentEmail = this.getLocalGitConfigValue("user.email");
    const profile = this.getIdentityProfile(identity);

    if (currentName || currentEmail) {
      console.log(
        `Current git author: ${this.formatGitAuthorValues(currentName, currentEmail)}`
      );
    }

    if (!hasManagedAuthorSettings(profile)) {
      return;
    }

    console.log(
      `Configured git author for '${identity}': ${formatManagedAuthorSettings(
        profile
      ).join(", ")}`
    );

    if (!this.isGitAuthorInSync(profile, currentName, currentEmail)) {
      console.error(
        `Git author settings are out of sync for '${identity}'. Run 'gitid use ${identity}' to apply the configured profile.`
      );
    }
  }

  private isGitAuthorInSync(
    profile: {
      gitUserName?: string | null;
      gitUserEmail?: string | null;
    },
    currentName?: string,
    currentEmail?: string
  ): boolean {
    if (profile.gitUserName !== undefined) {
      if (profile.gitUserName === null && currentName !== undefined) {
        return false;
      }

      if (
        typeof profile.gitUserName === "string" &&
        currentName !== profile.gitUserName
      ) {
        return false;
      }
    }

    if (profile.gitUserEmail !== undefined) {
      if (profile.gitUserEmail === null && currentEmail !== undefined) {
        return false;
      }

      if (
        typeof profile.gitUserEmail === "string" &&
        currentEmail !== profile.gitUserEmail
      ) {
        return false;
      }
    }

    return true;
  }

  private getLocalGitConfigValue(key: "user.name" | "user.email"): string | undefined {
    try {
      return execFileSync("git", ["config", "--local", "--get", key], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      return undefined;
    }
  }

  private setLocalGitConfigValue(
    key: "user.name" | "user.email",
    value: string | null
  ): void {
    if (value === null) {
      try {
        execFileSync("git", ["config", "--local", "--unset-all", key], {
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch {
        return;
      }

      return;
    }

    execFileSync("git", ["config", "--local", key, value], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  private formatGitAuthorValues(name?: string, email?: string): string {
    if (name && email) {
      return `${name} <${email}>`;
    }

    if (name) {
      return name;
    }

    if (email) {
      return email;
    }

    return "(not set)";
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private getManageableIdentities(
    identities = sshConfigInspector.listIdentities()
  ) {
    return identities.filter(
      (identity) => identity.status === "ready" || identity.status === "legacy"
    );
  }

  private isValidIdentityAlias(identity: string): boolean {
    return /^[A-Za-z0-9_-]+$/.test(identity);
  }
}
