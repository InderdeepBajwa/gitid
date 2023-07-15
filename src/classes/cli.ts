import fs from "fs";
import os from "os";
import { execSync } from "child_process";

export class CLI {
  private sshConfigPath = `${os.homedir()}/.ssh/config`;
  private sshKeyPath = `${os.homedir()}/.ssh/`;

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
          this.sshKeyPath
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
        `   IdentityFile ${this.sshKeyPath}_${keyAlias}\n` +
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
      `   IdentityFile ${this.sshKeyPath}_${keyAlias}\n` +
      `   IdentitiesOnly yes\n`;

    fs.writeFileSync(this.sshConfigPath, newHost);
    console.log("New Host added successfully.");
  }
}
