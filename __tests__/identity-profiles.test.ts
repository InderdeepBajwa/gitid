import fs from "fs";
import os from "os";
import path from "path";
import {
  IdentityProfileStore,
  formatManagedAuthorSettings,
  hasManagedAuthorSettings,
} from "../src/classes/identityProfiles";

describe("IdentityProfileStore", () => {
  let tempDir: string;
  let configDir: string;
  let profilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitid-profiles-"));
    configDir = path.join(tempDir, ".config", "gitid");
    profilePath = path.join(configDir, "identities.json");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores and returns managed git author metadata", () => {
    const store = new IdentityProfileStore(configDir, profilePath);

    store.upsertProfile("work", {
      gitUserName: "Jane Doe",
      gitUserEmail: "jane@example.com",
    });

    const profile = store.getProfile("work");

    expect(profile).not.toBeNull();
    expect(profile?.gitUserName).toBe("Jane Doe");
    expect(profile?.gitUserEmail).toBe("jane@example.com");
    expect(hasManagedAuthorSettings(profile)).toBe(true);
    expect(formatManagedAuthorSettings(profile!)).toEqual([
      "user.name=Jane Doe",
      "user.email=jane@example.com",
    ]);
  });

  it("migrates older keyed profile documents", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      profilePath,
      JSON.stringify({
        work: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
      })
    );

    const store = new IdentityProfileStore(configDir, profilePath);
    const profile = store.getProfile("work");

    expect(profile).not.toBeNull();
    expect(profile?.gitUserName).toBe("Jane Doe");
    expect(profile?.gitUserEmail).toBe("jane@example.com");
  });

  it("supports explicit unsetting of local git author fields", () => {
    const store = new IdentityProfileStore(configDir, profilePath);

    store.upsertProfile("personal", {
      gitUserName: null,
      gitUserEmail: null,
    });

    const profile = store.getProfile("personal");

    expect(profile).not.toBeNull();
    expect(profile?.gitUserName).toBeNull();
    expect(profile?.gitUserEmail).toBeNull();
    expect(formatManagedAuthorSettings(profile!)).toEqual([
      "user.name=(unset)",
      "user.email=(unset)",
    ]);
  });
});
