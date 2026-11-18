import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { mdiChartLine } from "@mdi/js";
import EmptyState from "@/common/components/EmptyState";
import { EMPTY, useThemeColors } from "../../../shared";
import "./MonitoringChart.sass";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const FONT_FAMILY = "\"Plus Jakarta Sans\", sans-serif";

const withAlpha = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const crosshairPlugin = {
    id: "monitoringCrosshair",
    afterDatasetsDraw: (chart, _args, options) => {
        const active = chart.tooltip?.getActiveElements?.();
        if (!active?.length) return;
        const { ctx, chartArea: { top, bottom } } = chart;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(active[0].element.x, top);
        ctx.lineTo(active[0].element.x, bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = options.color;
        ctx.stroke();
        ctx.restore();
    },
};

export const MonitoringChart = ({ data, title, dataKey, unit = "%", yAxisMax }) => {
    const { t } = useTranslation();
    const colors = useThemeColors();

    const sortedData = useMemo(() => {
        const sorted = [...(data || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return sorted.some(item => item[dataKey] != null) ? sorted : [];
    }, [data, dataKey]);

    const chartData = useMemo(() => ({
        labels: sortedData.map(item => new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })),
        datasets: [{
            label: title,
            data: sortedData.map(item => item[dataKey]),
            borderColor: colors.primary,
            backgroundColor: (context) => {
                const { ctx, chartArea } = context.chart;
                if (!chartArea) return withAlpha(colors.primary, 12);
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, withAlpha(colors.primary, 28));
                gradient.addColorStop(1, withAlpha(colors.primary, 0));
                return gradient;
            },
            fill: true, tension: 0.3, borderWidth: 2, spanGaps: true,
            pointRadius: 0, pointHoverRadius: 4,
            pointHoverBackgroundColor: colors.primary, pointHoverBorderColor: colors.surface, pointHoverBorderWidth: 2,
        }],
    }), [sortedData, dataKey, title, colors]);

    const options = useMemo(() => {
        const tickFont = { family: FONT_FAMILY, size: 11, weight: 500 };
        return {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { intersect: false, mode: "index" },
            plugins: {
                legend: { display: false },
                monitoringCrosshair: { color: colors.border },
                tooltip: {
                    backgroundColor: colors.surface, titleColor: colors.subtext, bodyColor: colors.text,
                    borderColor: colors.border, borderWidth: 1, cornerRadius: 8, padding: 10, displayColors: false,
                    titleFont: tickFont,
                    bodyFont: { family: FONT_FAMILY, size: 13, weight: 600 },
                    callbacks: {
                        title: (ctx) => ctx[0]?.dataIndex != null ? new Date(sortedData[ctx[0].dataIndex].timestamp).toLocaleString() : "",
                        label: (ctx) => `${title}: ${ctx.parsed.y != null ? `${ctx.parsed.y}${unit}` : EMPTY}`,
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: colors.subtext, font: tickFont, autoSkip: true, maxTicksLimit: 8, maxRotation: 0 },
                    grid: { display: false }, border: { display: false },
                },
                y: {
                    beginAtZero: true, max: yAxisMax,
                    ticks: { color: colors.subtext, font: tickFont, maxTicksLimit: 6, precision: 0, callback: value => `${value}${unit}` },
                    grid: { color: colors.grid }, border: { display: false },
                },
            },
        };
    }, [sortedData, title, unit, yAxisMax, colors]);

    const latestValue = sortedData.length ? sortedData[sortedData.length - 1][dataKey] : null;

    return (
        <div className="mon-card monitoring-chart">
            <div className="chart-header">
                <h3 className="chart-title">{title}</h3>
                {latestValue != null && <span className="chart-value">{latestValue}{unit && <span className="chart-unit">{unit}</span>}</span>}
            </div>
            {sortedData.length ? (
                <div className="chart-container"><Line data={chartData} options={options} plugins={[crosshairPlugin]} /></div>
            ) : (
                <EmptyState compact icon={mdiChartLine} description={t("monitoring.details.charts.noData")} />
            )}
        </div>
    );
};
