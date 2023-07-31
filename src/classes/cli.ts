import fs from "fs";
import os from "os";
import { execSync } from "child_process";

const SSH_FOLDER_PATH = `${os.homedir()}/.ssh`;
const SSH_CONFIG_FILE_PATH = `${SSH_FOLDER_PATH}/config`;
const GIT_REGEX = /git@(.*):(.*)\/(.*).git/;

export class CLI {
  public async createNewKey(keyAlias: string = "") {
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

    const gitRepoUrl = this.getGitRepoUrl();

    const match = gitRepoUrl.match(GIT_REGEX);

    match && match[1]
      ? console.log(`Current identity: ${match[1]}`)
      : console.error(
          "Could not find an established identity for this repository."
        );
  }

  public listAllIdentities(): void {
    if (!fs.existsSync(SSH_CONFIG_FILE_PATH)) {
      console.error("SSH config file does not exist.");
      return;
    }

    const data = fs.readFileSync(SSH_CONFIG_FILE_PATH, "utf8");
    const identities = data.match(/Host (.*)\n/g);

    identities && identities.length > 0
      ? identities.map((identity: string) => {
          console.log(`- ${identity.replace("Host ", "").replace("\n", "")}`);
        })
      : console.error("No identities found.");
  }

  public changeIdentity(identity: string = ""): void {
    if (!this.isGitRepo()) {
      console.error("This directory is not a git repository.");
      return;
    }

    if (!this.isIdentityAvaialble(identity)) {
      console.error(`Requested identity '${identity}' is not available.`);
      return;
    }

    const originalRepoUrl = this.getGitRepoUrl();
    const match = originalRepoUrl.match(GIT_REGEX);

    if (!match || !match[1] || !match[3]) {
      console.error(
        "Could not find an established identity for this repository."
      );
      return;
    } else if (match[1] === identity) {
      console.error(`Identity '${identity}' is already in use.`);
      return;
    }

    const newRepoUrl = `git@${identity}:${match[2]}/${match[3]}.git`;
    execSync(`git remote set-url origin ${newRepoUrl}`, { stdio: "inherit" });
    console.log(`Identity changed to '${identity}' successfully.`);
  }

  public showPublicKey(identity: string = ""): void {
    if (!this.isIdentityAvaialble(identity)) {
      console.error(`Requested identity '${identity}' is not available.`);
      return;
    }

    if (!fs.existsSync(SSH_CONFIG_FILE_PATH)) {
      console.error("SSH config file does not exist.");
      return;
    }

    const data = fs.readFileSync(SSH_CONFIG_FILE_PATH, "utf8");

    const hosts = data.split("Host ");
    const host = hosts.find((host) => host.startsWith(identity));

    if (!host) {
      console.error(`Requested identity '${identity}' is not available.`);
      return;
    }

    const identityFileMatch = host.match(/IdentityFile (.*)\n/);

    if (identityFileMatch && identityFileMatch[1]) {
      const identityFilePath = identityFileMatch[1].trim();
      const publicKeyPath = `${identityFilePath}.pub`;

      if (fs.existsSync(publicKeyPath)) {
        const publicKey = fs.readFileSync(publicKeyPath, "utf8");
        console.log(publicKey);
      } else {
        console.error("Could not find public key.");
      }
    }
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
    const data = fs.readFileSync(SSH_CONFIG_FILE_PATH, "utf8");

    if (data.indexOf(keyAlias) > -1) {
      console.error(
        `A host name already exists with the same name. ${keyAlias}. \
          Please try removing it or try a different name.`
      );
    } else {
      const newHost = this.buildHostString(keyAlias);
      await fs.appendFileSync(SSH_CONFIG_FILE_PATH, newHost);
      console.log(`New host '${keyAlias}' added successfully.`);
    }
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

  private isIdentityAvaialble(identity: string): boolean {
    if (!fs.existsSync(SSH_CONFIG_FILE_PATH)) {
      return false;
    }

    const data = fs.readFileSync(SSH_CONFIG_FILE_PATH, "utf8");
    return data.includes(identity);
  }

  private getGitRepoUrl(): string {
    return execSync("git remote get-url origin", {
      encoding: "utf8",
      stdio: "pipe",
    }).toString();
  }
}
