import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import { mdiDownload, mdiTrashCan, mdiClose } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { Button } from "@/common/components/Button/Button";

export const SelectionActionBar = ({ selectedItems, onClearSelection, onDownload, onDelete, containerRef }) => {
    const { t } = useTranslation();
    const count = selectedItems.length;

    const portalTarget = containerRef?.current?.closest('.file-manager');

    const label = useMemo(() => {
        if (count === 0) return "";
        const hasFiles = selectedItems.some(item => item.type === "file");
        const hasFolders = selectedItems.some(item => item.type === "folder");
        const key = hasFiles && hasFolders ? "itemsSelected" : hasFolders ? "foldersSelected" : "filesSelected";
        return t(`servers.fileManager.selection.${key}`, { count });
    }, [count, selectedItems, t]);

    if (count === 0 || !portalTarget) return null;

    return createPortal(
        <div className="selection-action-bar">
            <Button icon={mdiClose} onClick={onClearSelection} />
            <span className="selection-count">{label}</span>
            <Button icon={mdiDownload} text={t("servers.fileManager.selection.download")} onClick={onDownload} />
            <Button icon={mdiTrashCan} text={t("servers.fileManager.selection.delete")} type="danger" onClick={onDelete} />
        </div>,
        portalTarget
    );
};