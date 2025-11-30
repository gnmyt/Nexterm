import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { mdiTable, mdiClose, mdiContentCopy, mdiFileExport } from "@mdi/js";
import Icon from "@mdi/react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "./TableDialog.sass";

const TableDialog = ({ open, onClose, tableData }) => {
    const { sendToast } = useToast();

    if (!tableData) return null;

    const parseDataToTable = (data) => {
        if (!data || data.length === 0) return { headers: [], rows: [] };

        const headers = data[0].split(",").map(h => h.trim());
        const rows = [];

        for (let i = 1; i < data.length; i++) {
            const rowData = data[i].split(",").map(cell => cell.trim());
            while (rowData.length < headers.length) rowData.push("");

            if (rowData.length > 0) rows.push(rowData.slice(0, headers.length));
        }

        return { headers, rows };
    };

    const { headers, rows } = parseDataToTable(tableData.data || []);

    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            sendToast("Copied", `${label} copied to clipboard`);
        } catch (err) {
            sendToast("Error", `Failed to copy ${label} to clipboard`);
        }
    };

    const copyTableAsCSV = () => {
        const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        copyToClipboard(csvContent, "Table data (CSV)");
    };

    const copyTableAsText = () => {
        const maxWidths = headers.map((header, index) => {
            const headerWidth = header.length;
            const columnWidth = Math.max(...rows.map(row => (row[index] || "").length));
            return Math.max(headerWidth, columnWidth);
        });

        const createRow = (data) => {
            return "| " + data.map((cell, index) => {
                const width = maxWidths[index];
                return (cell || "").padEnd(width);
            }).join(" | ") + " |";
        };

        const separator = "|" + maxWidths.map(width => "-".repeat(width + 2)).join("|") + "|";

        const textContent = [createRow(headers), separator, ...rows.map(createRow)].join("\n");

        copyToClipboard(textContent, "Table data (formatted text)");
    };

    return (
        <DialogProvider open={open} onClose={onClose} maxWidth="800px">
            <div className="table-dialog">
                <div className="dialog-title">
                    <Icon path={mdiTable} />
                    <h2>{tableData.title}</h2>
                </div>

                <div className="table-content">
                    {headers.length > 0 && rows.length > 0 ? (
                        <div className="table-container">
                            <table className="nexterm-table">
                                <thead>
                                <tr>
                                    {headers.map((header, index) => (
                                        <th key={index}>{header}</th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {rows.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {headers.map((_, cellIndex) => (
                                            <td key={cellIndex}>
                                                {row[cellIndex] || ""}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-data">
                            <p>No table data available</p>
                        </div>
                    )}
                </div>

                <div className="dialog-actions">
                    {headers.length > 0 && rows.length > 0 && (
                        <>
                            <Button onClick={copyTableAsText} text="Copy as Text" icon={mdiContentCopy}
                                    type="secondary" />
                            <Button onClick={copyTableAsCSV} text="Copy as CSV" icon={mdiFileExport}
                                    type="secondary" />
                        </>
                    )}
                    <Button onClick={onClose} text="Close" icon={mdiClose} />
                </div>
            </div>
        </DialogProvider>
    );
};

export default TableDialog;
