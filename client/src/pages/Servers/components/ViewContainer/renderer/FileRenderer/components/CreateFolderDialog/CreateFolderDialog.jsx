import { DialogProvider } from "@/common/components/Dialog";
import { useEffect, useState } from "react";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFolder } from "@mdi/js";
import "./styles.sass";

export const CreateFolderDialog = ({ open, onclose, createFolder }) => {

    const [folderName, setFolderName] = useState("");

    const create = () => {
        if (folderName === "") return;
        if (folderName.includes("/")) return;

        createFolder(folderName);
        onclose();
    }

    useEffect(() => {
        if (open) setFolderName("");
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onclose}>
            <div className="folder-dialog">
                <h2>Create Folder</h2>
                <IconInput icon={mdiFolder} placeholder="Folder Name" value={folderName} setValue={setFolderName} />
                <div className="btn-actions">
                    <Button onClick={create} text="Create Folder" />
                </div>
            </div>
        </DialogProvider>
    );
};