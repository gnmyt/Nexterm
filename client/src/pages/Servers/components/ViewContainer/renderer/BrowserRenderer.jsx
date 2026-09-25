import { useEffect, useRef, useState } from "react";
import Guacamole from "guacamole-common-js";
import Icon from "@mdi/react";
import { mdiArrowLeft, mdiArrowRight, mdiClose, mdiRefresh } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { textToBase64 } from "@/common/utils/base64.js";
import GuacamoleRenderer from "./GuacamoleRenderer.jsx";
import "./styles/browser.sass";

const CLIPBOARD_POLL_INTERVAL = 500;
const PIPE_NAME = "nexterm-browser";

const BrowserRenderer = (props) => {
    const { canControl = true, onPageInfo } = props;
    const { t } = useTranslation();

    const clientRef = useRef(null);
    const inputRef = useRef(null);
    const focusedRef = useRef(false);
    const lastClipboardRef = useRef(null);

    const pageInfoRef = useRef(onPageInfo);
    pageInfoRef.current = onPageInfo;

    const [address, setAddress] = useState("");
    const [state, setState] = useState({ uri: "", loading: false, canBack: false, canForward: false });

    const handleEvent = (payload) => {
        let message;
        try {
            message = JSON.parse(payload);
        } catch {
            return;
        }

        if (message.event === "clipboard") {
            if (typeof message.text !== "string" || !message.text) return;
            lastClipboardRef.current = message.text;
            navigator.clipboard.writeText(message.text).catch(() => {});
            return;
        }

        if (message.event === "favicon") {
            if (typeof message.data !== "string") return;
            pageInfoRef.current?.({ icon: message.data ? `data:image/png;base64,${message.data}` : null });
            return;
        }

        if (message.event !== "state") return;

        pageInfoRef.current?.({ title: message.title || "" });

        setState({
            uri: message.uri || "",
            loading: !!message.loading,
            canBack: !!message.canBack,
            canForward: !!message.canForward,
        });
        if (!focusedRef.current) setAddress(message.uri || "");
    };

    const handleClientReady = (client) => {
        clientRef.current = client;

        client.onpipe = (stream, mimetype, name) => {
            if (name !== PIPE_NAME) return;

            const reader = new Guacamole.StringReader(stream);
            let payload = "";
            reader.ontext = (text) => payload += text;
            reader.onend = () => handleEvent(payload);
        };
    };

    const sendCommand = (command) => {
        const client = clientRef.current;
        if (!client || !canControl) return;

        const writer = new Guacamole.StringWriter(client.createPipeStream("application/json", PIPE_NAME));
        writer.sendText(command);
        writer.sendEnd();
    };

    useEffect(() => {
        if (!canControl) return;

        const syncClipboard = async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text || text === lastClipboardRef.current) return;

                const encoded = textToBase64(text);
                lastClipboardRef.current = text;
                sendCommand(`clipboard ${encoded}`);
            } catch {}
        };

        syncClipboard();
        const timer = setInterval(syncClipboard, CLIPBOARD_POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [canControl]);

    const submitAddress = (event) => {
        event.preventDefault();
        if (!address.trim()) return;
        sendCommand(`navigate ${address.trim()}`);
        inputRef.current?.blur();
    };

    return (
        <div className="browser-renderer">
            <form className="browser-toolbar" onSubmit={submitAddress}>
                <button type="button" className="browser-toolbar__action" disabled={!canControl || !state.canBack}
                        title={t("servers.browser.back")} aria-label={t("servers.browser.back")}
                        onClick={() => sendCommand("back")}>
                    <Icon path={mdiArrowLeft} size={0.8} />
                </button>
                <button type="button" className="browser-toolbar__action" disabled={!canControl || !state.canForward}
                        title={t("servers.browser.forward")} aria-label={t("servers.browser.forward")}
                        onClick={() => sendCommand("forward")}>
                    <Icon path={mdiArrowRight} size={0.8} />
                </button>
                <button type="button" className="browser-toolbar__action" disabled={!canControl}
                        title={state.loading ? t("servers.browser.stop") : t("servers.browser.reload")}
                        aria-label={state.loading ? t("servers.browser.stop") : t("servers.browser.reload")}
                        onClick={() => sendCommand(state.loading ? "stop" : "reload")}>
                    <Icon path={state.loading ? mdiClose : mdiRefresh} size={0.8} />
                </button>
                <div className="browser-toolbar__address">
                    <input ref={inputRef} value={address} spellCheck="false" readOnly={!canControl}
                           placeholder={t("servers.browser.addressPlaceholder")}
                           aria-label={t("servers.browser.address")}
                           onChange={(event) => setAddress(event.target.value)}
                           onFocus={(event) => {
                               focusedRef.current = true;
                               event.target.select();
                           }}
                           onBlur={() => {
                               focusedRef.current = false;
                               setAddress(state.uri);
                           }} />
                    {state.loading && <div className="browser-toolbar__progress" />}
                </div>
            </form>
            <div className="browser-renderer__view">
                <GuacamoleRenderer {...props} interceptPaste={false} sendScancodes={false}
                                   onClientReady={handleClientReady} />
            </div>
        </div>
    );
};

export default BrowserRenderer;
