# Contributing to Sidecar Extension

This document provides guidelines for contributing to the Sidecar Extension component of the Hybrid Thinking OS project.

## Architecture Overview

The Sidecar Extension has been refactored into a clean, modular architecture that separates concerns and makes the codebase easier to maintain and extend.

### Directory Structure

```
src/background/
├── core/                    # Core infrastructure components
│   ├── message-router.js    # Central message routing system
│   ├── error-handler.js     # Global error handling
│   └── middleware.js        # Middleware system (logging, metrics, validation)
├── domains/                 # Business logic organized by domain
│   ├── prompt/             # Prompt execution and management
│   ├── readiness/          # System readiness and recovery
│   ├── session/            # Session management
│   └── system/             # System utilities and health checks
└── utils/                  # Shared utility functions
    ├── tab-finder.js       # Tab discovery utilities
    ├── tab-manager.js      # Tab lifecycle management
    └── tab-session-manager.js # Session-aware tab management
```

### Core Components

#### Message Router (`core/message-router.js`)
The central hub that routes incoming messages to appropriate domain handlers. It supports:
- Middleware pipeline execution
- Error handling integration
- Async message processing
- Request context management

#### Middleware System (`core/middleware.js`)
Provides cross-cutting concerns through a composable middleware pipeline:
- **Logging Middleware**: Request/response logging with timing
- **Metrics Middleware**: Performance and usage metrics collection
- **Validation Middleware**: Message structure and payload validation

#### Error Handler (`core/error-handler.js`)
Centralized error handling with consistent error formatting and logging.

### Domain Organization

Each domain is a self-contained module that handles a specific area of functionality:

- **Prompt Domain**: Handles prompt execution, broadcasting, and response harvesting
- **Readiness Domain**: Manages system readiness checks and recovery procedures
- **Session Domain**: Handles session lifecycle and state management
- **System Domain**: Provides system utilities like ping and tab enumeration

## Development Guidelines

### Adding a New Message Handler

1. **Identify the Domain**: Determine which domain your new handler belongs to, or create a new domain if needed.

2. **Create the Handler Function**: Add your handler to the appropriate domain directory:

```javascript
// domains/your-domain/your-handler.js
export async function yourHandler(context) {
  const { message, sender } = context;
  
  // Your implementation here
  
  return {
    success: true,
    data: result
  };
}
```

3. **Export from Domain Index**: Add your handler to the domain's `index.js`:

```javascript
// domains/your-domain/index.js
export { yourHandler } from './your-handler.js';
```

4. **Register in Service Worker**: Add the message type and handler to the router configuration:

```javascript
// service-worker.js
import { YOUR_MESSAGE_TYPE } from '@hybrid-thinking/messaging';
import * as yourDomain from './domains/your-domain/index.js';

const router = createMessageRouter({
  // ... existing handlers
  [YOUR_MESSAGE_TYPE]: yourDomain.yourHandler
}, {
  middleware: [loggingMiddleware, metricsMiddleware, validationMiddleware],
  errorHandler: handleError
});
```

### Adding a New Domain

1. **Create Domain Directory**: Create a new directory under `domains/`:

```
domains/new-domain/
├── index.js          # Export all handlers
├── handler1.js       # Individual handler files
├── handler2.js
└── utils.js          # Domain-specific utilities (optional)
```

2. **Implement Domain Handlers**: Follow the handler pattern shown above.

3. **Create Domain Index**: Export all handlers from the domain's `index.js`:

```javascript
// domains/new-domain/index.js
export { handler1 } from './handler1.js';
export { handler2 } from './handler2.js';
```

4. **Import and Register**: Import the domain in the service worker and register its handlers.

### Adding Custom Middleware

1. **Create Middleware Function**: Add your middleware to `core/middleware.js`:

```javascript
export async function yourMiddleware(context, next, config = {}) {
  // Pre-processing
  console.log('Before handler execution');
  
  try {
    const result = await next();
    
    // Post-processing on success
    console.log('Handler succeeded');
    
    return result;
  } catch (error) {
    // Error handling
    console.error('Handler failed:', error);
    throw error;
  }
}
```

2. **Register Middleware**: Add it to the middleware array in the service worker:

```javascript
const router = createMessageRouter(handlers, {
  middleware: [loggingMiddleware, metricsMiddleware, validationMiddleware, yourMiddleware],
  errorHandler: handleError
});
```

### Utility Functions

Shared utilities should be placed in the `utils/` directory. These are typically:
- Tab management functions
- Common data transformations
- Shared validation logic
- Helper functions used across multiple domains

### Error Handling Best Practices

1. **Use Descriptive Error Messages**: Include context about what operation failed and why.

2. **Throw Appropriate Error Types**: Use standard Error objects or create custom error classes.

3. **Let the Error Handler Handle It**: Don't catch errors unless you can meaningfully recover. Let them bubble up to the central error handler.

4. **Log Context**: Include relevant context in error logs to aid debugging.

### Testing Guidelines

1. **Unit Tests**: Test individual handlers and utilities in isolation.

2. **Integration Tests**: Test the message routing and middleware pipeline.

3. **End-to-End Tests**: Test complete workflows from the web app through the extension.

4. **Mock External Dependencies**: Use mocks for Chrome APIs and external services.

### Code Style

1. **Use ES6+ Features**: Leverage modern JavaScript features like async/await, destructuring, and modules.

2. **Consistent Naming**: Use camelCase for functions and variables, PascalCase for classes.

3. **Document Complex Logic**: Add comments for non-obvious business logic.

4. **Keep Functions Small**: Aim for single-responsibility functions that are easy to test and understand.

### Performance Considerations

1. **Minimize Message Payload**: Keep message payloads as small as possible.

2. **Use Efficient Tab Queries**: Leverage the tab utilities for efficient tab management.

3. **Avoid Blocking Operations**: Use async/await for all potentially blocking operations.

4. **Monitor Metrics**: Use the metrics middleware to track performance and identify bottlenecks.

## Debugging

1. **Enable Detailed Logging**: The logging middleware provides detailed request/response logging.

2. **Use Chrome DevTools**: Access the service worker console through Chrome's extension developer tools.

3. **Check Metrics**: Monitor the metrics output for performance issues.

4. **Validate Messages**: The validation middleware will catch malformed messages early.

## Future Enhancements

The current architecture is designed to support future enhancements such as:
- Plugin system for custom domains
- Advanced metrics collection and reporting
- Message queuing and retry mechanisms
- Enhanced validation with JSON Schema
- Performance monitoring and alerting

When implementing new features, consider how they fit into the existing architecture and whether they require new domains, middleware, or utilities.