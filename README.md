## GitID — Multi-provider Git SSH identity manager

GitID is a zero-friction CLI to create and switch between multiple SSH identities and use them per-repository. It works with any Git provider: GitHub, GitLab, Bitbucket, and custom/self-hosted domains.

Back up your `~/.ssh` directory before first use.

### Install

```bash
npm i -g gitid
```

### Publish (maintainers)

- Push a tag like `v1.0.0` to `main` to trigger publish, or run the workflow manually with a version input.
- Add `NPM_TOKEN` secret in the repository with publish rights for [`gitid`](https://www.npmjs.com/package/gitid).

### Quick start

```bash
# create an identity alias for GitHub
gitid new personal --host github.com --email me@example.com --name "My Name"

# print public key to add on provider
gitid show personal

# in a repo, switch to this identity
gitid use personal
 
# clone a repo using this identity (rewrites URL to git@personal:owner/repo.git)
gitid clone personal https://github.com/owner/repo.git
gitid clone personal owner/repo my-local-dir
```

### Commands

- `gitid new <alias> [--host <host>] [--type ed25519|rsa] [--passphrase <pass>] [--name <git user.name>] [--email <git user.email>]`
- `gitid list`
- `gitid show <alias>`
- `gitid current [--remote origin]`
- `gitid use <alias> [--remote origin]`
- `gitid clone <alias> <repo> [directory]`
- `gitid remove <alias> [--delete-keys]`
- `gitid rename <old> <new>`
- `gitid config <alias> [--name <user>] [--email <addr>] [--clear-name] [--clear-email]`
- `gitid apply <alias>`

Identities are stored as:
- SSH keys in `~/.ssh/gitid/<alias>` and `~/.ssh/gitid/<alias>.pub`
- SSH config blocks wrapped with safe markers in `~/.ssh/config`
- Metadata in `~/.config/gitid/identities.json`

### How it works

- Creates SSH keys per alias and adds a `Host <alias>` block that points to your provider host.
- When you `use <alias>`, your repo remote becomes `git@<alias>:owner/repo.git`, letting SSH choose the right key.
- Optionally sets per-repo `user.name` and `user.email` when switching.
  - You can also manage them separately via `gitid config` and apply with `gitid apply`.

### Notes

- Works with any host: e.g. `--host gitlab.com`, `--host bitbucket.org`, or custom domains like `git.company.com`.
- You can safely edit `~/.ssh/config`; GitID only manages blocks between markers.

### License

MIT
