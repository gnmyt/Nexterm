import "./styles.sass";
import { mdiPencil, mdiTrashCan, mdiChevronLeft, mdiChevronRight, mdiCloudDownloadOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { deleteRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { useDrag, useDrop } from "react-dnd";
import Button from "@/common/components/Button";

const SnippetItem = ({ snippet, onEdit, onDelete, isReadOnly, onReposition, t }) => {
    const [{ isDragging }, drag] = useDrag({ type: "snippet", item: { id: snippet.id }, canDrag: !isReadOnly, collect: m => ({ isDragging: m.isDragging() }) });
    const [{ isOver }, drop] = useDrop({ accept: "snippet", drop: item => item.id !== snippet.id && onReposition(item.id, snippet.id), collect: m => ({ isOver: m.isOver() && m.getItem()?.id !== snippet.id }) });

    return (
        <div className={`snippet-item${isReadOnly ? ' read-only' : ''}${isDragging ? ' dragging' : ''}${isOver ? ' drop-target' : ''}`} ref={node => !isReadOnly && drag(drop(node))}>
            <div className="snippet-info">
                <div className="snippet-header">
                    <h3>{snippet.name}</h3>
                    {snippet.sourceId && <Icon path={mdiCloudDownloadOutline} size={0.65} className="source-badge" />}
                </div>
                {snippet.description && <p>{snippet.description}</p>}
                <pre className="snippet-command">{snippet.command}</pre>
            </div>
            {!isReadOnly && (
                <div className="snippet-actions">
                    <button className="action-button" onClick={e => { e.stopPropagation(); onEdit(snippet.id); }} title={t('snippets.list.actions.edit')}><Icon path={mdiPencil} /></button>
                    <button className="action-button delete" onClick={e => { e.stopPropagation(); onDelete(snippet.id); }} title={t('snippets.list.actions.delete')}><Icon path={mdiTrashCan} /></button>
                </div>
            )}
        </div>
    );
};

export const SnippetsList = ({ snippets, onEdit, selectedOrganization, isReadOnly = false }) => {
    const { t } = useTranslation();
    const { loadAllSnippets } = useSnippets();
    const { sendToast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const totalPages = useMemo(() => Math.ceil((snippets?.length || 0) / itemsPerPage), [snippets]);
    const paginatedSnippets = useMemo(() => snippets?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [], [snippets, currentPage]);
    const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';

    const handleDelete = async (id) => {
        try {
            await deleteRequest(`snippets/${id}${queryParams}`);
            sendToast("Success", t('snippets.messages.success.deleted'));
            await loadAllSnippets();
        } catch (e) { sendToast("Error", e.message || t('snippets.messages.errors.deleteFailed')); }
    };

    const handleReposition = async (sourceId, targetId) => {
        try {
            await patchRequest(`snippets/${sourceId}/reposition${queryParams}`, { targetId });
            await loadAllSnippets();
        } catch (e) { sendToast("Error", e.message || t('snippets.messages.errors.reorderFailed')); }
    };

    if (!snippets?.length) return <div className="snippets-list-container"><div className="empty-snippets"><p>{t('snippets.list.empty')}</p></div></div>;

    return (
        <div className="snippets-list-container">
            <div className="snippet-grid">
                {paginatedSnippets.map(s => <SnippetItem key={s.id} snippet={s} onEdit={onEdit} onDelete={handleDelete} isReadOnly={isReadOnly} onReposition={handleReposition} t={t} />)}
            </div>
            {snippets.length > itemsPerPage && (
                <div className="pagination">
                    <div className="pagination-info">{t('audit.pagination.showing', { start: (currentPage - 1) * itemsPerPage + 1, end: Math.min(currentPage * itemsPerPage, snippets.length), total: snippets.length })}</div>
                    <div className="pagination-controls">
                        <Button text={t('audit.pagination.previous')} icon={mdiChevronLeft} onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)} disabled={currentPage <= 1} type="secondary" />
                        <span className="page-info">{t('audit.pagination.pageInfo', { current: currentPage, total: totalPages })}</span>
                        <Button text={t('audit.pagination.next')} icon={mdiChevronRight} onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages} type="secondary" />
                    </div>
                </div>
            )}
        </div>
    );
};