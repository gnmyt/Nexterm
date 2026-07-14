import { marked } from "marked";
import "./styles.sass";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" };
const decode = (text) => text.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);

const renderInline = (tokens, keyPrefix) =>
    (tokens || []).map((tok, i) => {
        const key = `${keyPrefix}-${i}`;
        switch (tok.type) {
            case "strong": return <strong key={key}>{renderInline(tok.tokens, key)}</strong>;
            case "em": return <em key={key}>{renderInline(tok.tokens, key)}</em>;
            case "del": return <del key={key}>{renderInline(tok.tokens, key)}</del>;
            case "codespan": return <code key={key} className="inline-code">{decode(tok.text)}</code>;
            case "br": return <br key={key} />;
            case "link":
                return (
                    <a key={key} href={tok.href} target="_blank" rel="noopener noreferrer">
                        {renderInline(tok.tokens, key)}
                    </a>
                );
            default: return tok.tokens ? renderInline(tok.tokens, key) : decode(tok.text ?? tok.raw ?? "");
        }
    });

const renderItem = (tokens, keyPrefix) =>
    (tokens || []).map((tok, i) => {
        const key = `${keyPrefix}-${i}`;
        if (tok.type === "text") {
            return <span key={key}>{tok.tokens ? renderInline(tok.tokens, key) : decode(tok.text ?? "")}</span>;
        }
        return renderBlock([tok], key);
    });

const alignStyle = (align) => (align ? { textAlign: align } : undefined);

const renderBlock = (tokens, keyPrefix) =>
    (tokens || []).map((tok, i) => {
        const key = `${keyPrefix}-${i}`;
        switch (tok.type) {
            case "space":
            case "html":
                return null;
            case "heading": {
                const Tag = `h${Math.min(tok.depth, 6)}`;
                return <Tag key={key} className="md-heading">{renderInline(tok.tokens, key)}</Tag>;
            }
            case "paragraph":
                return <p key={key} className="text-line">{renderInline(tok.tokens, key)}</p>;
            case "text":
                return <p key={key} className="text-line">{tok.tokens ? renderInline(tok.tokens, key) : decode(tok.text ?? "")}</p>;
            case "code":
                return <pre key={key} className="code-block"><code>{tok.text}</code></pre>;
            case "blockquote":
                return <blockquote key={key} className="md-quote">{renderBlock(tok.tokens, key)}</blockquote>;
            case "hr":
                return <hr key={key} className="md-hr" />;
            case "list": {
                const Tag = tok.ordered ? "ol" : "ul";
                const start = tok.ordered && tok.start !== 1 ? tok.start : undefined;
                return (
                    <Tag key={key} className="md-list" start={start}>
                        {tok.items.map((item, j) => <li key={`${key}-${j}`}>{renderItem(item.tokens, `${key}-${j}`)}</li>)}
                    </Tag>
                );
            }
            case "table":
                return (
                    <div key={key} className="md-table-wrap">
                        <table className="md-table">
                            <thead>
                                <tr>
                                    {tok.header.map((cell, j) => (
                                        <th key={`${key}-h-${j}`} style={alignStyle(tok.align[j])}>{renderInline(cell.tokens, `${key}-h-${j}`)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tok.rows.map((row, r) => (
                                    <tr key={`${key}-r-${r}`}>
                                        {row.map((cell, j) => (
                                            <td key={`${key}-${r}-${j}`} style={alignStyle(tok.align[j])}>{renderInline(cell.tokens, `${key}-${r}-${j}`)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            default:
                return tok.raw ? <p key={key} className="text-line">{decode(tok.raw)}</p> : null;
        }
    });

export const MessageContent = ({ text }) => {
    let tokens;
    try {
        tokens = marked.lexer(text);
    } catch {
        tokens = null;
    }

    return (
        <div className="message-content">
            {tokens
                ? renderBlock(tokens, "b")
                : <p className="text-line" style={{ whiteSpace: "pre-wrap" }}>{text}</p>}
        </div>
    );
};
