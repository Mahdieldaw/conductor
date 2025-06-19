Hybrid Thinking OS - Development Quickstart

This guide provides the essential steps to get the full Hybrid Thinking OS development environment running, including the Web App Control Panel and the Sidecar Browser Extension.

Prerequisites

Node.js (v18 or higher)

pnpm (v9.1.0 or higher)

A Chromium-based browser like Google Chrome, Brave, or Arc.

🚀 One-Time Setup

You only need to do these steps the very first time you set up the project.

1. Install Dependencies

Navigate to the project's root directory in your terminal and run:

Generated bash
pnpm install


This will install all the necessary packages for the entire monorepo.

2. Perform an Initial Build

Before loading the extension, you need to build it at least once.

Generated bash
pnpm --filter sidecar-extension build
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

This creates the packages/sidecar-extension/dist folder, which contains the final extension code.

3. Load the Extension in Your Browser

Open your browser and navigate to the extensions page. The address is usually chrome://extensions.

Enable "Developer mode" using the toggle switch, typically found in the top-right corner.

Click the "Load unpacked" button.

A file dialog will open. Navigate to this project's folder and select the packages/sidecar-extension/dist directory.

The "Hybrid Thinking OS Sidecar" extension should now appear in your list of extensions. Make sure it is enabled.

🔥 Daily Development Workflow

This is the only command you need to run each time you want to work on the project.

Start the Development Servers

From the project's root directory, run the following single command:

Generated bash
pnpm dev
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

This command will:

Start the Web App Control Panel on http://localhost:5173.

Start the Sidecar Extension in "watch mode", automatically rebuilding it whenever you save a file.

Your Workflow Loop

Open the Control Panel: Navigate to http://localhost:5173 in your browser.

The first time you open it, it will ask for the Extension ID. You can find this on your chrome://extensions page. Paste it in to connect the two parts of the system.

Open LLM Tabs: Open tabs for ChatGPT (chat.openai.com) and/or Claude (claude.ai).

Code and Test:

Changing Web App code: When you save a file in packages/web-app, the browser tab at localhost:5173 will automatically update (hot reload).

Changing Extension code: When you save a file in packages/sidecar-extension, the pnpm dev process will automatically rebuild it. You must then go to your chrome://extensions page and click the "Reload" icon (a circular arrow) on the Hybrid Thinking OS Sidecar to make the browser use the new version. After reloading, refresh your LLM tabs.