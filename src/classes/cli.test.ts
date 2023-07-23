import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { CLI } from "./cli";

jest.mock("fs");
jest.mock("os");

describe("CLI functionality", () => {
  const cli = new CLI();
  const SSH_CONFIG_FILE_PATH = `${os.homedir()}/.ssh/config`;
  const mockFs = fs as unknown as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should create new key", async () => {
    mockFs.existsSync.mockReturnValueOnce(false);
    await cli.createNewKey("test");
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      SSH_CONFIG_FILE_PATH,
      expect.any(String)
    );
  });

  it("should print current identity", () => {
    jest
      .spyOn(require("child_process"), "execSync")
      .mockReturnValue("git@test:test.git");
    const consoleLogSpy = jest.spyOn(console, "log");
    cli.printCurrentIdentity();
    expect(consoleLogSpy).toHaveBeenCalledWith("Current identity: test");
  });

  it("should list all identities", () => {
    mockFs.existsSync.mockReturnValueOnce(true);
    mockFs.readFileSync.mockReturnValueOnce("Host test\n");
    const consoleLogSpy = jest.spyOn(console, "log");
    cli.listAllIdentities();
    expect(consoleLogSpy).toHaveBeenCalledWith("- test");
  });

  it("should handle change identity", () => {
    jest
      .spyOn(require("child_process"), "execSync")
      .mockImplementation((cmd) => {
        if (cmd === "git rev-parse --is-inside-work-tree") return "true";
        if (cmd === "git remote get-url origin")
          return "git@github.com:test/test.git";
        return "";
      });
    mockFs.existsSync.mockReturnValueOnce(true);
    mockFs.readFileSync.mockReturnValueOnce("Identity test\n");
    cli.changeIdentity("test2");
    expect(execSync).toHaveBeenCalledWith(
      "git remote set-url origin git@github.com:test2/test.git",
      { stdio: "pipe" }
    );
  });

  it("should handle identity not available scenario", () => {
    mockFs.existsSync.mockReturnValueOnce(true);
    mockFs.readFileSync.mockReturnValueOnce("test1\n");
    const consoleErrorSpy = jest.spyOn(console, "error");
    cli.changeIdentity("test2");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Identity not available.");
  });
});
