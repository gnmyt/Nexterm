import "./styles.sass";
import { useState } from "react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import SnippetsList from "@/pages/Snippets/components/SnippetsList";
import SnippetDialog from "@/pages/Snippets/components/SnippetDialog";
import Button from "@/common/components/Button";
import PageHeader from "@/common/components/PageHeader";
import { mdiCodeBrackets, mdiPlus } from "@mdi/js";
import { useTranslation } from "react-i18next";

export const Snippets = () => {
    const { t } = useTranslation();
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
            <PageHeader icon={mdiCodeBrackets} title={t('snippets.page.title')}
                        subtitle={t('snippets.page.subtitle')}>
                <Button text={t('snippets.page.addSnippet')} icon={mdiPlus} onClick={openCreateDialog} />
            </PageHeader>

            <SnippetsList snippets={snippets} onEdit={openEditDialog} />

            <SnippetDialog open={dialogOpen} onClose={closeDialog} editSnippetId={editSnippetId} />
        </div>
    );
};