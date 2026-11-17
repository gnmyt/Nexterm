import { useTranslation } from "react-i18next";

export const ToolResult = ({ tool, result }) => {
    const { t } = useTranslation();
    if (!result || result.denied) return null;
    if (result.error) return <div className="tool-result"><pre className="output stderr">{result.error}</pre></div>;

    const images = Array.isArray(result.images) ? result.images : [];

    if (tool === "run_command" || tool === "exec_command") {
        return (
            <div className="tool-result">
                {result.stdout ? <pre className="output">{result.stdout}</pre> : null}
                {result.stderr ? <pre className="output stderr">{result.stderr}</pre> : null}
            </div>
        );
    }

    if (tool === "terminal_run" || tool === "terminal_read") {
        return (
            <div className="tool-result">
                {result.output ? <pre className="output">{result.output}</pre> : null}
                {tool === "terminal_read" && result.screen && !result.output ? <pre className="output">{result.screen}</pre> : null}
            </div>
        );
    }

    if (tool === "file_read") {
        return (
            <div className="tool-result">
                <pre className="output">{result.content}{result.truncated ? `\n… ${t("servers.aiAssistant.truncated")}` : ""}</pre>
            </div>
        );
    }

    if (tool === "file_list") {
        return (
            <div className="tool-result dir-list">
                {(result.entries || []).map((e, i) => (
                    <span key={`${e.name}-${i}`} className={`dir-entry ${e.type}`}>{e.name}{e.type === "folder" ? "/" : ""}</span>
                ))}
            </div>
        );
    }

    if (images.length) {
        return (
            <div className="tool-result">
                {images.map((image, i) => (
                    <img key={i} className="screenshot" src={`data:${image.mimeType};base64,${image.data}`} alt="" />
                ))}
                {result.warning && <div className="tool-note">{result.warning}</div>}
            </div>
        );
    }

    return (
        <div className="tool-result">
            <pre className="output">{JSON.stringify(result, null, 2)}</pre>
        </div>
    );
};
