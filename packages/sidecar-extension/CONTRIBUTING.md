# Contributing to Sidecar Extension

This document provides guidelines for contributing to the Sidecar Extension component of the Hybrid Thinking OS project.

## Architecture Overview (Unified Sidecar v2.0)

The Sidecar Extension is built on a resilient, configuration-driven architecture designed for stability and extensibility.

### Directory Structure

```
src/
├── background/
│   ├── core/                # Core operational logic
│   │   ├── TabPool.js       # Manages the lifecycle of provider tabs
│   │   ├── FlightManager.js # Tracks in-flight requests
│   │   └── ...
│   ├── services/            # High-level services (e.g., prompt execution)
│   └── ...
├── content-scripts/         # Scripts injected into provider pages
│   ├── harvester.js         # DOM and network data harvesting
│   └── ...
├── providers/               # Configuration files for each LLM provider
│   ├── chatgpt.json
│   └── claude.json
└── utils/                   # Shared utility functions
```

### Core Components

#### TabPool (`background/core/TabPool.js`)
The `TabPool` is the backbone of resource management. It is responsible for:
- **Creating and Reusing Tabs**: Efficiently manages a pool of provider tabs to avoid unnecessary creation.
- **Health Checks**: Actively monitors tab health and recycles unresponsive or crashed tabs.
- **Leasing**: Provides a mechanism to lease a healthy, ready tab for a specific operation.

#### FlightManager (`background/core/FlightManager.js`)
The `FlightManager` tracks every request from initiation to completion. It:
- **Manages State**: Keeps track of the status of each "flight" (request).
- **Handles Concurrency**: Prevents race conditions and ensures requests are processed in an orderly fashion.
- **Orchestrates Timeouts**: Manages request timeouts to prevent indefinite hangs.

#### Configuration-Driven Providers (`providers/`)
All provider-specific logic (CSS selectors, URLs, feature flags) is externalized into JSON configuration files. This allows for:
- **Easy Updates**: Provider changes can be made without altering core application code.
- **Extensibility**: Adding a new provider is as simple as creating a new JSON configuration file.

### Data Harvesting (`content-scripts/harvester.js`)
The harvesting mechanism is a hybrid system designed for both speed and reliability:
- **Network Sniffing**: It first attempts to capture results by intercepting network stream responses, which is extremely fast.
- **DOM Observation**: If network sniffing fails or is not applicable, it falls back to a reliable DOM observer that watches for changes on the page.
- **Promise.race**: These two methods are run in a `Promise.race` to ensure the fastest possible result retrieval.

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