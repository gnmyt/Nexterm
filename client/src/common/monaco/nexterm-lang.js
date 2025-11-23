export const registerNextermLanguage = (monaco) => {
    const isRegistered = monaco.languages.getLanguages().some(lang => lang.id === "nexterm");
    if (!isRegistered) {
        monaco.languages.register({ id: "nexterm" });
    }

    monaco.languages.setLanguageConfiguration("nexterm", {
        comments: {
            lineComment: "#",
            blockComment: [": <<'COMMENT'", "COMMENT"],
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"],
        ],
        autoClosingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: "\"", close: "\"", notIn: ["string", "comment"] },
            { open: "'", close: "'", notIn: ["string", "comment"] },
            { open: "`", close: "`", notIn: ["string", "comment"] },
        ],
        surroundingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: "\"", close: "\"" },
            { open: "'", close: "'" },
            { open: "`", close: "`" },
        ],
        folding: {
            markers: {
                start: new RegExp("^\\s*#\\s*region\\b"),
                end: new RegExp("^\\s*#\\s*endregion\\b"),
            },
            offSide: true,
        },
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
        indentationRules: {
            increaseIndentPattern: /^.*(then|do|else|\{|\()$/,
            decreaseIndentPattern: /^.*(fi|done|esac|\}|\))$/,
        },
        onEnterRules: [
            {
                beforeText: /^\s*(if|then|else|elif|for|while|until|case|do|function|\{)\s*$/,
                action: { indentAction: monaco.languages.IndentAction.Indent },
            },
        ],
    });

    monaco.languages.setMonarchTokensProvider("nexterm", {
        defaultToken: "",
        tokenPostfix: ".nexterm",
        ignoreCase: false,

        keywords: [
            "if", "then", "else", "elif", "fi",
            "case", "esac", "in",
            "for", "while", "until", "do", "done",
            "function", "return", "break", "continue",
            "local", "declare", "readonly", "export",
            "shift", "exit", "trap", "set", "unset",
        ],

        builtins: [
            "echo", "printf", "read", "cd", "pwd", "pushd", "popd",
            "ls", "cat", "grep", "sed", "awk", "find", "sort", "uniq",
            "head", "tail", "wc", "cut", "tr", "paste",
            "chmod", "chown", "chgrp", "mkdir", "rmdir", "rm", "mv", "cp", "ln", "touch",
            "tar", "gzip", "gunzip", "zip", "unzip",
            "wget", "curl", "ssh", "scp", "rsync",
            "git", "npm", "yarn", "node", "python", "pip", "docker",
            "apt", "apt-get", "yum", "dnf", "pacman", "brew",
            "systemctl", "service", "journalctl",
            "ps", "top", "htop", "kill", "killall", "pkill",
            "test", "source", "alias", "which", "whereis", "type",
            "true", "false", "sleep", "wait", "exec", "eval",
        ],

        nextermCommands: [
            "STEP", "INPUT", "SELECT", "CONFIRM",
            "INFO", "SUCCESS", "WARN", "ERROR",
            "PROGRESS", "SUMMARY", "TABLE", "MSGBOX",
        ],

        operators: [
            "&&", "||", "|", "&", ";", ";;",
            ">", ">>", "<", "<<", "<<<",
            "2>", "2>>", "&>", "&>>", "2>&1",
            "=", "==", "!=", "-eq", "-ne", "-lt", "-le", "-gt", "-ge",
            "-z", "-n", "-f", "-d", "-e", "-r", "-w", "-x",
        ],

        tokenizer: {
            root: [
                [/[ \t\r\n]+/, "white"],
                [/\\$/, "constant.character.escape"],

                [/@@NEXTERM:(STEP|INPUT|SELECT|CONFIRM|INFO|SUCCESS|WARN|ERROR|PROGRESS|SUMMARY|TABLE|MSGBOX)\b/, "keyword.control.nexterm"],
                [/@@NEXTERM:[A-Z]+/, "invalid.nexterm"],

                [/#.*$/, "comment"],

                [/\d+/, "number"],

                [/"([^"\\]|\\.)*$/, "string.invalid"], [/'([^'\\]|\\.)*$/, "string.invalid"], [/"/, "string", "string_double"],
                [/'/, "string", "string_single"],
                [/`/, "string.backtick", "string_backtick"],

                [/\$\{[A-Za-z_][A-Za-z0-9_]*\}/, "variable.other.bracket"],
                [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable.other"],
                [/\$[0-9]+/, "variable.parameter"],
                [/\$[*#?!$\-]/, "variable.special"],
                [/\$@@/, "variable.special"],

                [/[A-Z_][A-Z0-9_]*(?=\=)/, "variable.env"],

                [/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/, ["keyword", "entity.name.function"]],
                [/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)/, "entity.name.function"],

                [/\b(if|then|else|elif|fi|case|esac|for|while|until|do|done|in|function|return|break|continue|local|declare|readonly|export)\b/, "keyword"],

                [/\b(echo|printf|read|cd|pwd|ls|cat|grep|sed|awk|find|chmod|chown|mkdir|rm|mv|cp|tar|wget|curl|git|npm|docker|apt|apt-get|yum|systemctl|service|ps|kill|test|source|alias|which|true|false|sleep|wait|exec|eval)\b/, "support.function.builtin"],

                [/(&&|\|\||>>|<<|2>&1|&>|2>>|2>|&>>)/, "keyword.operator.logical"],
                [/[|&;<>()]/, "keyword.operator"],
                [/[\{\}\[\]]/, "delimiter.bracket"],

                [/\[{1,2}/, "keyword.operator.test", "test_expression"],

                [/[0-9]*(&)?>>?/, "keyword.operator.redirect"],

                [/[a-zA-Z_][\w.\-]*/, "identifier"],
            ],

            string_double: [
                [/\$\{[^\}]*\}/, "variable.other.bracket"],
                [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable.other"],
                [/\\./, "string.escape"],
                [/"/, "string", "@pop"],
                [/./, "string"],
            ],

            string_single: [
                [/'/, "string", "@pop"],
                [/./, "string"],
            ],

            string_backtick: [
                [/\$\{[^\}]*\}/, "variable.other.bracket"],
                [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable.other"],
                [/`/, "string.backtick", "@pop"],
                [/./, "string.backtick"],
            ],

            test_expression: [
                [/\]{1,2}/, "keyword.operator.test", "@pop"],
                [/-[a-z]+/, "keyword.operator.test"],
                [/"/, "string", "string_double"],
                [/'/, "string", "string_single"],
                [/\$\{[^\}]*\}/, "variable.other.bracket"],
                [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable.other"],
                [/./, "white"],
            ],
        },
    });

    monaco.editor.defineTheme("nexterm-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "keyword.control.nexterm", foreground: "FF6B9D", fontStyle: "bold" },
            { token: "invalid.nexterm", foreground: "FF0000", fontStyle: "bold underline" },

            { token: "variable.other", foreground: "4EC9B0", fontStyle: "italic" },
            { token: "variable.other.bracket", foreground: "4EC9B0", fontStyle: "bold italic" },
            { token: "variable.parameter", foreground: "9CDCFE" },
            { token: "variable.special", foreground: "C586C0" },
            { token: "variable.env", foreground: "FFA07A", fontStyle: "bold" },

            { token: "string", foreground: "CE9178" },
            { token: "string.escape", foreground: "D7BA7D" },
            { token: "string.backtick", foreground: "CE9178", fontStyle: "italic" },
            { token: "string.invalid", foreground: "FF0000", fontStyle: "underline" },

            { token: "number", foreground: "B5CEA8" },

            { token: "comment", foreground: "6A9955", fontStyle: "italic" },

            { token: "keyword", foreground: "C586C0", fontStyle: "bold" },
            { token: "support.function.builtin", foreground: "DCDCAA" },

            { token: "keyword.operator", foreground: "D4D4D4" },
            { token: "keyword.operator.logical", foreground: "C586C0" },
            { token: "keyword.operator.test", foreground: "569CD6" },
            { token: "keyword.operator.redirect", foreground: "569CD6" },

            { token: "entity.name.function", foreground: "DCDCAA", fontStyle: "bold" },

            { token: "delimiter.bracket", foreground: "FFD700" },
        ],
        colors: {
            "editor.background": "#1E1E1E",
            "editor.foreground": "#D4D4D4",
            "editorLineNumber.foreground": "#858585",
            "editorCursor.foreground": "#AEAFAD",
            "editor.selectionBackground": "#264F78",
            "editor.lineHighlightBackground": "#2A2A2A",
        },
    });

    monaco.editor.defineTheme("nexterm-light", {
        base: "vs",
        inherit: true,
        rules: [
            { token: "keyword.control.nexterm", foreground: "D73A49", fontStyle: "bold" },
            { token: "invalid.nexterm", foreground: "FF0000", fontStyle: "bold underline" },

            { token: "variable.other", foreground: "0070C1", fontStyle: "italic" },
            { token: "variable.other.bracket", foreground: "0070C1", fontStyle: "bold italic" },
            { token: "variable.parameter", foreground: "001080" },
            { token: "variable.special", foreground: "AF00DB" },
            { token: "variable.env", foreground: "E36209", fontStyle: "bold" },

            { token: "string", foreground: "A31515" },
            { token: "string.escape", foreground: "EE0000" },
            { token: "string.backtick", foreground: "A31515", fontStyle: "italic" },
            { token: "string.invalid", foreground: "FF0000", fontStyle: "underline" },

            { token: "number", foreground: "098658" },

            { token: "comment", foreground: "008000", fontStyle: "italic" },

            { token: "keyword", foreground: "0000FF", fontStyle: "bold" },
            { token: "support.function.builtin", foreground: "795E26" },

            { token: "keyword.operator", foreground: "000000" },
            { token: "keyword.operator.logical", foreground: "AF00DB" },
            { token: "keyword.operator.test", foreground: "0000FF" },
            { token: "keyword.operator.redirect", foreground: "0000FF" },

            { token: "entity.name.function", foreground: "795E26", fontStyle: "bold" },

            { token: "delimiter.bracket", foreground: "0431FA" },
        ],
        colors: {
            "editor.background": "#FFFFFF",
            "editor.foreground": "#000000",
            "editorLineNumber.foreground": "#237893",
            "editorCursor.foreground": "#000000",
            "editor.selectionBackground": "#ADD6FF",
            "editor.lineHighlightBackground": "#F0F0F0",
        },
    });

    const nextermCommands = [
        {
            label: "@NEXTERM:STEP",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Define a step in the script execution",
            documentation: {
                value: "**@NEXTERM:STEP** - Display a step indicator\n\nBreaks down the script into logical phases with a visual step indicator.\n\n**Syntax:**\n```bash\n@NEXTERM:STEP \"description\"\n```\n\n**Example:**\n```bash\n@NEXTERM:STEP \"Installing dependencies\"\napt-get update && apt-get install -y nginx\n\n@NEXTERM:STEP \"Configuring service\"\ncp /tmp/nginx.conf /etc/nginx/nginx.conf\n```\n\n**Use Cases:**\n- Multi-step installation processes\n- Complex deployment workflows\n- Progress tracking for long scripts",
            },
            insertText: "@NEXTERM:STEP \"${1:Step description}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "00_STEP",
            filterText: "@NEXTERM:STEP NEXTERM STEP",
        },
        {
            label: "@NEXTERM:INPUT",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Request user input and store in variable",
            documentation: {
                value: "**@NEXTERM:INPUT** - Prompt user for input\n\nDisplays an input dialog and stores the user's response in a variable.\n\n**Syntax:**\n```bash\n@NEXTERM:INPUT VARIABLE_NAME \"prompt\" \"default_value\"\n```\n\n**Example:**\n```bash\n@NEXTERM:INPUT USERNAME \"Enter your username\" \"admin\"\n@NEXTERM:INPUT PORT \"Enter port number\" \"8080\"\necho \"Deploying for $USERNAME on port $PORT\"\n```\n\n**Parameters:**\n- `VARIABLE_NAME`: Name of the variable (uppercase recommended)\n- `prompt`: Question or instruction for the user\n- `default_value`: Pre-filled default value (optional)\n\n**Notes:**\n- Variable is accessible as `$VARIABLE_NAME` in subsequent commands\n- Input is validated and trimmed automatically",
            },
            insertText: "@NEXTERM:INPUT ${1:VARIABLE_NAME} \"${2:Enter value}\" \"${3:default}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "01_INPUT",
            filterText: "@NEXTERM:INPUT NEXTERM INPUT",
        },
        {
            label: "@NEXTERM:SELECT",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Present selection menu with multiple options",
            documentation: {
                value: "**@NEXTERM:SELECT** - Display option selector\n\nPresents a list of options for the user to choose from.\n\n**Syntax:**\n```bash\n@NEXTERM:SELECT VARIABLE_NAME \"prompt\" \"option1\" \"option2\" \"option3\" ...\n```\n\n**Example:**\n```bash\n@NEXTERM:SELECT ENV \"Choose environment\" \"development\" \"staging\" \"production\"\n@NEXTERM:SELECT DB_TYPE \"Select database\" \"PostgreSQL\" \"MySQL\" \"MongoDB\"\necho \"Deploying to $ENV with $DB_TYPE\"\n```\n\n**Parameters:**\n- `VARIABLE_NAME`: Variable to store selected option\n- `prompt`: Question or instruction\n- `options`: Two or more options (space-separated, quoted strings)\n\n**Notes:**\n- First option is pre-selected by default\n- Selected value is stored exactly as displayed",
            },
            insertText: "@NEXTERM:SELECT ${1:CHOICE} \"${2:Select option}\" \"${3:Option 1}\" \"${4:Option 2}\" \"${5:Option 3}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "02_SELECT",
            filterText: "@NEXTERM:SELECT NEXTERM SELECT",
        },
        {
            label: "@NEXTERM:CONFIRM",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Ask for Yes/No confirmation",
            documentation: {
                value: "**@NEXTERM:CONFIRM** - Display confirmation dialog\n\nShows a Yes/No confirmation dialog. **Script exits with code 1 if user selects No.**\n\n**Syntax:**\n```bash\n@NEXTERM:CONFIRM \"question\"\n```\n\n**Example:**\n```bash\n@NEXTERM:CONFIRM \"Delete all files in /tmp directory?\"\nrm -rf /tmp/*\n\n@NEXTERM:CONFIRM \"This will restart the server. Continue?\"\nsystemctl restart nginx\n```\n\n**Behavior:**\n- Clicking \"Yes\" → Script continues\n- Clicking \"No\" → Script exits immediately with exit code 1\n\n**Best Practices:**\n- Use before destructive operations\n- Make question clear and specific\n- Explain consequences in the question",
            },
            insertText: "@NEXTERM:CONFIRM \"${1:Are you sure you want to continue?}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "03_CONFIRM",
            filterText: "@NEXTERM:CONFIRM NEXTERM CONFIRM",
        },
        {
            label: "@NEXTERM:INFO",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display information message",
            documentation: {
                value: "**@NEXTERM:INFO** - Show informational notification\n\nDisplays a blue informational message to the user.\n\n**Syntax:**\n```bash\n@NEXTERM:INFO \"message\"\n```\n\n**Example:**\n```bash\n@NEXTERM:INFO \"Starting deployment process\"\n@NEXTERM:INFO \"Configuration validated successfully\"\n```\n\n**Use Cases:**\n- Status updates\n- Non-critical information\n- Progress notifications\n- Helpful hints",
            },
            insertText: "@NEXTERM:INFO \"${1:Information message}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "10_INFO",
            filterText: "@NEXTERM:INFO NEXTERM INFO",
        },
        {
            label: "@NEXTERM:SUCCESS",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display success message",
            documentation: {
                value: "**@NEXTERM:SUCCESS** - Show success notification\n\nDisplays a green success message to indicate successful completion.\n\n**Syntax:**\n```bash\n@NEXTERM:SUCCESS \"message\"\n```\n\n**Example:**\n```bash\n@NEXTERM:SUCCESS \"Deployment completed successfully!\"\n@NEXTERM:SUCCESS \"Database backup created\"\n```\n\n**Best Practices:**\n- Use after successful operations\n- Be specific about what succeeded\n- Typically used at the end of major steps",
            },
            insertText: "@NEXTERM:SUCCESS \"${1:Operation completed successfully!}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "11_SUCCESS",
            filterText: "@NEXTERM:SUCCESS NEXTERM SUCCESS",
        },
        {
            label: "@NEXTERM:WARN",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display warning message",
            documentation: {
                value: "**@NEXTERM:WARN** - Show warning notification\n\nDisplays a yellow/orange warning message for cautionary information.\n\n**Syntax:**\n```bash\n@NEXTERM:WARN \"message\"\n```\n\n**Example:**\n```bash\n@NEXTERM:WARN \"This operation cannot be undone\"\n@NEXTERM:WARN \"Running in development mode - not for production\"\n```\n\n**Use Cases:**\n- Non-critical issues\n- Important notices\n- Deprecation warnings\n- Performance considerations",
            },
            insertText: "@NEXTERM:WARN \"${1:Warning: proceeding with caution}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "12_WARN",
            filterText: "@NEXTERM:WARN NEXTERM WARN",
        },
        {
            label: "@NEXTERM:ERROR",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display error message",
            documentation: {
                value: "**@NEXTERM:ERROR** - Show error notification\n\nDisplays a red error message for critical issues.\n\n**Syntax:**\n```bash\n@NEXTERM:ERROR \"message\"\n```\n\n**Example:**\n```bash\nif [ ! -f \"/etc/config.yml\" ]; then\n    @NEXTERM:ERROR \"Configuration file not found\"\n    exit 1\nfi\n```\n\n**Use Cases:**\n- Critical failures\n- Missing dependencies\n- Configuration errors\n- Permission issues",
            },
            insertText: "@NEXTERM:ERROR \"${1:Error occurred}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "13_ERROR",
            filterText: "@NEXTERM:ERROR NEXTERM ERROR",
        },
        {
            label: "@NEXTERM:PROGRESS",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Update progress indicator (0-100)",
            documentation: {
                value: "**@NEXTERM:PROGRESS** - Display progress bar\n\nShows a visual progress indicator with percentage (0-100).\n\n**Syntax:**\n```bash\n@NEXTERM:PROGRESS percentage\n```\n\n**Example:**\n```bash\n@NEXTERM:PROGRESS 0\nfor i in {1..100}; do\n    # Do some work\n    sleep 0.1\n    @NEXTERM:PROGRESS $i\ndone\n@NEXTERM:PROGRESS 100\n```\n\n**Parameters:**\n- `percentage`: Number between 0 and 100\n\n**Best Practices:**\n- Always start at 0 and end at 100\n- Update in meaningful increments\n- Use in loops or long-running operations",
            },
            insertText: "@NEXTERM:PROGRESS ${1:50}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "14_PROGRESS",
            filterText: "@NEXTERM:PROGRESS NEXTERM PROGRESS",
        },
        {
            label: "@NEXTERM:SUMMARY",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display formatted summary with key-value pairs",
            documentation: {
                value: "**@NEXTERM:SUMMARY** - Show summary dialog\n\nDisplays a formatted summary table with key-value pairs.\n\n**Syntax:**\n```bash\n@NEXTERM:SUMMARY \"title\" \"key1\" \"value1\" \"key2\" \"value2\" ...\n```\n\n**Example:**\n```bash\n@NEXTERM:SUMMARY \"System Information\" \\\n    \"OS\" \"$(lsb_release -d | cut -f2)\" \\\n    \"Hostname\" \"$(hostname)\" \\\n    \"CPU\" \"$(nproc) cores\" \\\n    \"RAM\" \"$(free -h | grep Mem: | awk '{print $2}')\" \\\n    \"Disk\" \"$(df -h / | tail -1 | awk '{print $4}' free)\"\n```\n\n**Parameters:**\n- `title`: Summary title\n- `key-value pairs`: Alternating keys and values\n\n**Use Cases:**\n- Configuration summaries\n- Installation reports\n- System information\n- Deployment details",
            },
            insertText: "@NEXTERM:SUMMARY \"${1:Summary Title}\" \"${2:Key 1}\" \"${3:Value 1}\" \"${4:Key 2}\" \"${5:Value 2}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "20_SUMMARY",
            filterText: "@NEXTERM:SUMMARY NEXTERM SUMMARY",
        },
        {
            label: "@NEXTERM:TABLE",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display data in tabular format",
            documentation: {
                value: "**@NEXTERM:TABLE** - Show formatted table\n\nDisplays data in a formatted table with headers and rows.\n\n**Syntax:**\n```bash\n@NEXTERM:TABLE \"title\" \"headers\" \"row1\" \"row2\" ...\n```\n\n**Example:**\n```bash\n@NEXTERM:TABLE \"Running Processes\" \\\n    \"PID,Name,CPU%,Memory\" \\\n    \"1234,nginx,2.5%,45MB\" \\\n    \"5678,mysql,15.2%,512MB\" \\\n    \"9012,node,8.3%,128MB\"\n```\n\n**Parameters:**\n- `title`: Table title\n- `headers`: Comma-separated column headers\n- `rows`: Comma-separated row values (one per row)\n\n**Notes:**\n- Use commas to separate columns\n- Quote rows containing spaces\n- Headers automatically styled differently",
            },
            insertText: "@NEXTERM:TABLE \"${1:Table Title}\" \"${2:Header1,Header2,Header3}\" \"${3:val1,val2,val3}\" \"${4:val4,val5,val6}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "21_TABLE",
            filterText: "@NEXTERM:TABLE NEXTERM TABLE",
        },
        {
            label: "@NEXTERM:MSGBOX",
            kind: monaco.languages.CompletionItemKind.Function,
            detail: "Display modal message box (halts execution)",
            documentation: {
                value: "**@NEXTERM:MSGBOX** - Show modal message dialog\n\nDisplays a modal dialog that halts script execution until acknowledged.\n\n**Syntax:**\n```bash\n@NEXTERM:MSGBOX \"title\" \"message\"\n```\n\n**Example:**\n```bash\n@NEXTERM:MSGBOX \"Important\" \"Database backup completed. Please verify before proceeding.\"\n@NEXTERM:MSGBOX \"Manual Intervention\" \"Please configure /etc/config.yml manually, then click OK to continue\"\n```\n\n**Parameters:**\n- `title`: Dialog title\n- `message`: Detailed message content\n\n**Behavior:**\n- Script pauses until user clicks OK\n- Use for critical checkpoints\n- Ideal for manual intervention steps",
            },
            insertText: "@NEXTERM:MSGBOX \"${1:Title}\" \"${2:Important message that requires acknowledgment}\"",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "22_MSGBOX",
            filterText: "@NEXTERM:MSGBOX NEXTERM MSGBOX",
        },
    ];

    const shellCommands = [
        { label: "echo", detail: "Output text to console", insertText: "echo \"${1:text}\"" },
        { label: "cd", detail: "Change directory", insertText: "cd ${1:directory}" },
        { label: "ls", detail: "List directory contents", insertText: "ls ${1:-la}" },
        { label: "pwd", detail: "Print working directory", insertText: "pwd" },
        { label: "mkdir", detail: "Create directory", insertText: "mkdir ${1:-p} ${2:directory}" },
        { label: "rm", detail: "Remove files/directories", insertText: "rm ${1:-rf} ${2:path}" },
        { label: "cp", detail: "Copy files", insertText: "cp ${1:-r} ${2:source} ${3:dest}" },
        { label: "mv", detail: "Move/rename files", insertText: "mv ${1:source} ${2:dest}" },
        { label: "cat", detail: "Display file contents", insertText: "cat ${1:file}" },
        { label: "grep", detail: "Search text patterns", insertText: "grep \"${1:pattern}\" ${2:file}" },
        { label: "find", detail: "Find files", insertText: "find ${1:path} -name \"${2:pattern}\"" },
        { label: "sed", detail: "Stream editor", insertText: "sed \"s/${1:old}/${2:new}/g\" ${3:file}" },
        { label: "awk", detail: "Pattern scanning and processing", insertText: "awk '{${1:print \\$1}}' ${2:file}" },
        { label: "chmod", detail: "Change file permissions", insertText: "chmod ${1:755} ${2:file}" },
        { label: "chown", detail: "Change file owner", insertText: "chown ${1:user}:${2:group} ${3:file}" },
        { label: "tar", detail: "Archive files", insertText: "tar ${1:-czf} ${2:archive.tar.gz} ${3:files}" },
        { label: "wget", detail: "Download from URL", insertText: "wget ${1:url}" },
        { label: "curl", detail: "Transfer data from URL", insertText: "curl ${1:-O} ${2:url}" },
        { label: "ssh", detail: "Secure shell", insertText: "ssh ${1:user}@${2:host}" },
        { label: "scp", detail: "Secure copy", insertText: "scp ${1:source} ${2:user}@${3:host}:${4:dest}" },
        { label: "git", detail: "Version control", insertText: "git ${1:command}" },
        { label: "docker", detail: "Container management", insertText: "docker ${1:command}" },
        { label: "npm", detail: "Node package manager", insertText: "npm ${1:command}" },
        {
            label: "systemctl",
            detail: "System service control",
            insertText: "systemctl ${1:start|stop|restart} ${2:service}",
        },
        { label: "apt-get", detail: "Debian package manager", insertText: "apt-get ${1:install} ${2:package}" },
        { label: "if", detail: "If statement", insertText: "if [ ${1:condition} ]; then\n\t${2:# commands}\nfi" },
        { label: "for", detail: "For loop", insertText: "for ${1:i} in ${2:list}; do\n\t${3:# commands}\ndone" },
        { label: "while", detail: "While loop", insertText: "while [ ${1:condition} ]; do\n\t${2:# commands}\ndone" },
    ];

    monaco.languages.registerCompletionItemProvider("nexterm", {
        triggerCharacters: ["@", ":", "$", " "],

        provideCompletionItems: (model, position) => {
            const lineContent = model.getLineContent(position.lineNumber);
            const textUntilPosition = lineContent.substring(0, position.column - 1);
            const word = model.getWordUntilPosition(position);

            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const suggestions = [];

            if (textUntilPosition.match(/@(NEXTERM)?(:(([A-Z]+))?)?$/i)) {
                nextermCommands.forEach(cmd => {
                    suggestions.push({
                        ...cmd,
                        range: {
                            startLineNumber: position.lineNumber,
                            endLineNumber: position.lineNumber,
                            startColumn: textUntilPosition.lastIndexOf("@") + 1,
                            endColumn: position.column,
                        },
                    });
                });
                return { suggestions };
            }

            const trimmedLine = textUntilPosition.trimStart();
            if (trimmedLine === "" || textUntilPosition.match(/^\s*$/)) {
                nextermCommands.forEach(cmd => {
                    suggestions.push({ ...cmd, range });
                });

                shellCommands.forEach(cmd => {
                    suggestions.push({
                        label: cmd.label,
                        kind: monaco.languages.CompletionItemKind.Function,
                        detail: cmd.detail,
                        insertText: cmd.insertText,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range,
                        sortText: "50_" + cmd.label,
                    });
                });

                return { suggestions };
            }

            if (textUntilPosition.match(/\$\{?[A-Za-z0-9_]*$/)) {
                const commonVars = [
                    { label: "HOME", detail: "User home directory" },
                    { label: "USER", detail: "Current username" },
                    { label: "PATH", detail: "Executable search path" },
                    { label: "PWD", detail: "Current working directory" },
                    { label: "SHELL", detail: "Current shell" },
                    { label: "HOSTNAME", detail: "System hostname" },
                ];

                commonVars.forEach(v => {
                    suggestions.push({
                        label: v.label,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        detail: v.detail,
                        insertText: v.label,
                        range,
                        sortText: "30_" + v.label,
                    });
                });
            }

            if (trimmedLine !== "" && !trimmedLine.startsWith("@") && !trimmedLine.startsWith("#")) {
                shellCommands.forEach(cmd => {
                    suggestions.push({
                        label: cmd.label,
                        kind: monaco.languages.CompletionItemKind.Function,
                        detail: cmd.detail,
                        insertText: cmd.label, range,
                        sortText: "60_" + cmd.label,
                    });
                });
            }

            return { suggestions };
        },
    });

    monaco.languages.registerHoverProvider("nexterm", {
        provideHover: (model, position) => {
            const line = model.getLineContent(position.lineNumber);
            const nextermMatch = line.match(/@NEXTERM:([A-Z]+)/);

            if (nextermMatch) {
                const command = nextermCommands.find(cmd => cmd.label === "@NEXTERM:" + nextermMatch[1]);
                if (command) {
                    return {
                        range: new monaco.Range(
                            position.lineNumber,
                            line.indexOf("@NEXTERM") + 1,
                            position.lineNumber,
                            line.indexOf("@NEXTERM") + nextermMatch[0].length + 1,
                        ),
                        contents: [
                            { value: `**${command.detail}**` },
                            { value: command.documentation.value },
                        ],
                    };
                }
            }

            return null;
        },
    });

    monaco.languages.registerSignatureHelpProvider("nexterm", {
        signatureHelpTriggerCharacters: [" ", "\""],
        signatureHelpRetriggerCharacters: [" "],

        provideSignatureHelp: (model, position) => {
            const line = model.getLineContent(position.lineNumber);
            const textUntilPosition = line.substring(0, position.column - 1);

            const nextermMatch = textUntilPosition.match(/@NEXTERM:([A-Z]+)/);
            if (!nextermMatch) return null;

            const command = nextermCommands.find(cmd => cmd.label === "@NEXTERM:" + nextermMatch[1]);
            if (!command) return null;

            return {
                dispose: () => {
                },
                value: {
                    signatures: [{
                        label: command.insertText.replace(/\$\{\d+:/g, "").replace(/\}/g, ""),
                        documentation: command.documentation,
                        parameters: [],
                    }],
                    activeSignature: 0,
                    activeParameter: 0,
                },
            };
        },
    });

    monaco.languages.registerCodeActionProvider("nexterm", {
        provideCodeActions: (model, range) => {
            const actions = [];
            const line = model.getLineContent(range.startLineNumber);

            const knownCommands = ["STEP", "INPUT", "SELECT", "CONFIRM", "INFO", "SUCCESS", "WARN", "ERROR", "PROGRESS", "SUMMARY", "TABLE", "MSGBOX"];
            const match = line.match(/^\s*([A-Z]+)/);

            if (match && knownCommands.includes(match[1]) && !line.includes("@NEXTERM:")) {
                actions.push({
                    title: "Add @NEXTERM: prefix",
                    kind: "quickfix",
                    edit: {
                        edits: [{
                            resource: model.uri,
                            edit: {
                                range: new monaco.Range(range.startLineNumber, 1, range.startLineNumber, 1),
                                text: "@NEXTERM:",
                            },
                        }],
                    },
                });
            }

            return {
                actions,
                dispose: () => {
                },
            };
        },
    });
};
