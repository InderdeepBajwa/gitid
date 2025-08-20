# GitID — Enterprise Git Identity Management System

[![Version](https://img.shields.io/npm/v/gitid.svg)](https://npmjs.org/package/gitid)
[![License](https://img.shields.io/npm/l/gitid.svg)](https://github.com/InderdeepBajwa/gitid/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/gitid.svg)](https://nodejs.org)

GitID is an enterprise-grade CLI tool for managing multiple Git SSH identities seamlessly across any Git provider (GitHub, GitLab, Bitbucket, and self-hosted instances). It provides secure credential storage, comprehensive auditing, and zero-friction identity switching.

## 🎯 Key Features

- **🔐 Secure Identity Management**: Enterprise-grade security with encrypted key storage
- **🔄 Seamless Identity Switching**: Switch between identities with a single command
- **🌐 Multi-Provider Support**: Works with GitHub, GitLab, Bitbucket, and custom Git hosts
- **📊 Comprehensive Auditing**: Track identity usage and maintain audit logs
- **🔑 Advanced Key Management**: Support for ED25519, RSA, and ECDSA keys
- **💾 Backup & Restore**: Automated backups with encryption support
- **🏢 Enterprise Ready**: Logging, monitoring, and compliance features
- **🚀 Zero Configuration**: Works out of the box with sensible defaults

## 📦 Installation

### Requirements
- Node.js 18 or higher
- Git 2.0 or higher
- SSH client

### Install via npm
```bash
npm install -g gitid
```

### Install via yarn
```bash
yarn global add gitid
```

## 🚀 Quick Start

### 1. Create your first identity
```bash
# Interactive mode (recommended for first-time users)
gitid identity new

# Or with arguments
gitid identity new personal \
  --host github.com \
  --email john.doe@example.com \
  --name "John Doe"
```

### 2. Add the public key to your Git provider
```bash
# Display the public key
gitid identity show personal --public-key

# Copy to clipboard (on macOS)
gitid identity show personal --public-key | pbcopy
```

### 3. Use the identity in a repository
```bash
# Switch to identity for current repo
gitid use personal

# Clone with specific identity
gitid clone personal https://github.com/user/repo.git
```

## 📖 Command Reference

### Identity Management

#### Create Identity
```bash
gitid identity new [alias] [options]
  -h, --host <host>       Git provider host
  -t, --type <type>       Key type (ed25519, rsa, ecdsa)
  -p, --passphrase        Use passphrase for key
  -n, --name <name>       Git user name
  -e, --email <email>     Git user email
  --tag <tags...>         Tags for the identity
  --team <team>           Team name
  --project <project>     Project name
  --expires <days>        Key expiration in days
```

#### List Identities
```bash
gitid identity list [options]
  --json                  Output in JSON format
  --verbose               Show detailed information
```

#### Show Identity Details
```bash
gitid identity show <alias> [options]
  --public-key            Show only public key
  --json                  Output in JSON format
```

#### Update Identity
```bash
gitid identity update <alias> [options]
  -n, --name <name>       Update git user name
  -e, --email <email>     Update git user email
  --tag <tags...>         Update tags
  --team <team>           Update team
  --project <project>     Update project
  --activate              Activate identity
  --deactivate            Deactivate identity
```

#### Remove Identity
```bash
gitid identity remove <alias> [options]
  --delete-keys           Also delete SSH key files
  --force                 Skip confirmation
```

#### Rename Identity
```bash
gitid identity rename <old-alias> <new-alias>
```

#### Rotate Keys
```bash
gitid identity rotate <alias> [options]
  -p, --passphrase        Use new passphrase
```

### Git Operations

#### Use Identity
```bash
gitid use <alias> [options]
  -r, --remote <remote>   Git remote name (default: origin)
```

#### Show Current Identity
```bash
gitid current [options]
  -r, --remote <remote>   Git remote name (default: origin)
```

#### Clone Repository
```bash
gitid clone <alias> <repository> [directory] [options]
  -b, --branch <branch>   Clone specific branch
  -d, --depth <depth>     Create shallow clone
  --recursive             Clone submodules recursively
```

#### Apply Identity Config
```bash
gitid apply <alias>
```

#### Repository Status
```bash
gitid status
```

#### Interactive Identity Switch
```bash
gitid switch
```

### Backup & Restore

#### Create Backup
```bash
gitid backup create [options]
  --full                  Create full backup including all files
```

#### List Backups
```bash
gitid backup list [options]
  --json                  Output in JSON format
```

#### Restore Backup
```bash
gitid backup restore [backup-name] [options]
  --force                 Skip confirmation
```

#### Export Keys
```bash
gitid backup export <alias> <output-dir>
```

#### Import Keys
```bash
gitid backup import <alias> <private-key> <public-key>
```

### Configuration

#### Show Configuration
```bash
gitid config show [options]
  --json                  Output in JSON format
```

#### Set Configuration Value
```bash
gitid config set <key> <value>

# Examples:
gitid config set security.requirePassphrase true
gitid config set logging.level debug
```

#### Configure Security Settings
```bash
gitid config security
```

#### Show Configured Paths
```bash
gitid config paths
```

#### Validate Configuration
```bash
gitid config validate
```

### Utility Commands

#### Diagnose Issues
```bash
gitid doctor
```

#### Test Connection
```bash
gitid test-connection <alias>
```

#### Clean Up
```bash
gitid clean [options]
  --force                 Skip confirmation
```

#### Version Information
```bash
gitid version
```

## ⚙️ Configuration

GitID stores its configuration in `~/.config/gitid/config.yaml`. You can edit this file directly or use the `gitid config` commands.

### Default Configuration
```yaml
configDir: ~/.config/gitid
sshDir: ~/.ssh
keysDir: ~/.ssh/gitid
backupDir: ~/.config/gitid/backups
logDir: ~/.config/gitid/logs

security:
  requirePassphrase: false
  autoRotateKeys: false
  rotationIntervalDays: 90
  maxKeyAgeDays: 365
  enforceKeyExpiration: false

logging:
  level: info
  file: gitid.log
  maxFiles: 10
  maxSize: 10m
  format: json
  auditLog: true

backup:
  enabled: true
  encryption: true
  autoBackup: true
  retentionDays: 30

defaultKeyType: ed25519
defaultProvider: github.com
autoUpdate: true
telemetry: false
```

## 🔒 Security

### Best Practices
1. **Always use passphrases** for production identities
2. **Rotate keys regularly** (every 90 days recommended)
3. **Use ED25519 keys** when possible (more secure and faster)
4. **Enable audit logging** for compliance
5. **Backup your identities** regularly
6. **Use separate identities** for different projects/clients

### Key Storage
- SSH keys are stored in `~/.ssh/gitid/`
- Configuration in `~/.config/gitid/`
- All files are created with restricted permissions (0600)
- Optional encryption for backups

### Audit Logging
GitID maintains comprehensive audit logs for:
- Identity creation/deletion
- Key rotations
- Identity usage
- Configuration changes

## 🏢 Enterprise Features

### Team Management
```bash
# Create team identity
gitid identity new team-prod \
  --host github.company.com \
  --team "Platform Team" \
  --project "Production Systems" \
  --expires 90

# Tag identities for organization
gitid identity update personal --tag personal development
gitid identity update work --tag work production client-a
```

### Compliance & Auditing
```bash
# Enable strict security
gitid config set security.requirePassphrase true
gitid config set security.enforceKeyExpiration true
gitid config set security.maxKeyAgeDays 90

# Review audit logs
tail -f ~/.config/gitid/logs/audit.log | jq
```

### Automation Support
```bash
# Export identity for CI/CD
gitid identity show ci-deploy --json > identity.json

# Batch operations
for alias in $(gitid identity list --json | jq -r '.[].alias'); do
  gitid identity rotate "$alias"
done
```

## 🔧 Troubleshooting

### Run Diagnostics
```bash
gitid doctor
```

### Common Issues

#### Permission Denied
```bash
# Fix SSH config permissions
chmod 600 ~/.ssh/config
chmod 700 ~/.ssh
chmod 600 ~/.ssh/gitid/*
```

#### Identity Not Working
```bash
# Test the connection
gitid test-connection <alias>

# Verify remote URL
git remote -v

# Re-apply identity
gitid use <alias> --force
```

#### SSH Agent Issues
```bash
# Start SSH agent
eval $(ssh-agent -s)

# Add key to agent
ssh-add ~/.ssh/gitid/<alias>
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/InderdeepBajwa/gitid.git
cd gitid

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📄 License

MIT © Inderdeep Singh Bajwa

## 🙏 Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI
- Uses [Zod](https://github.com/colinhacks/zod) for validation
- Powered by [Winston](https://github.com/winstonjs/winston) for logging
- UI enhanced with [Chalk](https://github.com/chalk/chalk) and [Ora](https://github.com/sindresorhus/ora)

## 📞 Support

- 📧 Email: support@gitid.dev
- 🐛 Issues: [GitHub Issues](https://github.com/InderdeepBajwa/gitid/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/InderdeepBajwa/gitid/discussions)

---

**Note**: This is a complete rewrite of the original gitid tool with enterprise features, better security, and improved user experience. The tool maintains backward compatibility while adding professional-grade features for team and enterprise use.