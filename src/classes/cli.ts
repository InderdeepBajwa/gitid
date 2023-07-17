import fs from "fs";
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
      console.error("An error has occured while creating the SSH key: ", err);
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
}
