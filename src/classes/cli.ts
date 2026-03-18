import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import {
  SSHConfigInspector,
  formatIdentityRepairPrompt,
  formatLegacyIdentityWarning,
} from "./sshConfig";
import { buildGitRemoteUrl, parseGitRemoteUrl } from "./gitRemote";

const SSH_FOLDER_PATH = `${os.homedir()}/.ssh`;
const SSH_CONFIG_FILE_PATH = `${SSH_FOLDER_PATH}/config`;
const sshConfigInspector = new SSHConfigInspector(
  SSH_FOLDER_PATH,
  SSH_CONFIG_FILE_PATH
);

export class CLI {
  public async createNewKey(keyAlias: string = "") {
    if (!this.isValidIdentityAlias(keyAlias)) {
      console.error("Please provide an identity name with letters, numbers, '-' or '_'.");
      return;
    }

    try {
      await this.createSSHKey(keyAlias);

      fs.existsSync(SSH_CONFIG_FILE_PATH)
        ? this.addHostToConfig(keyAlias)
        : this.createSSHConfigFile(keyAlias);
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
  }

  public listAllIdentities(): void {
    if (!fs.existsSync(SSH_CONFIG_FILE_PATH)) {
      console.error("SSH config file does not exist.");
      return;
    }

    const identities = sshConfigInspector.listIdentities();
    const availableIdentities = identities.filter(
      (identity) => identity.status === "ready" || identity.status === "legacy"
    );
    const brokenIdentities = identities.filter(
      (identity) => identity.status === "broken"
    );

    if (availableIdentities.length === 0) {
      console.error("No usable identities found.");
    } else {
      availableIdentities.forEach((identity) => {
        const suffix = identity.status === "legacy" ? " (legacy config)" : "";
        console.log(`- ${identity.alias}${suffix}`);
      });
    }

    brokenIdentities.forEach((identity) => {
      console.error(formatIdentityRepairPrompt(identity, SSH_CONFIG_FILE_PATH));
    });
  }

  public changeIdentity(identity: string = ""): void {
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
    execSync(`git remote set-url origin ${newRepoUrl}`, { stdio: "inherit" });
    console.log(`Identity changed to '${identity}' successfully.`);
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

  private isValidIdentityAlias(identity: string): boolean {
    return /^[A-Za-z0-9_-]+$/.test(identity);
  }
}
