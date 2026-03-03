import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import "./MonitoringChart.sass";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const DATA_KEYS = { cpu: "cpuUsage", memory: "memoryUsage", processes: "processes" };

export const MonitoringChart = ({ data, title, type = "cpu", color = "#314BD3", unit = "%", height = "300px", yAxisMax = null }) => {
    const { t } = useTranslation();

    const sortedData = useMemo(() => 
        [...(data || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)), 
    [data]);

    const formatTimestamp = (ts, idx) => {
        const date = new Date(ts);
        const len = sortedData.length;
        const interval = len > 200 ? Math.ceil(len / 15) : len > 100 ? Math.ceil(len / 12) : len > 60 ? 5 : len > 20 ? 3 : 1;
        if (idx % interval !== 0) return "";
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    };

    if (!sortedData.length) {
        return <div className="monitoring-chart no-data"><h4>{title}</h4><p>{t("monitoring.details.charts.noData")}</p></div>;
    }

    const chartData = {
        labels: sortedData.map((item, i) => formatTimestamp(item.timestamp, i)),
        datasets: [{
            label: title,
            data: sortedData.map(item => item[DATA_KEYS[type] || "cpuUsage"]),
            borderColor: color, backgroundColor: `${color}20`, fill: true,
            tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2,
        }],
    };

    const options = {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(13, 22, 30, 0.95)", titleColor: "#FFFFFF", bodyColor: "#B7B7B7",
                borderColor: "rgba(255, 255, 255, 0.1)", borderWidth: 1, cornerRadius: 8, displayColors: false,
                callbacks: {
                    title: (ctx) => ctx[0]?.dataIndex != null ? new Date(sortedData[ctx[0].dataIndex].timestamp).toLocaleString() : "",
                    label: (ctx) => `${title}: ${ctx.parsed.y ?? "N/A"}${unit}`,
                },
            },
        },
        scales: {
            x: { ticks: { color: "#B7B7B7", font: { size: 11 }, maxTicksLimit: 12, maxRotation: 45, minRotation: 0 }, grid: { color: "rgba(255, 255, 255, 0.05)", drawBorder: false }, border: { display: false } },
            y: { beginAtZero: true, max: yAxisMax, ticks: { color: "#B7B7B7", font: { size: 11 }, callback: v => v + unit }, grid: { color: "rgba(255, 255, 255, 0.05)", drawBorder: false }, border: { display: false } },
        },
    };

    return (
        <div className="monitoring-chart" style={{ height }}>
            <h4 className="chart-title">{title}</h4>
            <div className="chart-container"><Line data={chartData} options={options} /></div>
        </div>
    );
};
