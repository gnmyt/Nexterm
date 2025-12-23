import "./styles.sass";
import { mdiPencil, mdiTrashCan, mdiChevronLeft, mdiChevronRight, mdiCloudDownloadOutline, mdiLinux } from "@mdi/js";
import Icon from "@mdi/react";
import { useScripts } from "@/common/contexts/ScriptContext.jsx";
import { deleteRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { useDrag, useDrop } from "react-dnd";
import Button from "@/common/components/Button";
import { parseOsFilter } from "@/common/utils/osUtils.js";

const ScriptItem = ({ script, onEdit, onDelete, isReadOnly, onReposition, t }) => {
    const [{ isDragging }, drag] = useDrag({ type: "script", item: { id: script.id }, canDrag: !isReadOnly, collect: m => ({ isDragging: m.isDragging() }) });
    const [{ isOver }, drop] = useDrop({ accept: "script", drop: item => item.id !== script.id && onReposition(item.id, script.id), collect: m => ({ isOver: m.isOver() && m.getItem()?.id !== script.id }) });
    const osFilter = parseOsFilter(script.osFilter);

    return (
        <div className={`script-item${isReadOnly ? ' read-only' : ''}${isDragging ? ' dragging' : ''}${isOver ? ' drop-target' : ''}`} ref={node => !isReadOnly && drag(drop(node))}>
            <div className="script-info">
                <div className="script-header">
                    <h3>{script.name}</h3>
                    <div className="script-badges">
                        {osFilter.length > 0 && (
                            <span className="os-badge" title={osFilter.join(", ")}>
                                <Icon path={mdiLinux} size={0.5} />
                                {osFilter.length === 1 ? osFilter[0] : `${osFilter.length} OS`}
                            </span>
                        )}
                        {script.sourceId && <Icon path={mdiCloudDownloadOutline} size={0.65} className="source-badge" />}
                    </div>
                </div>
                {script.description && <p>{script.description}</p>}
                <div className="script-preview"><pre>{script.content?.substring(0, 150)}{script.content?.length > 150 ? '...' : ''}</pre></div>
            </div>
            {!isReadOnly && (
                <div className="script-actions">
                    <button className="action-button" onClick={e => { e.stopPropagation(); onEdit(script.id); }} title={t('scripts.list.actions.edit')}><Icon path={mdiPencil} /></button>
                    <button className="action-button delete" onClick={e => { e.stopPropagation(); onDelete(script.id); }} title={t('scripts.list.actions.delete')}><Icon path={mdiTrashCan} /></button>
                </div>
            )}
        </div>
    );
};

export const ScriptsList = ({ scripts, onEdit, selectedOrganization, isReadOnly = false }) => {
    const { t } = useTranslation();
    const { loadScripts, loadAllScripts } = useScripts();
    const { sendToast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const totalPages = useMemo(() => Math.ceil((scripts?.length || 0) / itemsPerPage), [scripts]);
    const paginatedScripts = useMemo(() => scripts?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [], [scripts, currentPage]);
    const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
    const reload = async () => { await loadScripts(selectedOrganization || undefined); await loadAllScripts(); };

    const handleDelete = async (id) => {
        try {
            await deleteRequest(`scripts/${id}${queryParams}`);
            sendToast("Success", t('scripts.messages.success.deleted'));
            await reload();
        } catch (e) { sendToast("Error", e.message || t('scripts.messages.errors.deleteFailed')); }
    };

    const handleReposition = async (sourceId, targetId) => {
        try {
            await patchRequest(`scripts/${sourceId}/reposition${queryParams}`, { targetId });
            await reload();
        } catch (e) { sendToast("Error", e.message || t('scripts.messages.errors.reorderFailed')); }
    };

    if (!scripts?.length) return <div className="scripts-list-container"><div className="empty-scripts"><p>{t('scripts.list.empty')}</p></div></div>;

    return (
        <div className="scripts-list-container">
            <div className="script-grid">
                {paginatedScripts.map(s => <ScriptItem key={s.id} script={s} onEdit={onEdit} onDelete={handleDelete} isReadOnly={isReadOnly} onReposition={handleReposition} t={t} />)}
            </div>
            {scripts.length > itemsPerPage && (
                <div className="pagination">
                    <div className="pagination-info">{t('audit.pagination.showing', { start: (currentPage - 1) * itemsPerPage + 1, end: Math.min(currentPage * itemsPerPage, scripts.length), total: scripts.length })}</div>
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
