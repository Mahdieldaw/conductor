# @hybrid-thinking/shared-workflows

Predefined workflow templates for the Hybrid Thinking OS system.

## Overview

This package contains JSON-based workflow templates that define multi-step AI interactions. These workflows can be executed by the Sidecar Extension to orchestrate complex AI tasks across multiple providers and steps.

## Available Workflows

### Default Create (`default-create.json`)
A comprehensive workflow for synthesizing responses from multiple AI providers:

- **Purpose**: Generate well-rounded responses by leveraging multiple AI models
- **Steps**: 
  1. Send prompt to ChatGPT
  2. Send prompt to Claude
  3. Synthesize responses into a final output
- **Use Cases**: Research, analysis, creative writing, problem-solving

### Summarize and Refine (`summarize-and-refine.json`)
A workflow for iterative content improvement:

- **Purpose**: Create, summarize, and refine content through multiple iterations
- **Steps**:
  1. Generate initial content
  2. Summarize key points
  3. Refine and improve based on summary
- **Use Cases**: Document creation, content optimization, iterative improvement

## Workflow Structure

Each workflow is defined as a JSON file with the following structure:

```json
{
  "name": "Workflow Name",
  "description": "Brief description of the workflow",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step-1",
      "name": "Step Name",
      "type": "prompt|synthesis|analysis",
      "provider": "chatgpt|claude|custom",
      "prompt": "The prompt template",
      "dependencies": ["previous-step-id"],
      "outputVariable": "variableName"
    }
  ],
  "variables": {
    "inputVariable": "default value"
  },
  "metadata": {
    "author": "Author Name",
    "tags": ["tag1", "tag2"],
    "estimatedDuration": "2-3 minutes"
  }
}
```

## Step Types

### Prompt Steps
- **Type**: `prompt`
- **Purpose**: Send a prompt to an AI provider
- **Required Fields**: `provider`, `prompt`
- **Output**: AI response text

### Synthesis Steps
- **Type**: `synthesis`
- **Purpose**: Combine outputs from multiple previous steps
- **Required Fields**: `dependencies`, `prompt`
- **Output**: Synthesized content

### Analysis Steps
- **Type**: `analysis`
- **Purpose**: Analyze and extract insights from previous outputs
- **Required Fields**: `dependencies`, `analysisType`
- **Output**: Analysis results

## Variable System

Workflows support dynamic variables that can be:

1. **Input Variables**: Provided when starting the workflow
2. **Step Outputs**: Results from previous steps
3. **System Variables**: Automatically provided (timestamp, user, etc.)

### Variable Usage
Use `{{variableName}}` syntax in prompts and templates:

```json
{
  "prompt": "Analyze the following text: {{inputText}}. Previous analysis: {{step-1.output}}"
}
```

## Creating Custom Workflows

### 1. Define the Workflow File
Create a new JSON file following the structure above:

```json
{
  "name": "My Custom Workflow",
  "description": "Description of what this workflow does",
  "version": "1.0.0",
  "steps": [
    // Define your steps here
  ]
}
```

### 2. Design the Steps
- Plan the logical flow of your workflow
- Define dependencies between steps
- Choose appropriate AI providers for each step
- Design prompts that work well with variable substitution

### 3. Test the Workflow
- Use the Web App to test your workflow
- Verify variable substitution works correctly
- Check that dependencies are resolved properly
- Validate the final output meets expectations

### 4. Add Metadata
- Include author information
- Add relevant tags for categorization
- Estimate execution duration
- Document any special requirements

## Best Practices

### Workflow Design
1. **Clear Naming**: Use descriptive names for workflows and steps
2. **Logical Flow**: Ensure steps follow a logical sequence
3. **Error Handling**: Consider what happens if a step fails
4. **Modularity**: Design reusable steps when possible

### Prompt Engineering
1. **Clear Instructions**: Write clear, specific prompts
2. **Context Awareness**: Include relevant context from previous steps
3. **Output Format**: Specify desired output format when needed
4. **Variable Usage**: Use variables effectively for dynamic content

### Performance
1. **Parallel Execution**: Design independent steps to run in parallel
2. **Minimal Dependencies**: Avoid unnecessary step dependencies
3. **Efficient Prompts**: Write concise but effective prompts
4. **Provider Selection**: Choose the best AI provider for each task

## Usage in Applications

### Web App Integration
```javascript
import workflow from '@hybrid-thinking/shared-workflows/default-create.json';

// Execute workflow
const result = await executeWorkflow(workflow, {
  inputText: 'Your input here'
});
```

### Extension Integration
```javascript
// Load workflow
const workflow = await loadWorkflow('default-create');

// Execute with variables
const execution = await workflowEngine.execute(workflow, variables);
```

## Contributing

When contributing new workflows:

1. **Follow Structure**: Use the established JSON structure
2. **Test Thoroughly**: Verify the workflow works as expected
3. **Document Well**: Include clear descriptions and metadata
4. **Consider Reusability**: Design workflows that others can adapt
5. **Update README**: Add your workflow to the available workflows list

### Workflow Naming
- Use kebab-case for file names (`my-workflow.json`)
- Use descriptive names that indicate the workflow's purpose
- Avoid overly generic names

### Version Management
- Start new workflows at version `1.0.0`
- Increment version for breaking changes
- Document changes in workflow metadata

## Development

### Validation
Workflows are validated against a JSON schema to ensure correctness.

### Testing
```bash
pnpm test
```

### Linting
```bash
pnpm lint
```

For more information, see the main project's `CONTRIBUTING.md`.