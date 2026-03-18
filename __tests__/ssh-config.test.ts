import fs from "fs";
import os from "os";
import path from "path";
import { buildGitRemoteUrl, parseGitRemoteUrl } from "../src/classes/gitRemote";
import {
  SSHConfigInspector,
  formatIdentityRepairPrompt,
} from "../src/classes/sshConfig";

describe("SSH config compatibility", () => {
  let tempDir: string;
  let sshDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitid-test-"));
    sshDir = path.join(tempDir, ".ssh");
    configPath = path.join(sshDir, "config");
    fs.mkdirSync(sshDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("matches exact host aliases instead of substring matches", () => {
    fs.writeFileSync(
      configPath,
      [
        "Host work-old",
        "   HostName github.com",
        "   User git",
        `   IdentityFile ${path.join(sshDir, "gitid_work-old")}`,
        "   IdentitiesOnly yes",
      ].join("\n")
    );

    const inspector = new SSHConfigInspector(sshDir, configPath);

    expect(inspector.getIdentity("work")).toBeNull();
  });

  it("keeps legacy gitta_ identities usable while flagging them", () => {
    const legacyKeyPath = path.join(sshDir, "gitta_personal");
    fs.writeFileSync(legacyKeyPath, "private-key");
    fs.writeFileSync(`${legacyKeyPath}.pub`, "public-key");
    fs.writeFileSync(
      configPath,
      [
        "Host personal",
        "   HostName github.com",
        "   User git",
        `   IdentityFile ${legacyKeyPath}`,
        "   IdentitiesOnly yes",
      ].join("\n")
    );

    const inspector = new SSHConfigInspector(sshDir, configPath);
    const identity = inspector.getIdentity("personal");

    expect(identity).not.toBeNull();
    expect(identity?.status).toBe("legacy");
    expect(identity?.privateKeyPath).toBe(legacyKeyPath);
    expect(identity?.publicKeyPath).toBe(`${legacyKeyPath}.pub`);
  });

  it("prompts users to repair a historical config path when a matching key exists", () => {
    const currentKeyPath = path.join(sshDir, "gitid_personal");
    fs.writeFileSync(currentKeyPath, "private-key");
    fs.writeFileSync(`${currentKeyPath}.pub`, "public-key");
    fs.writeFileSync(
      configPath,
      [
        "Host personal",
        "   HostName github.com",
        "   User git",
        `   IdentityFile ${path.join(sshDir, "configgitid_personal")}`,
        "   IdentitiesOnly yes",
      ].join("\n")
    );

    const inspector = new SSHConfigInspector(sshDir, configPath);
    const identity = inspector.getIdentity("personal");

    expect(identity).not.toBeNull();
    expect(identity?.status).toBe("broken");
    expect(identity?.repairPath).toBe(currentKeyPath);
    expect(formatIdentityRepairPrompt(identity!, configPath)).toContain(
      `IdentityFile ${currentKeyPath}`
    );
  });
});

describe("Git SSH remotes", () => {
  it("supports nested repository paths and preserves the .git suffix", () => {
    const remote = parseGitRemoteUrl("git@personal:group/subgroup/repo.git");

    expect(remote).toEqual({
      host: "personal",
      repositoryPath: "group/subgroup/repo",
      hasGitSuffix: true,
    });
    expect(buildGitRemoteUrl(remote!)).toBe(
      "git@personal:group/subgroup/repo.git"
    );
  });

  it("supports SSH remotes without the .git suffix", () => {
    const remote = parseGitRemoteUrl("git@work:team/repo");

    expect(remote).toEqual({
      host: "work",
      repositoryPath: "team/repo",
      hasGitSuffix: false,
    });
    expect(buildGitRemoteUrl(remote!)).toBe("git@work:team/repo");
  });
});
