import { useMemo } from "react";
import Icon from "@mdi/react";
import { mdiChevronLeft, mdiChevronRight, mdiInformationOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const PaginatedTable = ({
                                   data = [],
                                   columns = [],
                                   pagination,
                                   onPageChange,
                                   renderRow,
                                   onRowClick,
                                   getRowKey = (item, index) => item.id ?? index,
                                   loading = false,
                                   emptyState = {},
                                   className = "",
                               }) => {
    const { t } = useTranslation();

    const totalPages = useMemo(() =>
            Math.ceil(pagination.total / pagination.itemsPerPage),
        [pagination.total, pagination.itemsPerPage],
    );

    if (data.length === 0 && !loading) {
        return (
            <div className={`paginated-table-container ${className}`}>
                <div className="no-data">
                    <Icon path={emptyState.icon || mdiInformationOutline} />
                    <h3>{emptyState.title || t("common.table.noData.title")}</h3>
                    <p>{emptyState.subtitle || t("common.table.noData.subtitle")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`paginated-table-container ${className}`}>
            <div className="paginated-table">
                <div className="table-header" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                    {columns.map((column) => (
                        <div key={column.key} className={`header-cell ${column.className || ""}`}>
                            {column.icon && <Icon path={column.icon} />}
                            <span>{column.label}</span>
                        </div>
                    ))}
                </div>

                <div className="table-body">
                    {data.map((item, index) => {
                        const key = getRowKey(item, index);

                        if (renderRow) {
                            return renderRow(item, index, key);
                        }

                        return (
                            <div
                                key={key}
                                className={`table-row ${onRowClick ? "clickable" : ""}`}
                                onClick={() => onRowClick?.(item)}
                                style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
                            >
                                {columns.map((column) => (
                                    <div
                                        key={column.key}
                                        className={`cell ${column.className || ""}`}
                                        data-label={column.mobileLabel || ""}
                                    >
                                        {column.render ? column.render(item) : item[column.key]}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {data.length > 0 && (
                <div className="pagination">
                    <div className="pagination-info">
                        {t("common.table.pagination.showing", {
                            start: ((pagination.currentPage - 1) * pagination.itemsPerPage) + 1,
                            end: Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.total),
                            total: pagination.total,
                        })}
                    </div>

                    <div className="pagination-controls">
                        <Button
                            text={t("common.table.pagination.previous")}
                            icon={mdiChevronLeft}
                            onClick={() => onPageChange(pagination.currentPage - 1)}
                            disabled={pagination.currentPage <= 1}
                            type="secondary"
                        />

                        <span className="page-info">
                            {t("common.table.pagination.pageInfo", {
                                current: pagination.currentPage,
                                total: totalPages,
                            })}
                        </span>

                        <Button
                            text={t("common.table.pagination.next")}
                            icon={mdiChevronRight}
                            onClick={() => onPageChange(pagination.currentPage + 1)}
                            disabled={pagination.currentPage >= totalPages}
                            type="secondary"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};