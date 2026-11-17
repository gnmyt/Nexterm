import { useMemo, useState } from "react";
import Icon from "@mdi/react";
import { mdiArrowDown, mdiArrowUp, mdiCheck, mdiChevronDown, mdiContentCopy, mdiNetworkOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import EmptyState from "@/common/components/EmptyState";
import { formatBytes } from "@/common/utils/formatUtils.js";
import { EMPTY, FactList, SectionHeading, StatusBadge } from "../../../shared";
import "./styles.sass";

const VIRTUAL_KINDS = new Set(["bridge", "veth", "virtual"]);
const DIRECTIONS = [
    { key: "download", icon: mdiArrowDown, rate: "rxRate", total: "rxBytes" },
    { key: "upload", icon: mdiArrowUp, rate: "txRate", total: "txBytes" },
];

const formatRate = (bytesPerSecond) => {
    if (bytesPerSecond == null) return EMPTY;
    const bits = bytesPerSecond * 8;
    if (bits < 1000) return `${Math.round(bits)} bit/s`;
    const i = Math.min(Math.floor(Math.log(bits) / Math.log(1000)), 3);
    const value = bits / Math.pow(1000, i);
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${["bit/s", "kbit/s", "Mbit/s", "Gbit/s"][i]}`;
};

const formatSpeed = (mbit) => mbit >= 1000 ? `${mbit / 1000} Gbit/s` : `${mbit} Mbit/s`;

const stripPrefix = (address) => address.replace(/\/\d+$/, "");
const isLinkLocal = (address) => address.toLowerCase().startsWith("fe80:");
const isUp = (iface) => iface.state === "up" || (iface.state === "unknown" && iface.kind === "tunnel");
const isMain = (iface) => iface.default || !VIRTUAL_KINDS.has(iface.kind);
const getPrimaryAddress = (iface) => iface.ipv4?.[0] || iface.ipv6?.find(address => !isLinkLocal(address));

const sortInterfaces = (a, b) =>
    (b.default ? 1 : 0) - (a.default ? 1 : 0)
    || (isUp(b) ? 1 : 0) - (isUp(a) ? 1 : 0)
    || ((b.rxRate || 0) + (b.txRate || 0)) - ((a.rxRate || 0) + (a.txRate || 0))
    || a.name.localeCompare(b.name);

const Address = ({ address }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(stripPrefix(address));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };

    return (
        <button type="button" className={`net-address mono${isLinkLocal(address) ? " net-address--muted" : ""}`} onClick={copy}
                aria-label={t("monitoring.details.network.copy", { address: stripPrefix(address) })}>
            {address}
            <Icon path={copied ? mdiCheck : mdiContentCopy} />
        </button>
    );
};

const Interface = ({ iface, t }) => {
    const up = isUp(iface);
    const addresses = [...(iface.ipv4 || []), ...(iface.ipv6 || [])].sort((a, b) => isLinkLocal(a) - isLinkLocal(b));
    const meta = [
        iface.kind === "physical" && iface.speed > 0 ? formatSpeed(iface.speed) : null,
        iface.mtu ? `MTU ${iface.mtu}` : null,
        iface.mac && iface.mac !== "00:00:00:00:00:00" ? iface.mac : null,
    ].filter(Boolean);
    const problems = [
        { key: "errors", total: iface.errors, recent: iface.recentErrors },
        { key: "dropped", total: iface.dropped, recent: iface.recentDropped },
    ].filter(item => item.total > 0);

    return (
        <div className={`net-interface${up ? "" : " net-interface--down"}`}>
            <div className="mon-row-head">
                <span className="mon-row-head__name mono">{iface.name}</span>
                {iface.default && <span className="mon-tag mon-tag--accent">{t("monitoring.details.network.defaultRoute")}</span>}
                {iface.kind !== "physical" && <span className="mon-tag">{iface.kind}</span>}
                {iface.state && <StatusBadge state={up ? "online" : "unknown"} label={t(`monitoring.details.network.${up ? "up" : "down"}`)} />}
            </div>
            {addresses.length > 0 && (
                <div className="net-interface__addresses">
                    {addresses.map(address => <Address key={address} address={address} />)}
                </div>
            )}
            <div className="net-interface__rates">
                {DIRECTIONS.map(direction => (
                    <div key={direction.key} className="net-rate">
                        <Icon path={direction.icon} />
                        <span className="net-rate__label">{t(`monitoring.details.network.${direction.key}`)}</span>
                        <span className="net-rate__value">{formatRate(iface[direction.rate])}</span>
                        <span className="net-rate__total">{t("monitoring.details.network.total", { value: formatBytes(iface[direction.total]) })}</span>
                    </div>
                ))}
            </div>
            {(meta.length > 0 || problems.length > 0) && (
                <div className="net-interface__meta">
                    {meta.map(item => <span key={item}>{item}</span>)}
                    {problems.map(item => (
                        <span key={item.key} className={item.recent > 0 ? "alert" : undefined}>
                            {t(`monitoring.details.network.${item.key}`, { count: item.total.toLocaleString() })}
                            {item.recent > 0 && ` (+${item.recent.toLocaleString()})`}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const CompactInterface = ({ iface, t }) => {
    const up = isUp(iface);

    return (
        <div className={`net-compact${up ? "" : " net-compact--down"}`}>
            <span className={`net-compact__dot${up ? " up" : ""}`} role="img"
                  aria-label={t(`monitoring.details.network.${up ? "up" : "down"}`)} />
            <span className="net-compact__name mono">{iface.name}</span>
            <span className="net-compact__address mono">{getPrimaryAddress(iface) || EMPTY}</span>
            {DIRECTIONS.map(direction => (
                <span key={direction.key} className="net-compact__rate"><Icon path={direction.icon} />{formatRate(iface[direction.rate])}</span>
            ))}
        </div>
    );
};

const Summary = ({ iface, t }) => {
    const address = getPrimaryAddress(iface);
    const facts = [
        { key: "interface", value: iface.name, mono: true },
        address && { key: "address", value: stripPrefix(address), mono: true },
        iface.gateway && { key: "gateway", value: iface.gateway, mono: true },
        iface.speed > 0 && { key: "speed", value: formatSpeed(iface.speed) },
    ].filter(Boolean).map(fact => ({ ...fact, label: t(`monitoring.details.network.${fact.key}`) }));

    return (
        <div className="mon-card net-summary">
            <div className="net-summary__rates">
                {DIRECTIONS.map(direction => (
                    <div key={direction.key}>
                        <span className="net-summary__label"><Icon path={direction.icon} />{t(`monitoring.details.network.${direction.key}`)}</span>
                        <span className="net-summary__value">{formatRate(iface[direction.rate])}</span>
                    </div>
                ))}
            </div>
            <FactList facts={facts} />
        </div>
    );
};

export const NetworkTab = ({ network }) => {
    const { t } = useTranslation();
    const [showVirtual, setShowVirtual] = useState(false);

    const { main, virtual, primary } = useMemo(() => {
        const sorted = [...(network || [])].sort(sortInterfaces);
        const mainList = sorted.filter(isMain);
        return {
            main: mainList,
            virtual: sorted.filter(iface => !isMain(iface)),
            primary: sorted.find(iface => iface.default) || mainList.find(isUp) || null,
        };
    }, [network]);

    if (!network?.length) {
        return <EmptyState className="details-empty" icon={mdiNetworkOutline} description={t("monitoring.details.network.noData")} />;
    }

    return (
        <>
            {primary && <Summary iface={primary} t={t} />}

            {main.length > 0 && (
                <>
                    <SectionHeading title={t("monitoring.details.network.interfaces")} count={main.length} />
                    <div className="mon-card mon-card--list">
                        {main.map(iface => <Interface key={iface.name} iface={iface} t={t} />)}
                    </div>
                </>
            )}

            {virtual.length > 0 && (
                <>
                    <button type="button" className={`mon-heading net-toggle${showVirtual ? " open" : ""}`}
                            onClick={() => setShowVirtual(open => !open)} aria-expanded={showVirtual}>
                        <h3>{t("monitoring.details.network.virtual")}</h3>
                        <span className="mon-heading__count">{virtual.length}</span>
                        <Icon path={mdiChevronDown} />
                    </button>
                    {showVirtual && (
                        <div className="mon-card mon-card--list net-compact-list">
                            {virtual.map(iface => <CompactInterface key={iface.name} iface={iface} t={t} />)}
                        </div>
                    )}
                </>
            )}
        </>
    );
};
