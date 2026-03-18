export interface GitRemoteDetails {
  host: string;
  repositoryPath: string;
  hasGitSuffix: boolean;
}

const GIT_SSH_REMOTE_REGEX = /^git@([^:]+):(.+?)(\.git)?$/;

export function parseGitRemoteUrl(remoteUrl: string): GitRemoteDetails | null {
  const match = remoteUrl.trim().match(GIT_SSH_REMOTE_REGEX);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    host: match[1],
    repositoryPath: match[2],
    hasGitSuffix: Boolean(match[3]),
  };
}

export function buildGitRemoteUrl(details: GitRemoteDetails): string {
  const suffix = details.hasGitSuffix ? ".git" : "";
  return `git@${details.host}:${details.repositoryPath}${suffix}`;
}
