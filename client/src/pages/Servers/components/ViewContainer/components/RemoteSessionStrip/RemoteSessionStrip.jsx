import Icon from "@mdi/react";
import { mdiMonitorMultiple, mdiPlus, mdiMinus } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Tooltip from "@/common/components/Tooltip";
import { MODIFIER_KEYS } from "../../utils/remoteKeys.js";
import "./styles.sass";

const preventFocusLoss = (event) => event.preventDefault();

export const RemoteSessionStrip = ({ controls }) => {
    const { t } = useTranslation();

    const act = (action) => (event) => {
        event.preventDefault();
        event.stopPropagation();
        action();
        controls.focus();
    };

    const monitors = Array.from({ length: controls.monitorCount }, (_, index) => index)
        .filter(index => !controls.poppedOutMonitors.has(index));
    const showsMonitors = controls.allowMonitors && controls.maxMonitors > 1;
    const canRemoveMonitor = controls.monitorCount > 1 && !controls.poppedOutMonitors.has(controls.monitorCount - 1);

    return (
        <div className="remote-session-strip">
            <div className="remote-session-strip__group">
                {MODIFIER_KEYS.map(({ label, keysym }) => (
                    <Tooltip key={keysym} text={t("servers.toolbar.holdModifier", { key: label })} delay={500} asChild>
                        <button type="button" aria-pressed={controls.heldModifiers.has(keysym)}
                                className={`remote-session-strip__key${controls.heldModifiers.has(keysym) ? " held" : ""}`}
                                onMouseDown={preventFocusLoss}
                                onClick={act(() => controls.toggleModifier(keysym))}>
                            {label}
                        </button>
                    </Tooltip>
                ))}
            </div>

            {showsMonitors && (
                <div className="remote-session-strip__group monitors">
                    <Icon path={mdiMonitorMultiple} className="remote-session-strip__icon" />
                    <div className="remote-session-strip__segments">
                    {monitors.map(index => (
                        <Tooltip key={index} text={controls.readOnly
                            ? t("servers.monitors.select", { number: index + 1 })
                            : t("servers.monitors.selectOrPopOut", { number: index + 1 })} delay={500} asChild>
                            <button type="button"
                                    className={`remote-session-strip__chip${index === controls.activeMonitor ? " active" : ""}`}
                                    onMouseDown={preventFocusLoss}
                                    onClick={act(() => controls.selectMonitor(index))}
                                    onDoubleClick={controls.readOnly ? undefined : act(() => controls.popOutMonitor(index))}>
                                {index + 1}
                            </button>
                        </Tooltip>
                    ))}
                    </div>
                    {!controls.readOnly && (
                        <>
                            <button type="button" className="remote-session-strip__action" disabled={!canRemoveMonitor}
                                    aria-label={t("servers.monitors.remove")} onMouseDown={preventFocusLoss}
                                    onClick={act(controls.removeMonitor)}>
                                <Icon path={mdiMinus} />
                            </button>
                            <button type="button" className="remote-session-strip__action"
                                    disabled={controls.monitorCount >= controls.maxMonitors}
                                    aria-label={t("servers.monitors.add")} onMouseDown={preventFocusLoss}
                                    onClick={act(controls.addMonitor)}>
                                <Icon path={mdiPlus} />
                            </button>
                        </>
                    )}
                </div>
            )}

            {controls.zoom > controls.minZoom && (
                <div className="remote-session-strip__group">
                    <Tooltip text={t("servers.toolbar.zoomReset")} delay={500} asChild>
                        <button type="button" className="remote-session-strip__chip zoom"
                                onMouseDown={preventFocusLoss}
                                onClick={act(controls.resetZoom)}>
                            {Math.round(controls.zoom * 100)}%
                        </button>
                    </Tooltip>
                </div>
            )}
        </div>
    );
};
