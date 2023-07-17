import fs, { existsSync } from "fs";
import os from "os";
import { execSync } from "child_process";

/*
 * CLI class
 *
 * This class is responsible for creating the SSH key and adding the host to the SSH config file.
 */
export class CLI {
  private sshConfigPath = `${os.homedir()}/.ssh/config`;
  private sshKeyBasePath = `${os.homedir()}/.ssh/`;

  public newCommand(keyAlias: string) {
    this.createSSHKey(keyAlias);

    if (fs.existsSync(this.sshConfigPath)) {
      this.addHostToExistingConfig(keyAlias);
    } else {
      this.createNewConfigFile(keyAlias);
    }
  }

  private createSSHKey(keyAlias: string) {
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

  private addHostToExistingConfig(keyAlias: string) {
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

  private createNewConfigFile(keyAlias: string) {
    const newHost =
      `Host ${keyAlias}\n` +
      `   HostName github.com\n` +
      `   User git\n` +
      `   IdentityFile ${this.sshKeyBasePath}_${keyAlias}\n` +
      `   IdentitiesOnly yes\n`;

    fs.writeFileSync(this.sshConfigPath, newHost);
    console.log("New Host added successfully.");
  }

  public curentIdentity() {
    try {
      const isCurrentDirGitRepo =
        execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" })
          .toString()
          .trim() === "true";

      if (isCurrentDirGitRepo) {
        const gitRepoUrl = execSync("git remote get-url origin", {
          stdio: "pipe",
        })
          .toString()
          .trim();
        const regex = /git@(.*):(.*)\/(.*).git/;

        const match = gitRepoUrl.match(regex);

        if (match && match[2]) {
          console.log(`Current identity: ${match[2]}`);
        } else {
          throw new Error(
            "Could not find an established identity for this repository."
          );
        }
      } else {
        throw new Error("This directory is not a git repository.");
      }
    } catch (err) {
      console.error(
        "An error has occured while getting the current identity: ",
        err
      );
    }
  }

  public listIdentities() {
    try {
      if (!existsSync(this.sshConfigPath)) {
        throw new Error("SSH config file does not exist.");
      }

      const data = fs.readFileSync(this.sshConfigPath, "utf8");
      const regex = /Host (.*)\n/g;
      const identities = data.match(regex);

      if (identities && identities.length > 0) {
        console.log("Identities available:");
        identities.map((identity: string) => {
          console.log(`- ${identity.replace("Host ", "").replace("\n", "")}`);
        });
      } else {
        throw new Error("No identities found.");
      }
    } catch (err) {
      console.error(
        "An error has occured while listing identities: ",
        (err as any).message
      );
    }
  }

  private checkIfGitRepo() {
    try {
      return (
        execSync("git rev-parse --is-inside-work-tree", {
          encoding: "utf8",
          stdio: "pipe",
        })
          .toString()
          .trim() === "true"
      );
    } catch (err) {
      return false;
    }
  }

  private identityAvaialble(identity: string) {
    if (!existsSync(this.sshConfigPath)) {
      return false;
    }

    const data = fs.readFileSync(this.sshConfigPath, "utf8");
    const regex = /Host (.*)\n/g;
    return data.match(regex) !== null;
  }

  public useIdentity(identity: string) {
    try {
      if (!this.checkIfGitRepo()) {
        throw new Error("This directory is not a git repository.");
      }

      if (!this.identityAvaialble(identity)) {
        throw new Error("Identity not available.");
      }

      const originalRepoUrl = execSync("git remote get-url origin", {
        encoding: "utf-8",
        stdio: "pipe",
      });

      const regex = /git@(.*):(.*)\/(.*).git/;

      const match = originalRepoUrl.match(regex);

      if (!match || !match[1] || !match[3]) {
        throw new Error(
          "Could not find an established identity for this repository."
        );
      } else if (match[2] === identity) {
        throw new Error("This identity is already in use.");
      }

      const newRepoUrl = `git@${match[1]}:${identity}/${match[3]}.git`;
      execSync(`git remote set-url origin ${newRepoUrl}`, { stdio: "inherit" });

      console.log("Identity changed successfully.");
    } catch (err) {
      console.error(
        "An error has occured while using identity: ",
        (err as any).message
      );
    }
  }
}
