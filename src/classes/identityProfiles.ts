import fs from "fs";
import os from "os";
import path from "path";

export interface IdentityProfile {
  alias: string;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IdentityProfilesDocument {
  version: number;
  identities: IdentityProfile[];
}

type LegacyIdentityProfile = {
  alias?: string;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  name?: string | null;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const CURRENT_DOCUMENT_VERSION = 1;

export class IdentityProfileStore {
  public constructor(
    private readonly configDirPath: string = path.join(
      os.homedir(),
      ".config",
      "gitid"
    ),
    private readonly profileFilePath: string = path.join(
      configDirPath,
      "identities.json"
    )
  ) {}

  public getProfilePath(): string {
    return this.profileFilePath;
  }

  public listProfiles(): IdentityProfile[] {
    return this.loadDocument().identities;
  }

  public getProfile(alias: string): IdentityProfile | null {
    return (
      this.loadDocument().identities.find((profile) => profile.alias === alias) ||
      null
    );
  }

  public upsertProfile(
    alias: string,
    updates: {
      gitUserName?: string | null;
      gitUserEmail?: string | null;
    }
  ): IdentityProfile {
    const document = this.loadDocument();
    const now = new Date().toISOString();
    const existingProfile = document.identities.find(
      (profile) => profile.alias === alias
    );

    const nextProfile: IdentityProfile = {
      alias,
      gitUserName:
        updates.gitUserName !== undefined
          ? updates.gitUserName
          : existingProfile?.gitUserName,
      gitUserEmail:
        updates.gitUserEmail !== undefined
          ? updates.gitUserEmail
          : existingProfile?.gitUserEmail,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now,
    };

    const remainingProfiles = document.identities.filter(
      (profile) => profile.alias !== alias
    );
    remainingProfiles.push(nextProfile);
    document.identities = remainingProfiles.sort((left, right) =>
      left.alias.localeCompare(right.alias)
    );
    this.saveDocument(document);

    return nextProfile;
  }

  private loadDocument(): IdentityProfilesDocument {
    if (!fs.existsSync(this.profileFilePath)) {
      return this.buildEmptyDocument();
    }

    let parsedDocument: unknown;

    try {
      parsedDocument = JSON.parse(fs.readFileSync(this.profileFilePath, "utf8"));
    } catch {
      throw new Error(
        `Could not read identity profile store at '${this.profileFilePath}'. Please fix or remove the file.`
      );
    }

    return this.normalizeDocument(parsedDocument);
  }

  private normalizeDocument(document: unknown): IdentityProfilesDocument {
    if (Array.isArray(document)) {
      return {
        version: CURRENT_DOCUMENT_VERSION,
        identities: document.map((profile) => this.normalizeProfile(profile)),
      };
    }

    if (
      document &&
      typeof document === "object" &&
      "identities" in document &&
      Array.isArray((document as IdentityProfilesDocument).identities)
    ) {
      return {
        version: CURRENT_DOCUMENT_VERSION,
        identities: (document as IdentityProfilesDocument).identities.map((profile) =>
          this.normalizeProfile(profile)
        ),
      };
    }

    if (document && typeof document === "object") {
      return {
        version: CURRENT_DOCUMENT_VERSION,
        identities: Object.entries(document).map(([alias, profile]) =>
          this.normalizeProfile(profile, alias)
        ),
      };
    }

    throw new Error(
      `Identity profile store '${this.profileFilePath}' is in an unsupported format. Please fix or remove the file.`
    );
  }

  private normalizeProfile(
    profile: LegacyIdentityProfile,
    fallbackAlias?: string
  ): IdentityProfile {
    const alias = (profile.alias || fallbackAlias || "").trim();

    if (!alias) {
      throw new Error(
        `Identity profile store '${this.profileFilePath}' contains an entry without an alias.`
      );
    }

    const createdAt = profile.createdAt || new Date().toISOString();
    const updatedAt = profile.updatedAt || createdAt;

    return {
      alias,
      gitUserName:
        profile.gitUserName !== undefined ? profile.gitUserName : profile.name,
      gitUserEmail:
        profile.gitUserEmail !== undefined ? profile.gitUserEmail : profile.email,
      createdAt,
      updatedAt,
    };
  }

  private saveDocument(document: IdentityProfilesDocument): void {
    fs.mkdirSync(this.configDirPath, { recursive: true });
    fs.writeFileSync(
      this.profileFilePath,
      JSON.stringify(document, null, 2) + "\n"
    );
  }

  private buildEmptyDocument(): IdentityProfilesDocument {
    return {
      version: CURRENT_DOCUMENT_VERSION,
      identities: [],
    };
  }
}

export function hasManagedAuthorSettings(
  profile: IdentityProfile | null
): profile is IdentityProfile {
  return Boolean(
    profile &&
      (profile.gitUserName !== undefined || profile.gitUserEmail !== undefined)
  );
}

export function formatManagedAuthorSettings(profile: IdentityProfile): string[] {
  return [
    `user.name=${
      profile.gitUserName === undefined
        ? "(unchanged)"
        : profile.gitUserName === null
          ? "(unset)"
          : profile.gitUserName
    }`,
    `user.email=${
      profile.gitUserEmail === undefined
        ? "(unchanged)"
        : profile.gitUserEmail === null
          ? "(unset)"
          : profile.gitUserEmail
    }`,
  ];
}
