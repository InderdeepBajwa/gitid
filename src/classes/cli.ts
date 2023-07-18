import fs from "fs";
import os from "os";
import { execSync } from "child_process";

export class CLI {
  private readonly sshConfigPath = `${os.homedir()}/.ssh/config`;
  private readonly sshKeyBasePath = `${os.homedir()}/.ssh/`;

  public createNewKey(keyAlias: string): void {
    this.createSSHKey(keyAlias);

    fs.existsSync(this.sshConfigPath)
      ? this.addHostToConfig(keyAlias)
      : this.createSSHConfigFile(keyAlias);
  }

  public printCurrentIdentity() {
    if (!this.isGitRepo()) {
      console.error("This directory is not a git repository.");
      return;
    }

    const gitRepoUrl = this.getGitRepoUrl();

    const match = gitRepoUrl.match(/git@(.*):(.*)\/(.*).git/);

    match && match[2]
      ? console.log(`Current identity: ${match[2]}`)
      : console.error(
          "Could not find an established identity for this repository."
        );
  }

  public listAllIdentities(): void {
    if (!fs.existsSync(this.sshConfigPath)) {
      console.error("SSH config file does not exist.");
      return;
    }

    const data = fs.readFileSync(this.sshConfigPath, "utf8");
    const identities = data.match(/Host (.*)\n/g);

    identities && identities.length > 0
      ? identities.map((identity: string) => {
          console.log(`- ${identity.replace("Host ", "").replace("\n", "")}`);
        })
      : console.error("No identities found.");
  }

  public changeIdentity(identity: string): void {
    if (!this.isGitRepo()) {
      console.error("This directory is not a git repository.");
      return;
    }

    if (!this.isIdentityAvaialble(identity)) {
      console.error("Identity not available.");
      return;
    }

    const originalRepoUrl = this.getGitRepoUrl();
    const match = originalRepoUrl.match(/git@(.*):(.*)\/(.*).git/);

    if (!match || !match[1] || !match[3]) {
      console.error(
        "Could not find an established identity for this repository."
      );
      return;
    } else if (match[2] === identity) {
      console.error("This identity is already in use.");
      return;
    }

    const newRepoUrl = `git@${match[1]}:${identity}/${match[3]}.git`;
    execSync(`git remote set-url origin ${newRepoUrl}`, { stdio: "inherit" });
  }

  private createSSHKey(keyAlias: string): void {
    try {
      execSync(
        `ssh-keygen -t ed25519 -C "${os.hostname()}" -f "${
          this.sshKeyBasePath
        }/gitta_${keyAlias}"`,
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

  private addHostToConfig(keyAlias: string): void {
    const data = fs.readFileSync(this.sshConfigPath, "utf8");

    if (data.indexOf(keyAlias) > -1) {
      console.error(
        "A host name already exists with the same name. \
        Please try removing it or try a different name."
      );
    } else {
      const newHost =
        `Host ${keyAlias}\n` +
        `   HostName github.com\n` +
        `   User git\n` +
        `   IdentityFile ${this.sshKeyBasePath}_${keyAlias}\n` +
        `   IdentitiesOnly yes\n`;

      fs.appendFileSync(this.sshConfigPath, newHost);
      console.log("New host added successfully.");
    }
  }

  private createSSHConfigFile(keyAlias: string): void {
    const newHost =
      `Host ${keyAlias}\n` +
      `   HostName github.com\n` +
      `   User git\n` +
      `   IdentityFile ${this.sshKeyBasePath}_${keyAlias}\n` +
      `   IdentitiesOnly yes\n`;

    fs.writeFileSync(this.sshConfigPath, newHost);
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
    if (!fs.existsSync(this.sshConfigPath)) {
      return false;
    }

    const data = fs.readFileSync(this.sshConfigPath, "utf8");
    return data.includes(identity);
  }

  private getGitRepoUrl(): string {
    return execSync("git remote get-url origin", {
      encoding: "utf8",
      stdio: "pipe",
    }).toString();
  }
}
