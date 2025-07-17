import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import "./MonitoringChart.sass";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const MonitoringChart = ({
                             data,
                             title,
                             type = "cpu",
                             color = "#314BD3",
                             unit = "%",
                             height = "300px",
                             yAxisMax = null,
                         }) => {
    const { t } = useTranslation();

    if (!data || data.length === 0) {
        return (
            <div className="monitoring-chart no-data">
                <h4>{title}</h4>
                <p>{t('monitoring.details.charts.noData')}</p>
            </div>
        );
    }

    const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const getDataValue = (item) => {
        switch (type) {
            case "cpu":
                return item.cpuUsage;
            case "memory":
                return item.memoryUsage;
            case "processes":
                return item.processes;
            default:
                return item.cpuUsage;
        }
    };

    const formatTimestamp = (timestamp, index) => {
        const date = new Date(timestamp);
        const totalPoints = sortedData.length;

        if (totalPoints > 60) {
            return index % 5 === 0 ? date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }) : "";
        } else if (totalPoints > 20) {
            return index % 3 === 0 ? date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }) : "";
        } else {
            return date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        }
    };

    const chartData = {
        labels: sortedData.map((item, index) => formatTimestamp(item.timestamp, index)),
        datasets: [
            {
                label: title,
                data: sortedData.map(item => getDataValue(item)),
                borderColor: color,
                backgroundColor: `${color}20`,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: "index",
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: "rgba(13, 22, 30, 0.95)",
                titleColor: "#FFFFFF",
                bodyColor: "#B7B7B7",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    title: function(context) {
                        if (context[0] && context[0].dataIndex !== undefined) {
                            const timestamp = sortedData[context[0].dataIndex].timestamp;
                            return new Date(timestamp).toLocaleString();
                        }
                        return "";
                    },
                    label: function(context) {
                        const value = context.parsed.y;
                        return `${title}: ${value !== null && value !== undefined ? value : "N/A"}${unit}`;
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: "#B7B7B7",
                    font: {
                        size: 11,
                    },
                    maxTicksLimit: 8,
                },
                grid: {
                    color: "rgba(255, 255, 255, 0.05)",
                    drawBorder: false,
                },
                border: {
                    display: false,
                },
            },
            y: {
                beginAtZero: true,
                max: yAxisMax,
                ticks: {
                    color: "#B7B7B7",
                    font: {
                        size: 11,
                    },
                    callback: (value) => value + unit,
                },
                grid: {
                    color: "rgba(255, 255, 255, 0.05)",
                    drawBorder: false,
                },
                border: {
                    display: false,
                },
            },
        },
    };

    return (
        <div className="monitoring-chart" style={{ height }}>
            <h4 className="chart-title">{title}</h4>
            <div className="chart-container">
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
};