import "./styles.sass";
import { mdiPencil, mdiTrashCan, mdiChevronLeft, mdiChevronRight } from "@mdi/js";
import Icon from "@mdi/react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import Button from "@/common/components/Button";

export const SnippetsList = ({ snippets, onEdit, selectedOrganization }) => {
    const { t } = useTranslation();
    const { loadAllSnippets } = useSnippets();
    const { sendToast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const totalPages = useMemo(() => Math.ceil((snippets?.length || 0) / itemsPerPage), [snippets, itemsPerPage]);

    const paginatedSnippets = useMemo(() => {
        if (!snippets) return [];
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return snippets.slice(startIndex, endIndex);
    }, [snippets, currentPage, itemsPerPage]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleDeleteSnippet = async (id, event) => {
        event.stopPropagation();
        try {
            const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
            await deleteRequest(`snippets/${id}${queryParams}`);
            sendToast("Success", t('snippets.messages.success.deleted'));

            await loadAllSnippets();
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
            <div className="snippets-list-container">
                <div className="empty-snippets">
                    <p>{t('snippets.list.empty')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="snippets-list-container">
            <div className="snippet-grid">
                {paginatedSnippets.map(snippet => (
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

            {snippets.length > itemsPerPage && (
                <div className="pagination">
                    <div className="pagination-info">
                        {t('audit.pagination.showing', {
                            start: ((currentPage - 1) * itemsPerPage) + 1,
                            end: Math.min(currentPage * itemsPerPage, snippets.length),
                            total: snippets.length
                        })}
                    </div>

                    <div className="pagination-controls">
                        <Button
                            text={t('audit.pagination.previous')}
                            icon={mdiChevronLeft}
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            type="secondary"
                        />

                        <span className="page-info">
                            {t('audit.pagination.pageInfo', {
                                current: currentPage,
                                total: totalPages
                            })}
                        </span>

                        <Button
                            text={t('audit.pagination.next')}
                            icon={mdiChevronRight}
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            type="secondary"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};