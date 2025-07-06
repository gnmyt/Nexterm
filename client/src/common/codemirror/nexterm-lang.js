import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { autocompletion } from "@codemirror/autocomplete";

const nextermShellMode = {
    name: "nexterm",

    startState: function() {
        const shellState = shell.startState ? shell.startState() : {};
        return { ...shellState, inNextermCommand: false, nextermType: null };
    },

    token: function(stream, state) {
        if (stream.sol()) {
            state.inNextermCommand = false;
            state.nextermType = null;
        }

        if (stream.match(/@NEXTERM:(STEP|INPUT|SELECT|WARN|INFO|SUCCESS|CONFIRM|PROGRESS|SUMMARY|TABLE|MSGBOX)/)) {
            state.inNextermCommand = true;
            state.nextermType = stream.current().split(":")[1];
            return "keyword";
        }

        if (state.inNextermCommand) {
            if (stream.eatSpace()) return null;

            if ((state.nextermType === "INPUT" || state.nextermType === "SELECT") &&
                stream.match(/[A-Z_][A-Z0-9_]*/)) {
                return "variableName";
            }

            if (stream.match(/"[^"]*"/)) return "string";


            if (stream.match(/[a-zA-Z0-9_-]+/)) return "atom";

            if (stream.eol()) {
                state.inNextermCommand = false;
                state.nextermType = null;
                return null;
            }

            stream.next();
            return null;
        }

        return shell.token(stream, state);
    },
    fold: shell.fold,
    electricInput: shell.electricInput,
    blockCommentStart: shell.blockCommentStart,
    blockCommentEnd: shell.blockCommentEnd,
    lineComment: shell.lineComment,
};

const nextermHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: "#ff6b6b", fontWeight: "bold", backgroundColor: "rgba(255, 107, 107, 0.1)" },
    { tag: tags.variableName, color: "#4ecdc4", fontStyle: "italic", fontWeight: "600" },
    { tag: tags.string, color: "#95e1d3" },
    { tag: tags.atom, color: "#ffc947" },
]);

const nextermCompletions = [
    {
        label: "@NEXTERM:STEP",
        type: "keyword",
        info: "Define a step in the script execution",
        detail: "Step definition",
        apply: "@NEXTERM:STEP \"Step description\"",
    },
    {
        label: "@NEXTERM:INPUT",
        type: "keyword",
        info: "Request user input with optional default value",
        detail: "User input prompt",
        apply: "@NEXTERM:INPUT VARIABLE_NAME \"Prompt text\" \"default_value\"",
    },
    {
        label: "@NEXTERM:SELECT",
        type: "keyword",
        info: "Present user with selection options",
        detail: "Selection prompt",
        apply: "@NEXTERM:SELECT VARIABLE_NAME \"Choose option\" \"Option 1\" \"Option 2\" option3",
    },
    {
        label: "@NEXTERM:WARN",
        type: "keyword",
        info: "Display a warning message",
        detail: "Warning message",
        apply: "@NEXTERM:WARN \"Warning message\"",
    },
    {
        label: "@NEXTERM:INFO",
        type: "keyword",
        info: "Display an informational message",
        detail: "Info message",
        apply: "@NEXTERM:INFO \"Information message\"",
    },
    {
        label: "@NEXTERM:SUCCESS",
        type: "keyword",
        info: "Display a success message",
        detail: "Success message",
        apply: "@NEXTERM:SUCCESS \"Success message\"",
    },
    {
        label: "@NEXTERM:CONFIRM",
        type: "keyword",
        info: "Ask user for Yes/No confirmation",
        detail: "Confirmation prompt",
        apply: "@NEXTERM:CONFIRM \"Are you sure you want to proceed?\" \"No\"",
    },
    {
        label: "@NEXTERM:PROGRESS",
        type: "keyword",
        info: "Display progress information with percentage",
        detail: "Progress indicator",
        apply: "@NEXTERM:PROGRESS 50",
    },
    {
        label: "@NEXTERM:SUMMARY",
        type: "keyword",
        info: "Display a summary dialog with key-value data",
        detail: "Summary dialog",
        apply: "@NEXTERM:SUMMARY \"System Information\" \"OS\" \"Ubuntu 22.04\" \"CPU\" \"4 cores\" \"Memory\" \"8GB\"",
    },
    {
        label: "@NEXTERM:TABLE",
        type: "keyword",
        info: "Display a table dialog with structured data",
        detail: "Table dialog",
        apply: "@NEXTERM:TABLE \"Process List\" \"PID,Name,CPU%,Memory\" \"1234,nginx,2.5%,45MB\" \"5678,apache,1.8%,32MB\"",
    },
    {
        label: "@NEXTERM:MSGBOX",
        type: "keyword",
        info: "Display a message box dialog that halts execution until closed",
        detail: "Message box dialog",
        apply: "@NEXTERM:MSGBOX \"Information\" \"This is an important message that requires acknowledgment.\"",
    },
];

const nextermAutocompletion = (context) => {
    const word = context.matchBefore(/(@NEXTERM:?[A-Z]*)/);
    if (!word) return null;

    return {
        options: nextermCompletions.filter(completion => completion.label.toLowerCase().includes(word.text.toLowerCase())),
        from: word.from, to: word.to,
    };
};

export const nextermLanguage = () => [
    StreamLanguage.define(nextermShellMode),
    syntaxHighlighting(nextermHighlightStyle),
    autocompletion({ override: [nextermAutocompletion] }),
];
