# @hybrid-thinking/messaging

Shared message types and constants for communication between the Hybrid Thinking OS components.

## Overview

This package defines the standardized message types used for communication between:
- Web App (Control Panel)
- Sidecar Extension (Background Service Worker)
- Content Scripts (Browser Page Interaction)

## Message Types

### System Messages
- `HEALTH_CHECK`: Basic connectivity and status verification
- `GET_TABS`: Retrieve information about browser tabs
- `FOCUS_TAB`: Switch focus to a specific browser tab

### Session Management
- `CREATE_SESSION`: Initialize a new AI session
- `GET_SESSION`: Retrieve session information
- `UPDATE_SESSION`: Modify session parameters
- `DELETE_SESSION`: Remove a session

### Prompt Operations
- `SEND_PROMPT`: Send a prompt to an AI provider
- `GET_RESPONSE`: Retrieve AI response
- `STREAM_RESPONSE`: Handle streaming AI responses
- `STREAM_DONE`: Indicates a network stream harvest has completed
- `DOM_HARVEST_DONE`: Indicates a DOM fallback harvest has completed
- `PROMPT_ERROR`: Propagates an error from the content script during execution

### Workflow Execution
- `EXECUTE_WORKFLOW`: Run a multi-step AI workflow
- `WORKFLOW_STATUS`: Check workflow execution status
- `WORKFLOW_RESULT`: Retrieve workflow results

## Usage

### Installation
```bash
pnpm add @hybrid-thinking/messaging
```

### Import Message Types
```javascript
import {
  HEALTH_CHECK,
  CREATE_SESSION,
  SEND_PROMPT,
  EXECUTE_WORKFLOW
} from '@hybrid-thinking/messaging';
```

### Message Structure

All messages follow a consistent structure:
```javascript
{
  type: 'MESSAGE_TYPE',
  payload: {
    // Message-specific data
  },
  metadata: {
    timestamp: Date.now(),
    source: 'web-app|extension|content-script',
    requestId: 'unique-identifier'
  }
}
```

## Adding New Message Types

1. **Define the constant** in `index.js`:
   ```javascript
   export const NEW_MESSAGE_TYPE = 'domain/newMessageType';
   ```

2. **Follow naming convention**:
   - Use `SCREAMING_SNAKE_CASE` for constants
   - Use `domain/camelCase` for values
   - Group related messages by domain (system, session, prompt, workflow)

3. **Update documentation** in this README

4. **Add TypeScript types** (if applicable):
   ```typescript
   export interface NewMessagePayload {
     // Define payload structure
   }
   ```

## Message Domains

### System Domain (`system/*`)
Core functionality and health checks

### Session Domain (`session/*`)
AI session lifecycle management

### Prompt Domain (`prompt/*`)
Direct AI interaction and response handling

### Workflow Domain (`workflow/*`)
Multi-step AI workflow execution

## Best Practices

1. **Consistent Naming**: Follow the established naming patterns
2. **Clear Payloads**: Define clear, typed payload structures
3. **Error Handling**: Include error message types for each operation
4. **Versioning**: Consider message versioning for breaking changes
5. **Documentation**: Update this README when adding new message types

## Development

### Building
```bash
pnpm build
```

### Testing
```bash
pnpm test
```

### Linting
```bash
pnpm lint
```

## Contributing

See the main project's `CONTRIBUTING.md` for general guidelines. When adding new message types:

1. Ensure they follow the established patterns
2. Add appropriate documentation
3. Consider backward compatibility
4. Test across all consuming packages