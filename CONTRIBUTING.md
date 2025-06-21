# Contributing to Hybrid Thinking OS

First off, thank you for considering contributing to this project! It's people like you that make open source such a great community.

## Project Overview

Hybrid Thinking OS is a monorepo containing multiple packages that work together to create a powerful AI workflow system:

- **Web App** (`packages/web-app/`): The main control panel where users define and manage AI workflows
- **Sidecar Extension** (`packages/sidecar-extension/`): Browser extension that executes workflows on live LLM websites
- **Shared Messaging** (`packages/shared-messaging/`): Common message types for inter-component communication
- **Shared Workflows** (`packages/shared-workflows/`): Predefined workflow templates

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- pnpm package manager
- Chrome browser (for extension development)

### Setup
1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build shared packages: `pnpm build`
4. Start development servers as needed

## Package-Specific Contribution Guidelines

Each package has its own detailed contribution guidelines:

- **Sidecar Extension**: See `packages/sidecar-extension/CONTRIBUTING.md` for detailed architecture documentation and development guidelines
- **Web App**: See `packages/web-app/README.md` for UI development guidelines
- **Shared Messaging**: See `packages/shared-messaging/README.md` for message type definitions
- **Shared Workflows**: See `packages/shared-workflows/README.md` for workflow template guidelines

## General Development Workflow

1. **Choose Your Package**: Identify which package your contribution affects
2. **Read Package Documentation**: Review the specific package's README and CONTRIBUTING files
3. **Create Feature Branch**: `git checkout -b feature/your-feature-name`
4. **Make Changes**: Follow the package-specific guidelines
5. **Test**: Run tests and verify functionality across affected packages
6. **Submit PR**: Create a pull request with clear description of changes

## Cross-Package Changes

When making changes that affect multiple packages:

1. **Shared Messaging**: Update message types in `packages/shared-messaging/` first
2. **Extension**: Update handlers in `packages/sidecar-extension/`
3. **Web App**: Update UI components in `packages/web-app/`
4. **Test Integration**: Verify end-to-end functionality

## Code Style and Standards

- Use TypeScript where applicable
- Follow ESLint configurations in each package
- Write meaningful commit messages
- Add tests for new functionality
- Update documentation as needed

## Questions and Support

For questions about specific packages, refer to their individual documentation. For general project questions, open an issue in the main repository.