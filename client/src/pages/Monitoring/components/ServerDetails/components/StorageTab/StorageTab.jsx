import { useMemo } from "react";
import { mdiAlertOutline, mdiHarddisk } from "@mdi/js";
import { useTranslation } from "react-i18next";
import EmptyState from "@/common/components/EmptyState";
import { formatBytes } from "@/common/utils/formatUtils.js";
import { FactList, Meter, SectionHeading, StateNotice, StatusBadge } from "../../../shared";
import "./styles.sass";

const LAYER_LABELS = { crypt: "LUKS", lvm: "LVM" };
const HEALTH_BADGES = { passed: "online", warning: "error", failed: "offline", denied: "unknown" };
const SHADES = 3;

const isMounted = (volume) => volume.mounted;
const isWindowsDisk = (name) => /^[A-Za-z]:$/.test(name || "");
const diskPath = (name) => isWindowsDisk(name) ? `${name}\\` : `/dev/${name}`;
const isSwap = (volume) => volume.type === "swap" || volume.mountPoint === "[SWAP]";
const layerLabel = (layer) => LAYER_LABELS[layer] || (layer?.startsWith("raid") ? "RAID" : null);
const sumBy = (items, key) => items.reduce((sum, item) => sum + (item[key] || 0), 0);

const compactNumber = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

const formatPowerOn = (hours, t) => {
    if (hours >= 24 * 365) return t("monitoring.details.storage.health.years", { value: (hours / (24 * 365)).toFixed(1) });
    if (hours >= 48) return t("monitoring.details.storage.health.days", { value: Math.round(hours / 24) });
    return t("monitoring.details.storage.health.hours", { value: hours });
};

const getHealth = (disk, t) => {
    const health = disk.health;
    if (!health || !HEALTH_BADGES[health.status]) return null;

    const problems = [
        { key: "reallocated", value: health.reallocatedSectors },
        { key: "pending", value: health.pendingSectors },
        { key: "mediaErrors", value: health.mediaErrors },
    ].filter(item => item.value > 0);
    const worn = health.wearPercent >= 90;
    const status = health.status === "passed" && (problems.length > 0 || worn) ? "warning" : health.status;

    const facts = [];
    if (health.temperature != null) facts.push({ key: "temperature", value: `${health.temperature} °C` });
    if (health.powerOnHours != null) facts.push({ key: "powerOn", value: formatPowerOn(health.powerOnHours, t) });
    if (health.wearPercent != null) facts.push({ key: "wear", value: `${health.wearPercent}%`, alert: worn });
    problems.forEach(item => facts.push({ ...item, alert: true }));

    return { status, facts: facts.map(fact => ({ ...fact, label: t(`monitoring.details.storage.health.${fact.key}`) })) };
};

const getFilesystems = (disks) => {
    const seen = new Set();
    return disks
        .flatMap(disk => (disk.partitions || []).filter(isMounted))
        .filter(volume => !seen.has(volume.mountPoint) && seen.add(volume.mountPoint))
        .sort((a, b) => (b.usagePercent || 0) - (a.usagePercent || 0));
};

const describeVolumes = (volumes, t) => {
    const mounts = volumes.filter(isMounted).map(volume => volume.mountPoint);
    if (mounts.length) return mounts.join(", ");
    if (volumes.some(isSwap)) return t("monitoring.details.storage.swap");
    return t("monitoring.details.storage.unmounted");
};

const getSegments = (disk, t) => {
    const groups = new Map();
    for (const volume of disk.partitions || []) {
        if (!groups.has(volume.partition)) groups.set(volume.partition, { name: volume.partition, size: volume.partitionSize || 0, volumes: [] });
        groups.get(volume.partition).volumes.push(volume);
    }

    const segments = [...groups.values()].map((group, i) => ({
        name: group.name, size: group.size, shade: i % SHADES, usage: describeVolumes(group.volumes, t), mono: true,
    }));
    const unallocated = Math.max(0, (disk.size || 0) - sumBy(segments, "size"));
    if (disk.size > 0 && unallocated / disk.size > 0.01) {
        segments.push({ name: t("monitoring.details.storage.unallocated"), size: unallocated, shade: "free" });
    }
    return segments;
};

const Filesystem = ({ volume, t }) => {
    const layers = [...new Set((volume.layers || []).map(layerLabel).filter(Boolean))];
    const source = volume.partition !== volume.name
        ? t("monitoring.details.storage.on", { volume: volume.name, partition: volume.partition })
        : volume.name;

    return (
        <div className="filesystem">
            <div className="mon-row-head">
                <span className="mon-row-head__name mono">{volume.mountPoint}</span>
                {volume.type && <span className="mon-tag">{volume.type}</span>}
                {layers.map(layer => <span key={layer} className="mon-tag">{layer}</span>)}
                <span className="filesystem__percent">{volume.usagePercent ?? 0}%</span>
            </div>
            <Meter value={volume.usagePercent} label={volume.mountPoint} />
            <div className="filesystem__caption">
                <span>{t("monitoring.details.storage.usedOf", { used: formatBytes(volume.used), total: formatBytes(volume.size) })}</span>
                <span className="filesystem__source mono">{source}</span>
                <span>{t("monitoring.details.storage.free", { value: formatBytes(volume.available) })}</span>
            </div>
            {volume.inodesPercent != null && (
                <div className="filesystem__inodes">
                    <span>{t("monitoring.details.storage.inodes")}</span>
                    <Meter value={volume.inodesPercent} label={t("monitoring.details.storage.inodes")} />
                    <span className="filesystem__inodes-value">
                        {volume.inodesPercent}% · {t("monitoring.details.storage.inodesDetail", { used: compactNumber.format(volume.inodesUsed), total: compactNumber.format(volume.inodesTotal) })}
                    </span>
                </div>
            )}
        </div>
    );
};

const Disk = ({ disk, t }) => {
    const segments = getSegments(disk, t);
    const health = getHealth(disk, t);

    return (
        <section className="mon-card disk">
            <div className="disk__header">
                <div className="disk__heading">
                    <h4 className="mono">{diskPath(disk.name)}</h4>
                    {disk.rotational != null && <span className="mon-tag">{disk.rotational ? "HDD" : "SSD"}</span>}
                    {disk.model && <span className="disk__model">{disk.model}</span>}
                </div>
                {health && <StatusBadge state={HEALTH_BADGES[health.status]} label={t(`monitoring.details.storage.health.${health.status}`)} />}
                <span className="disk__size">{formatBytes(disk.size)}</span>
            </div>
            <div className="disk__map" aria-hidden="true">
                {segments.map(segment => (
                    <span key={segment.name} className={`disk__segment disk__segment--${segment.shade}`} style={{ flexGrow: Math.max(segment.size, 1) }} />
                ))}
            </div>
            <ul className="disk__legend">
                {segments.map(segment => (
                    <li key={segment.name}>
                        <span className={`disk__swatch disk__segment--${segment.shade}`} />
                        <span className={`disk__part${segment.mono ? " mono" : ""}`}>{segment.name}</span>
                        <span className="disk__usage mono">{segment.usage}</span>
                        <span className="disk__part-size">{formatBytes(segment.size)}</span>
                    </li>
                ))}
            </ul>
            {health?.facts.length > 0 && <FactList facts={health.facts} />}
        </section>
    );
};

export const StorageTab = ({ disks }) => {
    const { t } = useTranslation();
    const filesystems = useMemo(() => getFilesystems(disks || []), [disks]);

    if (!disks?.length) {
        return <EmptyState className="details-empty" icon={mdiHarddisk} description={t("monitoring.details.storage.noData")} />;
    }

    const total = sumBy(filesystems, "size");
    const used = sumBy(filesystems, "used");
    const percent = total > 0 ? Math.round((used / total) * 100) : null;
    const failing = disks.filter(disk => disk.health?.status === "failed").map(disk => diskPath(disk.name));

    return (
        <>
            {failing.length > 0 && (
                <StateNotice state="offline" icon={mdiAlertOutline} title={t("monitoring.details.storage.health.failedTitle")}
                             message={t("monitoring.details.storage.health.failedMessage", { disks: failing.join(", "), interpolation: { escapeValue: false } })} />
            )}
            {percent != null && (
                <div className="mon-card storage-summary">
                    <div className="storage-summary__head">
                        <span className="storage-summary__value">{percent}<span>%</span></span>
                        <div className="storage-summary__text">
                            <strong>{t("monitoring.details.storage.usedOf", { used: formatBytes(used), total: formatBytes(total) })}</strong>
                            <span>{t("monitoring.details.storage.free", { value: formatBytes(sumBy(filesystems, "available")) })}</span>
                        </div>
                    </div>
                    <Meter value={percent} label={t("monitoring.details.storage.title")} />
                </div>
            )}

            <SectionHeading title={t("monitoring.details.storage.filesystems")} count={filesystems.length} />
            {filesystems.length > 0 ? (
                <div className="mon-card mon-card--list">
                    {filesystems.map(volume => <Filesystem key={volume.mountPoint} volume={volume} t={t} />)}
                </div>
            ) : <EmptyState compact icon={mdiHarddisk} description={t("monitoring.details.storage.noPartitions")} />}

            <SectionHeading title={t("monitoring.details.storage.disks")} count={disks.length} />
            {disks.map((disk, i) => <Disk key={disk.name || i} disk={disk} t={t} />)}
        </>
    );
};
