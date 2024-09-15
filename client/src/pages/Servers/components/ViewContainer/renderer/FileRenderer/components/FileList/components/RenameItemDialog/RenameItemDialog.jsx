import Button from "@/common/components/Button";
import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiFile, mdiFolder } from "@mdi/js";
import { useEffect, useState } from "react";
import "./styles.sass";

export const RenameItemDialog = ({ open, closeDialog, renameItem, item }) => {
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
                <h2>Rename Item</h2>
                <IconInput
                    icon={item?.type === "folder" ? mdiFolder : mdiFile}
                    placeholder="New Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
                <div className="action-area">
                    <Button onClick={closeDialog} color="secondary" text="Cancel" />
                    <Button onClick={handleRename} color="primary" text="Rename" />
                </div>
            </div>
        </DialogProvider>
    );
}