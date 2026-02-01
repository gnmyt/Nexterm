# 📋 Scripting Variables & Directives

Nexterm provides a set of special directives that allow you to create interactive, user-friendly scripts with structured input, feedback, and progress tracking. These directives enhance the script execution experience by providing clear communication and data collection from users.

## Overview

Scripting directives are special annotations prefixed with `@NEXTERM:` that you can embed in your scripts to control the user interface and workflow. They enable you to:

- Guide users through step-by-step processes
- Collect user input with validation
- Provide real-time feedback and status updates
- Track progress visually
- Display structured information

## Available Directives

### `@NEXTERM:STEP`

Marks a logical step in your script workflow and displays it in the UI.

**Purpose:** Breaks down complex scripts into clear, numbered steps that help users understand the script's flow and their progress.

**Usage:**
```sh
@NEXTERM:STEP "Step description"
```

**Example:**
```sh
@NEXTERM:STEP "Installing dependencies"
npm install

@NEXTERM:STEP "Building the application"
npm run build

@NEXTERM:STEP "Running tests"
npm test
```

**Design Pattern:** Used to create a visual roadmap of the script execution, making it clear what's happening at each stage.

---

### `@NEXTERM:INPUT`

Prompts the user to enter a value with an optional default value.

**Purpose:** Collect user-provided data with a default fallback to streamline user interactions.

**Usage:**
```sh
@NEXTERM:INPUT "Enter value" "default"
```

**Parameters:**
- `"Enter value"` - The prompt message displayed to the user
- `"default"` - (Optional) The default value if the user doesn't provide input

**Example:**
```sh
@NEXTERM:INPUT "Enter the database host" "localhost"
@NEXTERM:INPUT "Enter the database port" "5432"
@NEXTERM:INPUT "Enter the API key" ""
```

**Design Pattern:** Enables dynamic script execution by allowing users to customize behavior without editing the script. Defaults reduce required input for common scenarios.

---

### `@NEXTERM:SELECT`

Presents the user with multiple choice options and captures their selection.

**Purpose:** Restrict user input to predefined options, reducing errors and clarifying available choices.

**Usage:**
```sh
@NEXTERM:SELECT "Select option" "Option 1" "Option 2" "Option 3"
```

**Parameters:**
- First parameter: The prompt message
- Remaining parameters: The available options to choose from

**Example:**
```sh
@NEXTERM:SELECT "Select deployment environment" "Development" "Staging" "Production"
@NEXTERM:SELECT "Choose backup type" "Full" "Incremental" "Differential"
@NEXTERM:SELECT "Select database version" "PostgreSQL 12" "PostgreSQL 13" "PostgreSQL 14"
```

**Design Pattern:** Enforces validation at the input level by limiting choices to safe, predefined options. Improves user experience by clearly showing available alternatives.

---

### `@NEXTERM:CONFIRM`

Requires the user to confirm an action before proceeding, typically for critical operations.

**Purpose:** Prevent accidental execution of destructive or important operations by requiring explicit user confirmation.

**Usage:**
```sh
@NEXTERM:CONFIRM "Are you sure you want to continue?"
```

**Example:**
```sh
@NEXTERM:STEP "Preparing to delete database"
@NEXTERM:CONFIRM "Are you sure you want to delete the entire database? This cannot be undone."
rm -rf /var/lib/postgresql/data
```

**Design Pattern:** Acts as a safety guard for critical operations (deletions, deployments to production, etc.). Blocks execution until user explicitly acknowledges the action.

---

### `@NEXTERM:INFO`

Displays an informational message to the user without blocking execution.

**Purpose:** Communicate important information, instructions, or context to the user during script execution.

**Usage:**
```sh
@NEXTERM:INFO "Information message"
```

**Example:**
```sh
@NEXTERM:INFO "Docker is not installed. Installing Docker now..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

@NEXTERM:INFO "Configuration will be applied after the service restarts."
systemctl restart myservice
```

**Design Pattern:** Keeps users informed about what's happening without requiring interaction. Improves transparency and helps users understand the script's workflow.

---

### `@NEXTERM:SUCCESS`

Displays a success message indicating successful completion of a task or milestone.

**Purpose:** Provide positive feedback and confirmation that an operation completed successfully.

**Usage:**
```sh
@NEXTERM:SUCCESS "Operation completed successfully!"
```

**Example:**
```sh
@NEXTERM:STEP "Deploying application"
docker pull myapp:latest
docker run -d myapp:latest
@NEXTERM:SUCCESS "Application deployed successfully!"

@NEXTERM:STEP "Running health checks"
curl http://localhost:8080/health
@NEXTERM:SUCCESS "All health checks passed!"
```

**Design Pattern:** Provides clear feedback that a task succeeded, improving user confidence and allowing them to understand which operations completed successfully.

---

### `@NEXTERM:WARN`

Displays a warning message alerting the user to potential issues or important considerations.

**Purpose:** Alert users about non-critical issues that may affect operation but allow execution to continue.

**Usage:**
```sh
@NEXTERM:WARN "Warning: proceeding with caution"
```

**Example:**
```sh
@NEXTERM:STEP "Updating production configuration"
@NEXTERM:WARN "Warning: You are modifying production configuration. Ensure you have a backup."
cp config.prod.yml config.prod.yml.backup
sed -i 's/old_value/new_value/g' config.prod.yml

@NEXTERM:WARN "Warning: This operation requires manual verification in the admin panel."
```

**Design Pattern:** Brings attention to situations that may need user awareness or intervention, without blocking execution. Helps users understand potential consequences of their actions.

---

### `@NEXTERM:ERROR`

Displays an error message indicating that something has gone wrong.

**Purpose:** Communicate failures, misconfigurations, or other error conditions to the user.

**Usage:**
```sh
@NEXTERM:ERROR "Error occurred"
```

**Example:**
```sh
@NEXTERM:STEP "Verifying prerequisites"
if ! command -v docker &> /dev/null; then
    @NEXTERM:ERROR "Docker is not installed. Please install Docker before proceeding."
    exit 1
fi
@NEXTERM:SUCCESS "All prerequisites verified"

@NEXTERM:STEP "Connecting to database"
if ! psql -h localhost -U user -d mydb -c "SELECT 1" &> /dev/null; then
    @NEXTERM:ERROR "Failed to connect to database. Check your connection parameters."
    exit 1
fi
```

**Design Pattern:** Clearly marks failure points, helping users quickly identify what went wrong and where they need to take action.

---

### `@NEXTERM:PROGRESS`

Updates a progress indicator showing the completion percentage of an operation.

**Purpose:** Provide visual feedback during long-running operations, showing the user progress without blocking.

**Usage:**
```sh
@NEXTERM:PROGRESS 50
```

**Parameters:**
- A number from `0` to `100` representing the percentage completed

**Example:**
```sh
@NEXTERM:STEP "Processing large file"
total_lines=$(wc -l < input.txt)

@NEXTERM:PROGRESS 0
processed=0
while IFS= read -r line; do
    # Process each line
    process_line "$line"
    ((processed++))
    percentage=$((processed * 100 / total_lines))
    @NEXTERM:PROGRESS "$percentage"
done < input.txt

@NEXTERM:PROGRESS 100
@NEXTERM:SUCCESS "File processed successfully"
```

**Design Pattern:** Keeps users informed during lengthy operations, preventing the perception of a frozen interface and allowing users to estimate remaining time.

---

### `@NEXTERM:SUMMARY`

Displays a structured summary of results with key-value pairs.

**Purpose:** Present comprehensive results or information in an organized, readable format at the end of a script execution.

**Usage:**
```sh
@NEXTERM:SUMMARY "Summary Title" "Key 1" "Value 1" "Key 2" "Value 2"
```

**Parameters:**
- First parameter: The summary title/heading
- Alternating key-value pairs: Information to display

**Example:**
```sh
@NEXTERM:STEP "Gathering server statistics"
uptime_value=$(uptime)
memory_value=$(free -h | grep Mem | awk '{print $2}')
disk_value=$(df -h / | awk 'NR==2 {print $2}')
cpu_value=$(nproc)

@NEXTERM:SUMMARY "Server Information" \
    "Uptime" "$uptime_value" \
    "Total Memory" "$memory_value" \
    "Total Disk" "$disk_value" \
    "CPU Cores" "$cpu_value"

@NEXTERM:STEP "Backup completed"
@NEXTERM:SUMMARY "Backup Results" \
    "Backup Size" "2.5GB" \
    "Files Backed Up" "15,847" \
    "Backup Location" "/backups/2024-01-20" \
    "Duration" "45 minutes"
```

**Design Pattern:** Presents information in a clean, structured format making it easy for users to digest and reference results. Ideal for displaying final statistics, configuration details, or operation summaries.




---

## Design Principles

### 1. **Clarity and Guidance**
Directives provide clear navigation through script execution with `@NEXTERM:STEP` helping users understand where they are in the process.

### 2. **User Engagement**
Interactive directives like `@NEXTERM:INPUT`, `@NEXTERM:SELECT`, and `@NEXTERM:CONFIRM` keep users involved and allow customization.

### 3. **Feedback and Status**
Real-time feedback through `@NEXTERM:INFO`, `@NEXTERM:SUCCESS`, `@NEXTERM:WARN`, and `@NEXTERM:ERROR` keeps users informed about script progress and status.

### 4. **Safety**
The `@NEXTERM:CONFIRM` directive prevents accidental execution of critical operations.

### 5. **Progress Visibility**
The `@NEXTERM:PROGRESS` directive provides visual feedback during long operations, improving perceived performance.

### 6. **Structured Results**
The `@NEXTERM:SUMMARY` directive presents comprehensive results in an organized, easy-to-read format.

---

## Best Practices

1. **Use Steps Logically** - Break scripts into meaningful steps that represent distinct phases of work.

2. **Provide Defaults** - Always offer sensible defaults in `@NEXTERM:INPUT` to reduce required user interaction.

3. **Confirm Critical Operations** - Use `@NEXTERM:CONFIRM` for operations that modify, delete, or deploy to production.

4. **Inform Users** - Use `@NEXTERM:INFO` to explain what's happening, especially during long operations.

5. **Validate Input** - Use `@NEXTERM:SELECT` instead of free-text input when possible to prevent errors.

6. **Progressive Feedback** - Update `@NEXTERM:PROGRESS` frequently to show activity during long operations.

7. **Clear Error Messages** - Use `@NEXTERM:ERROR` with actionable information about what went wrong and how to fix it.

8. **Summarize Results** - Always end important scripts with `@NEXTERM:SUMMARY` showing key results and completion details.

---

## Related Documentation

- [Scripts & Snippets](./scripts&snippets.md) - Learn how to create and organize scripts and snippets in Nexterm.
