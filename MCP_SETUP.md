# MCP (Model Context Protocol) Setup

This project is configured to use MCP servers to enhance GitHub Copilot's understanding of the codebase.

## What is MCP?

Model Context Protocol (MCP) allows AI assistants like GitHub Copilot to access additional context about your project, including:
- File system structure and contents
- Git history and changes
- Project-specific information

## Installation

### 1. Install Required Packages

```bash
npm install -g @modelcontextprotocol/server-filesystem @modelcontextprotocol/server-everything
```

### 2. Install VS Code Extension

The `automatalabs.copilot-mcp` extension should already be installed in VS Code.

### 3. Configure VS Code Settings

Copy `.vscode/settings.example.json` to `.vscode/settings.json` and modify as needed:

```bash
cp .vscode/settings.example.json .vscode/settings.json
```

## Configuration

The MCP servers are configured to provide:

### Filesystem Server
- **Purpose:** Gives Copilot access to project file structure
- **Scope:** Limited to the workspace folder for security
- **Features:** File reading, directory listing, file searching

### Everything Server  
- **Purpose:** Comprehensive project context including git history
- **Scope:** Full project awareness
- **Features:** Git integration, enhanced file context, project metadata

## Security Notes

- MCP servers are scoped to the project directory only
- No external network access is provided to the servers
- All file access is read-only through MCP
- Local `.vscode/settings.json` is git-ignored for privacy

## Benefits for This Project

With MCP enabled, GitHub Copilot will have better understanding of:

1. **Project Structure:**
   - Next.js pages and API routes
   - Component relationships
   - Configuration files

2. **iTEKAD Context:**
   - Mentor reporting workflows
   - Data structure patterns
   - Form validation rules

3. **Integration Patterns:**
   - Google Sheets API usage
   - Apps Script connections
   - File upload workflows

4. **Historical Context:**
   - Git commit history
   - Code evolution patterns
   - Previous implementation decisions

## Troubleshooting

If MCP servers are not working:

1. Verify packages are installed globally:
   ```bash
   npm list -g @modelcontextprotocol/server-filesystem @modelcontextprotocol/server-everything
   ```

2. Check VS Code settings are properly configured
3. Restart VS Code after configuration changes
4. Ensure GitHub Copilot extension is enabled and authenticated

## Usage

Once configured, GitHub Copilot will automatically use enhanced context when:
- Writing code suggestions
- Answering questions about the project
- Providing explanations about existing code
- Suggesting improvements or fixes

The enhanced context is particularly valuable for this mentor reporting tool because:
- Copilot understands the iTEKAD program structure
- It knows about the different report types (Bangkit vs Maju)
- It can suggest consistent patterns across similar forms
- It understands the Google Sheets integration patterns
