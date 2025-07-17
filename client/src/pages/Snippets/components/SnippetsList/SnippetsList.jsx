import "./styles.sass";
import { mdiPencil, mdiTrashCan } from "@mdi/js";
import Icon from "@mdi/react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";

export const SnippetsList = ({ snippets, onEdit }) => {
    const { t } = useTranslation();
    const { loadSnippets } = useSnippets();
    const { sendToast } = useToast();

    const handleDeleteSnippet = async (id, event) => {
        event.stopPropagation();
        try {
            await deleteRequest(`snippets/${id}`);
            sendToast("Success", t('snippets.messages.success.deleted'));
            loadSnippets();
        } catch (error) {
            sendToast("Error", error.message || t('snippets.messages.errors.deleteFailed'));
        }
    };

    const handleEditSnippet = (id, event) => {
        event.stopPropagation();
        onEdit(id);
    };

    if (!snippets || snippets.length === 0) {
        return (
            <div className="empty-snippets">
                <p>{t('snippets.list.empty')}</p>
            </div>
        );
    }

    return (
        <div className="snippets-list">
            <div className="snippet-grid">
                {snippets.map(snippet => (
                    <div className="snippet-item" key={snippet.id}>
                        <div className="snippet-info">
                            <h3>{snippet.name}</h3>
                            {snippet.description && <p>{snippet.description}</p>}
                            <pre className="snippet-command">{snippet.command}</pre>
                        </div>
                        <div className="snippet-actions">
                            <button className="action-button" onClick={(e) => handleEditSnippet(snippet.id, e)}
                                    title={t('snippets.list.actions.edit')}>
                                <Icon path={mdiPencil} />
                            </button>
                            <button className="action-button delete" onClick={(e) => handleDeleteSnippet(snippet.id, e)}
                                    title={t('snippets.list.actions.delete')}>
                                <Icon path={mdiTrashCan} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};