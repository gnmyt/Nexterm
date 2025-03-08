import "./styles.sass";
import { mdiPencil, mdiTrashCan } from "@mdi/js";
import Icon from "@mdi/react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";

export const SnippetsList = ({ snippets, onEdit }) => {
    const { loadSnippets } = useSnippets();
    const { sendToast } = useToast();

    const handleDeleteSnippet = async (id, event) => {
        event.stopPropagation();
        try {
            await deleteRequest(`snippets/${id}`);
            sendToast("Success", "Snippet deleted successfully");
            loadSnippets();
        } catch (error) {
            sendToast("Error", error.message || "Failed to delete snippet");
        }
    };

    const handleEditSnippet = (id, event) => {
        event.stopPropagation();
        onEdit(id);
    };

    if (!snippets || snippets.length === 0) {
        return (
            <div className="empty-snippets">
                <p>You don't have any snippets yet. Create your first one!</p>
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
                                    title="Edit snippet">
                                <Icon path={mdiPencil} />
                            </button>
                            <button className="action-button delete" onClick={(e) => handleDeleteSnippet(snippet.id, e)}
                                    title="Delete snippet">
                                <Icon path={mdiTrashCan} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};