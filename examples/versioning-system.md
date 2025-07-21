# Versioning System

The API Spawner CLI includes a comprehensive versioning system that helps you track which version of the tool you're using and provides detailed information about the build and environment.

## Version Information

### Quick Version Check
```bash
# Display just the version number
api-spawner --version
# Output: 1.0.0

# Display detailed version information
api-spawner version
```

### Detailed Version Output
When you run `api-spawner version`, you'll see comprehensive information:

```
🚀 API Spawner
==============

Version: v1.0.0 [dev]
Description: A CLI tool to create and manage multiple AWS API Gateways across accounts and regions
Node.js: v20.11.1
Platform: darwin arm64
Environment: Development

Features:
  • Multi-Account Support
  • Multi-Region Support
  • STS AssumeRole
  • Interactive CLI
  • Bulk Operations
  • Role Discovery
  • Progress Bars
  • Retry Mechanism
  • Performance Optimizations

Recent Updates:
  • Enhanced retry mechanism with Retry-After header extraction
  • Performance optimizations for bulk-delete operations
  • Single progress bar with integrated retry information
  • Improved error handling and user experience
  • Version management system

For more information, visit:
https://github.com/your-username/api-spawner
```

## Version Components

### 1. **Version Number**
- **Format**: `v1.0.0`
- **Source**: `package.json` version field
- **Semantic Versioning**: Major.Minor.Patch

### 2. **Environment Indicator**
- **Development**: `[dev]` suffix
- **Production**: No suffix
- **Determined by**: `NODE_ENV` environment variable

### 3. **Build Information** (Optional)
- **Build Time**: UTC timestamp when built
- **Git Commit**: Short commit hash (if available)
- **Set via**: Environment variables during build

### 4. **System Information**
- **Node.js Version**: Current Node.js runtime
- **Platform**: Operating system and architecture
- **Runtime Environment**: Development or Production

## Version Management

### Version Manager Class
The tool uses a `VersionManager` class that provides:

```typescript
interface VersionInfo {
  version: string;
  description: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  buildTime?: string;
  gitCommit?: string;
}
```

### Key Methods
- `getVersion()`: Get version string
- `getVersionInfo()`: Get full version information
- `getFullVersionString()`: Get formatted version with environment
- `isDevelopment()`: Check if running in development
- `isProduction()`: Check if running in production

## Build Process

### Standard Build
```bash
# Standard TypeScript build
yarn build

# Full build with version information
yarn build:full
```

### Build Script Features
The `scripts/build.sh` script provides:

1. **Build Time Injection**: Automatically sets `BUILD_TIME` environment variable
2. **Git Commit Detection**: Extracts current git commit hash
3. **Environment Variables**: Sets build-time information
4. **Executable Permissions**: Makes CLI executable
5. **Build Verification**: Displays build information

### Environment Variables
```bash
# Set during build process
BUILD_TIME="2024-01-15T12:30:00Z"
GIT_COMMIT="abc123def456"

# Used by version manager
NODE_ENV="development"  # or "production"
```

## Version Commands

### Available Commands
```bash
# Display version number only
api-spawner --version

# Display detailed version information
api-spawner version

# Check version from package.json
yarn version:info

# Check version from built CLI
yarn version:check
```

### Command Line Options
- `-v, --version`: Quick version display
- `version`: Detailed version information

## Version History

### Version 1.0.0
- **Initial Release**: Core functionality
- **Features**: Multi-account, multi-region support
- **Commands**: create, list, delete, configure, bulk operations

### Recent Updates (v1.0.0)
- Enhanced retry mechanism with Retry-After header extraction
- Performance optimizations for bulk-delete operations
- Single progress bar with integrated retry information
- Improved error handling and user experience
- Version management system

## Best Practices

### 1. **Version Checking**
```bash
# Always check version before using
api-spawner --version

# For detailed information
api-spawner version
```

### 2. **Build Process**
```bash
# Use full build for production
yarn build:full

# Use standard build for development
yarn build
```

### 3. **Environment Management**
```bash
# Set environment for production builds
NODE_ENV=production yarn build:full

# Development (default)
yarn build
```

### 4. **Version Tracking**
- Keep `package.json` version updated
- Use semantic versioning
- Document changes in version command output
- Include build information for production releases

## Troubleshooting

### Common Issues

#### Version Not Displaying
```bash
# Check if package.json exists
ls package.json

# Verify version field
cat package.json | grep version
```

#### Build Information Missing
```bash
# Use full build script
yarn build:full

# Check environment variables
echo $BUILD_TIME
echo $GIT_COMMIT
```

#### Environment Detection Issues
```bash
# Set NODE_ENV explicitly
NODE_ENV=production api-spawner version

# Check current environment
echo $NODE_ENV
```

### Version Manager Fallbacks
The version manager includes fallback mechanisms:

1. **Multiple Path Resolution**: Tries different package.json locations
2. **Default Values**: Provides sensible defaults if package.json missing
3. **Error Handling**: Graceful degradation on errors
4. **Environment Detection**: Automatic environment detection

## Integration with CI/CD

### Build Pipeline Example
```yaml
# GitHub Actions example
- name: Build with version info
  run: |
    export BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    export GIT_COMMIT=${{ github.sha }}
    yarn build:full
```

### Version Tagging
```bash
# Tag releases with version
git tag v1.0.0
git push origin v1.0.0

# Build with tag information
GIT_COMMIT=$(git rev-parse HEAD) yarn build:full
```

The versioning system ensures you can always identify which version of the API Spawner tool you're using and provides detailed information about the build environment and recent updates. 