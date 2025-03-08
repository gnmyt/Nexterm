import "./styles.sass";
import { useState } from "react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import SnippetsList from "@/pages/Snippets/components/SnippetsList";
import SnippetDialog from "@/pages/Snippets/components/SnippetDialog";
import Button from "@/common/components/Button";
import { mdiCodeBrackets, mdiPlus } from "@mdi/js";
import Icon from "@mdi/react";

export const Snippets = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editSnippetId, setEditSnippetId] = useState(null);
    const { snippets } = useSnippets();

    const openCreateDialog = () => {
        setEditSnippetId(null);
        setDialogOpen(true);
    };

    const openEditDialog = (id) => {
        setEditSnippetId(id);
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditSnippetId(null);
    };

    return (
        <div className="snippets-page">
            <div className="snippets-header">
                <div className="snippets-title">
                    <Icon path={mdiCodeBrackets} size={2} />
                    <div className="header-left">
                        <h1>Snippets</h1>
                        <p>Manage your command snippets for quick access in terminals</p>
                    </div>
                </div>

                <Button text="Add Snippet" icon={mdiPlus} onClick={openCreateDialog} />
            </div>

            <div className="snippets-content">
                <SnippetsList snippets={snippets} onEdit={openEditDialog} />
            </div>

            <SnippetDialog open={dialogOpen} onClose={closeDialog} editSnippetId={editSnippetId} />
        </div>
    );
};