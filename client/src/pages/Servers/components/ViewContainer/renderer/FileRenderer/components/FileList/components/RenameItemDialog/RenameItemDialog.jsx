import Button from "@/common/components/Button";
import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiFile, mdiFolder } from "@mdi/js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const RenameItemDialog = ({ open, closeDialog, renameItem, item }) => {
    const { t } = useTranslation();
    const [newName, setNewName] = useState(item?.name || "");

    const handleRename = () => {
        renameItem(newName);
        closeDialog();
    };

    useEffect(() => {
        setNewName(item?.name || "");
    }, [item]);

    return (
        <DialogProvider open={open} onClose={closeDialog}>
            <div className="rename-item-dialog">
                <h2>{t('servers.fileManager.renameItem.title')}</h2>
                <IconInput
                    icon={item?.type === "folder" ? mdiFolder : mdiFile}
                    placeholder={t('servers.fileManager.renameItem.placeholder')}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
                <div className="action-area">
                    <Button onClick={closeDialog} color="secondary" text={t('common.cancel')} />
                    <Button onClick={handleRename} color="primary" text={t('servers.fileManager.renameItem.button')} />
                </div>
            </div>
        </DialogProvider>
    );
}