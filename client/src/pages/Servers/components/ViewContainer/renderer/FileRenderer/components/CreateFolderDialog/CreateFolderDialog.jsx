import { DialogProvider } from "@/common/components/Dialog";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFolder } from "@mdi/js";
import "./styles.sass";

export const CreateFolderDialog = ({ open, onClose, createFolder }) => {
    const { t } = useTranslation();
    const [folderName, setFolderName] = useState("");

    const create = () => {
        if (folderName === "") return;
        if (folderName.includes("/")) return;

        createFolder(folderName);
        onClose();
    }

    useEffect(() => {
        if (open) setFolderName("");
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="folder-dialog">
                <h2>{t('servers.fileManager.createFolder.title')}</h2>
                <IconInput 
                    icon={mdiFolder} 
                    placeholder={t('servers.fileManager.createFolder.placeholder')} 
                    value={folderName} 
                    setValue={setFolderName} 
                />
                <div className="btn-actions">
                    <Button onClick={create} text={t('servers.fileManager.createFolder.button')} />
                </div>
            </div>
        </DialogProvider>
    );
};