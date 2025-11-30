import "./styles.sass";
import { mdiPencil, mdiTrashCan, mdiChevronLeft, mdiChevronRight, mdiCloudDownloadOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useScripts } from "@/common/contexts/ScriptContext.jsx";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import Button from "@/common/components/Button";

export const ScriptsList = ({ scripts, onEdit, selectedOrganization, isReadOnly = false }) => {
    const { t } = useTranslation();
    const { loadScripts, loadAllScripts } = useScripts();
    const { sendToast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const totalPages = useMemo(() => Math.ceil((scripts?.length || 0) / itemsPerPage), [scripts, itemsPerPage]);

    const paginatedScripts = useMemo(() => {
        if (!scripts) return [];
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return scripts.slice(startIndex, endIndex);
    }, [scripts, currentPage, itemsPerPage]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleDeleteScript = async (id, event) => {
        event.stopPropagation();
        try {
            const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
            await deleteRequest(`scripts/${id}${queryParams}`);
            sendToast("Success", t('scripts.messages.success.deleted'));
            if (selectedOrganization) {
                await loadScripts(selectedOrganization);
            } else {
                await loadScripts();
            }
            await loadAllScripts();
        } catch (error) {
            sendToast("Error", error.message || t('scripts.messages.errors.deleteFailed'));
        }
    };

    const handleEditScript = (id, event) => {
        event.stopPropagation();
        onEdit(id);
    };

    if (!scripts || scripts.length === 0) {
        return (
            <div className="scripts-list-container">
                <div className="empty-scripts">
                    <p>{t('scripts.list.empty')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="scripts-list-container">
            <div className="script-grid">
                {paginatedScripts.map(script => (
                    <div className={`script-item ${isReadOnly ? 'read-only' : ''}`} key={script.id}>
                        <div className="script-info">
                            <div className="script-header">
                                <h3>{script.name}</h3>
                                {script.sourceId && (
                                    <Icon path={mdiCloudDownloadOutline} size={0.65} className="source-badge" title="From external source" />
                                )}
                            </div>
                            {script.description && <p>{script.description}</p>}
                            <div className="script-preview">
                                <pre>{script.content?.substring(0, 150)}{script.content?.length > 150 ? '...' : ''}</pre>
                            </div>
                        </div>
                        {!isReadOnly && (
                            <div className="script-actions">
                                <button className="action-button" onClick={(e) => handleEditScript(script.id, e)}
                                        title={t('scripts.list.actions.edit')}>
                                    <Icon path={mdiPencil} />
                                </button>
                                <button className="action-button delete" onClick={(e) => handleDeleteScript(script.id, e)}
                                        title={t('scripts.list.actions.delete')}>
                                    <Icon path={mdiTrashCan} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {scripts.length > itemsPerPage && (
                <div className="pagination">
                    <div className="pagination-info">
                        {t('audit.pagination.showing', {
                            start: ((currentPage - 1) * itemsPerPage) + 1,
                            end: Math.min(currentPage * itemsPerPage, scripts.length),
                            total: scripts.length
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
