# GitID — Enterprise Git Identity Management System

[![Version](https://img.shields.io/npm/v/gitid.svg)](https://npmjs.org/package/gitid)
[![License](https://img.shields.io/npm/l/gitid.svg)](https://github.com/InderdeepBajwa/gitid/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/gitid.svg)](https://nodejs.org)
[![Security](https://img.shields.io/badge/security-enterprise--grade-brightgreen)](https://github.com/InderdeepBajwa/gitid#-security)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

GitID is an enterprise-grade CLI tool for managing multiple Git SSH identities seamlessly across any Git provider. Built with security-first principles, it provides industry-standard encryption (AES-256-GCM), comprehensive audit logging, and zero-friction identity switching for developers, teams, and enterprises.

## 🎯 Key Features

### Security First
- **🔐 Industry-Standard Encryption**: AES-256-GCM encryption for sensitive data
- **🔑 Advanced Key Management**: Support for ED25519 (recommended), RSA-4096, and ECDSA-P256
- **🛡️ Secure Key Storage**: Keys stored with restricted permissions (0600) in isolated directories
- **🔒 Passphrase Protection**: Optional passphrase encryption for SSH keys
- **📝 Comprehensive Audit Logging**: Track all identity operations for compliance
- **⚡ Key Rotation**: Built-in key rotation with configurable expiration policies
- **🔍 Input Validation**: Zod-based schema validation for all user inputs

### Developer Experience
- **🚀 Zero Configuration**: Works immediately with sensible secure defaults
- **🔄 Seamless Identity Switching**: One-command identity switching per repository
- **🌐 Universal Provider Support**: GitHub, GitLab, Bitbucket, and self-hosted Git
- **💾 Automated Backups**: Encrypted backup/restore with retention policies
- **🎨 Interactive CLI**: Beautiful prompts with Inquirer for guided setup
- **📊 Status Monitoring**: Real-time progress indicators with Ora spinners
- **🏢 Enterprise Ready**: Winston logging, telemetry hooks, and monitoring support

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

GitID uses a layered configuration system with secure defaults. Configuration is stored in `~/.config/gitid/config.yaml`.

### Configuration Hierarchy
1. **Default Configuration**: Secure defaults built into the application
2. **User Configuration**: Your custom settings in `config.yaml`
3. **Environment Variables**: Override specific settings via env vars
4. **Command-line Flags**: Per-command overrides

### Security Configuration
```yaml
security:
  requirePassphrase: true        # Enforce passphrases for all new keys
  autoRotateKeys: true           # Automatic key rotation reminders
  rotationIntervalDays: 90       # Days between key rotations
  maxKeyAgeDays: 365            # Maximum key age before forced rotation
  enforceKeyExpiration: true     # Block usage of expired keys
```

### Full Configuration Reference
```yaml
# Directory Configuration
configDir: ~/.config/gitid        # Main configuration directory
sshDir: ~/.ssh                    # SSH directory
keysDir: ~/.ssh/gitid            # GitID keys storage (isolated)
backupDir: ~/.config/gitid/backups # Encrypted backups
logDir: ~/.config/gitid/logs     # Audit and application logs

# Security Settings
security:
  requirePassphrase: false        # Require passphrases for new keys
  autoRotateKeys: false          # Enable automatic rotation
  rotationIntervalDays: 90       # Rotation interval
  maxKeyAgeDays: 365            # Maximum key age
  enforceKeyExpiration: false    # Enforce key expiration

# Logging Configuration
logging:
  level: info                    # Log level (debug|info|warn|error)
  file: gitid.log               # Main log file
  maxFiles: 10                  # Log rotation count
  maxSize: 10m                  # Max size per log file
  format: json                  # Log format (json|text)
  auditLog: true                # Enable audit logging

# Backup Settings
backup:
  enabled: true                  # Enable backup features
  encryption: true               # Encrypt backups
  autoBackup: true              # Automatic backups
  retentionDays: 30             # Backup retention period

# Application Settings
defaultKeyType: ed25519         # Default key algorithm
defaultProvider: github.com     # Default Git provider
autoUpdate: true                # Check for updates
telemetry: false                # Anonymous usage stats (disabled by default)
```

## 🔒 Security Implementation

### Encryption & Cryptography
- **AES-256-GCM**: Industry-standard symmetric encryption for backups and sensitive data
- **PBKDF2**: Key derivation with 100,000 iterations for password-based encryption
- **Crypto.randomBytes**: Node.js cryptographically secure random generation
- **SSH Key Standards**: Standard OpenSSH key formats with configurable algorithms

### Security Measures
- **Input Validation**: Zod-based schema validation for user inputs
- **Path Validation**: Basic path validation for file operations
- **File Permissions**: Sets 0600 permissions for SSH keys and sensitive files
- **Type Safety**: TypeScript strict mode for compile-time type checking
- **Error Handling**: Structured error messages with appropriate detail levels

### Security Best Practices
1. **Always use passphrases** for production identities (enforced via `security.requirePassphrase`)
2. **Rotate keys regularly** (configurable via `security.rotationIntervalDays`)
3. **Use ED25519 keys** (smaller, faster, and more secure than RSA)
4. **Enable audit logging** (default enabled, outputs to `~/.config/gitid/logs/audit.log`)
5. **Regular backups** with encryption (automated via `backup.autoBackup`)
6. **Separate identities** per project/client for isolation
7. **Key expiration** enforcement (via `security.enforceKeyExpiration`)

### Compliance & Auditing
- **Structured Audit Logs**: JSON-formatted logs with timestamps and user context
- **Action Tracking**: All identity operations logged with detailed metadata
- **Retention Policies**: Configurable log rotation and retention
- **Export Capabilities**: Export audit logs for compliance reporting

## 🏢 Enterprise & Team Features

### Advanced Security Controls
```bash
# Enable enterprise security mode
gitid config security
# This enables: passphrase requirements, key expiration, audit logging

# Enforce organizational policies
gitid config set security.requirePassphrase true
gitid config set security.maxKeyAgeDays 90
gitid config set security.enforceKeyExpiration true

# Validate security compliance
gitid config validate
gitid doctor --security
```

### Team Identity Management
```bash
# Create team identities with metadata
gitid identity new team-prod \
  --host github.company.com \
  --team "Platform Team" \
  --project "Production Systems" \
  --expires 90 \
  --passphrase

# Bulk identity management
gitid identity list --team "Platform Team" --json

# Tag-based organization
gitid identity update personal --tag personal dev sandbox
gitid identity update work --tag work prod client-a pci-compliant

# Search by tags
gitid identity list --tag pci-compliant
```

### Audit & Compliance
```bash
# Real-time audit monitoring
tail -f ~/.config/gitid/logs/audit.log | jq '.action, .timestamp, .details'

# Generate compliance reports
gitid identity list --verbose --json | \
  jq '[.[] | {alias, created, lastUsed, expires, keyType}]' > compliance-report.json

# Export audit logs for SIEM
gitid backup export-logs --format json --from 2024-01-01 --to 2024-12-31
```

### CI/CD Integration
```bash
# Export identity for CI/CD (secure)
export GITID_IDENTITY=$(gitid identity show ci-deploy --json | \
  jq -r '.privateKeyPath')

# Automated key rotation
#!/bin/bash
# rotate-keys.sh
for alias in $(gitid identity list --json | jq -r '.[].alias'); do
  age=$(gitid identity show "$alias" --json | jq -r '.keyAge')
  if [ "$age" -gt 90 ]; then
    gitid identity rotate "$alias" --passphrase
    echo "Rotated: $alias"
  fi
done

# Docker integration
FROM node:18-alpine
RUN npm install -g gitid
COPY gitid-config.yaml /root/.config/gitid/config.yaml
RUN gitid identity import ci /secrets/ci.key /secrets/ci.pub
```

### Monitoring & Observability
```bash
# Health checks
gitid doctor --json | jq '.status'

# Performance metrics
gitid config set logging.level debug
gitid status --metrics

# Integration with monitoring tools
gitid config set telemetry.endpoint "https://metrics.company.com"
gitid config set telemetry.enabled true
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

## 🚀 Architecture & Performance

### Technology Stack
- **TypeScript 5.7**: Full type safety with strict mode
- **Node.js 18+**: Modern JavaScript runtime
- **Commander.js**: Robust CLI framework
- **Zod**: Runtime type validation and schema enforcement
- **Winston**: Enterprise logging with rotation
- **Inquirer**: Interactive prompts for better UX
- **Chalk & Ora**: Beautiful terminal output

### Performance Optimizations
- **Lazy Loading**: Services initialized only when needed
- **Singleton Pattern**: Efficient resource management
- **Async/Await**: Non-blocking I/O operations
- **Stream Processing**: Memory-efficient file operations
- **Caching**: In-memory caching for frequently accessed data

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

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Build for production
npm run build

# Run tests (when implemented)
npm test
```

### Code Quality Standards
- **TypeScript Strict Mode**: Full type safety enforced
- **ESLint**: Code quality and security checks
- **Prettier**: Consistent code formatting
- **Security Linting**: `eslint-plugin-security` for vulnerability detection
- **Pre-commit Hooks**: Automated quality checks

## 🔍 Troubleshooting & Diagnostics

### Built-in Doctor Command
```bash
# Run comprehensive diagnostics
gitid doctor

# Check specific areas
gitid doctor --security    # Security configuration
gitid doctor --ssh         # SSH connectivity
gitid doctor --permissions # File permissions
```

### Common Solutions

#### SSH Key Permissions
```bash
# GitID automatically fixes permissions, but if needed:
chmod 700 ~/.ssh
chmod 600 ~/.ssh/config
chmod 600 ~/.ssh/gitid/*
```

#### Identity Not Working
```bash
# Test connection
gitid test-connection <alias>

# Verify and fix SSH config
gitid doctor --fix

# Force re-apply identity
gitid use <alias> --force
```

#### Key Rotation Issues
```bash
# Manual rotation with new algorithm
gitid identity rotate <alias> --type ed25519 --passphrase

# Backup before rotation
gitid backup create --full
gitid identity rotate <alias>
```

## 📈 Roadmap

### Version 2.1 (Q1 2025)
- [ ] Hardware security key support (YubiKey, Titan)
- [ ] Multi-factor authentication for identity access
- [ ] GraphQL API for enterprise integrations
- [ ] Web UI for identity management

### Version 2.2 (Q2 2025)
- [ ] Kubernetes secrets integration
- [ ] HashiCorp Vault backend
- [ ] SAML/OIDC authentication
- [ ] Advanced analytics dashboard

## 📄 License

MIT © Inderdeep Singh Bajwa

## 🙏 Acknowledgments

### Core Dependencies
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Zod](https://github.com/colinhacks/zod) - Schema validation
- [Winston](https://github.com/winstonjs/winston) - Enterprise logging
- [Inquirer](https://github.com/SBoudrias/Inquirer.js/) - Interactive prompts
- [Chalk](https://github.com/chalk/chalk) & [Ora](https://github.com/sindresorhus/ora) - Terminal UI

### Security Libraries
- Node.js Crypto - Cryptographic operations
- Keytar - Secure credential storage (optional)

## 📞 Support

- 📧 Email: support@gitid.dev
- 🐛 Issues: [GitHub Issues](https://github.com/InderdeepBajwa/gitid/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/InderdeepBajwa/gitid/discussions)
- 📖 Documentation: [GitID Docs](https://gitid.dev/docs)

---

<div align="center">
  <strong>GitID v2.0</strong> - Enterprise Git Identity Management<br>
  Built with ❤️ for developers who juggle multiple Git identities<br>
  <sub>Secure • Fast • Reliable</sub>
</div>