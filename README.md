# GitID

GitID is a CLI for creating, listing, inspecting, and switching Git SSH identities on one machine.

It is designed for people who regularly work across personal, work, and client repositories and want a simple way to manage SSH aliases without manually editing remotes every time.

GitID edits `~/.ssh/config`, creates `ed25519` SSH keys, and updates repository remotes to use your selected SSH host alias.
It can also manage repository-local `git config user.name` and `git config user.email` per identity.

**Caution:** GitID modifies SSH configuration. Back up `~/.ssh` before using it for the first time.

## Installation

```bash
npm install -g gitid
```

## Quick Start

Create an identity:

```bash
gitid new personal --name "Jane Doe" --email jane@example.com
```

List configured identities:

```bash
gitid list
```

Switch the current repository to a different SSH identity:

```bash
gitid use personal
```

Show the public key so you can add it to GitHub or another Git provider:

```bash
gitid show personal
```

Store or update the git author used when that identity is selected:

```bash
gitid set personal --name "Jane Doe" --email jane@example.com
```

## Commands

### `gitid new <identity>`

Creates a new `ed25519` SSH identity and adds a matching `Host` entry to `~/.ssh/config`.
You can also set git author metadata during creation with `--name` and `--email`.

Example:

```bash
gitid new work
```

### `gitid list`

Lists the SSH host aliases GitID can manage from your SSH config.

If GitID detects an outdated or broken config entry, it prints a repair prompt showing the `Host` block you should restore.

### `gitid current`

Prints the SSH identity currently used by the repository in your current working directory.

### `gitid use <identity>`

Updates the current repository's `origin` remote to use the selected SSH alias.
If the identity has managed git author settings, GitID applies them to the current repository's local git config.

GitID preserves nested repository paths and supports remotes with or without the `.git` suffix.

Example:

```bash
gitid use work
```

To skip author metadata for a one-off switch:

```bash
gitid use work --skip-author
```

### `gitid show <identity>`

Reads the matching `IdentityFile` from `~/.ssh/config` and prints the public key contents.

Example:

```bash
gitid show work
```

### `gitid set <identity>`

Stores git author metadata for an identity so `gitid use <identity>` can apply it to the current repository.

Examples:

```bash
gitid set work --name "Jane Doe" --email jane@example.com
gitid set work --clear-email
```

`--clear-name` and `--clear-email` tell GitID to unset the local repo value for that field the next time the identity is applied.

## SSH Config Compatibility

GitID now handles several older real-world config cases more safely:

- exact alias matching instead of substring matching
- legacy `gitta_<identity>` key paths from early releases
- broken historical `IdentityFile` paths created by older GitID versions
- clearer repair prompts when the SSH config is out of sync with the local key files
- managed git author metadata that can be reapplied when a repository drifts out of sync

If a config entry is unsupported or broken, GitID will not silently continue. It will tell you what is wrong and print the `Host` block that should be restored in `~/.ssh/config`.

## Do I need GitID?

GitID is your solution if you are:

- Having a hard time managing multiple Git identity files on a single user account
- Struggling with permission issues when accidentally pushing from a wrong identity file
- Tired of having to modify git URLs every time you clone or add a new remote

## Manual Installation and Contribution

First, clone the repository:

```bash
git clone https://github.com/inderdeepbajwa/gitid.git
cd gitid
```

Then install the dependencies:

```bash
npm install
```

Finally, build the code:

```bash
npm run build
```

Run the tests:

```bash
npm test -- --runInBand
```

## Note

This CLI is meant for managing SSH identities on a single machine, the identity names you use are local to your machine and do not have to correspond to your actual GitHub username.

## License

[MIT](LICENSE)

---
