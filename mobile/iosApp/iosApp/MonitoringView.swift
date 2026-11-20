import SwiftUI
import Charts
import NextermKit

func usageColor(_ percent: Double) -> Color {
    let level = Formatters.shared.usageLevel(percent: percent)
    return level == UsageLevel.critical ? NX.error : level == UsageLevel.warning ? NX.warning : accent
}

func stateColor(_ state: MonitoringState) -> Color {
    switch state {
    case .online: NX.success
    case .offline: NX.error
    case .error: NX.warning
    default: NX.subtext
    }
}

func stateSymbol(_ state: MonitoringState) -> String {
    switch state {
    case .offline: "bolt.horizontal.circle"
    case .error: "exclamationmark.triangle"
    case .pending: "clock"
    default: "questionmark.circle"
    }
}

func wholePercent(_ value: Double) -> String { Formatters.shared.wholePercent(value: KotlinDouble(value: value)) }

struct MonitoringView: View {
    private let ctrl = app.monitoring
    @State private var servers = FlowState(app.monitoring.servers, or: [MonitoringServer]())
    @State private var visible = FlowState(app.monitoring.visibleServers, or: [MonitoringServer]())
    @State private var loading = FlowState(app.monitoring.isLoading, or: true)
    @State private var error = FlowState(app.monitoring.error, or: nil as String?)
    @State private var filter = FlowState(app.monitoring.filter, or: MonitoringFilter.all)
    @State private var query = FlowState(app.monitoring.query, or: "")
    @State private var selection: String?
    @State private var column = NavigationSplitViewColumn.sidebar
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        NavigationSplitView(preferredCompactColumn: $column) {
            List {
                if !servers.value.isEmpty {
                    Picker("Filter", selection: filter.binding { ctrl.setFilter(filter: $0) }) {
                        ForEach([MonitoringFilter.all, .online, .issues], id: \.self) { Text(ctrl.filterLabel(filter: $0)).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                ForEach(visible.value, id: \.id) { server in
                    let selected = sizeClass == .regular && server.id == selection
                    Section {
                        Button {
                            selection = server.id
                            column = .detail
                        } label: {
                            HStack(spacing: 8) {
                                MonitoringRow(server: server)
                                if sizeClass == .compact { Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                        .listRowBackground(selected ? accentSoft : NX.surface)
                    }
                }
            }
            .listSectionSpacing(12)
            .brandedList()
            .overlay {
                if loading.value && servers.value.isEmpty {
                    ProgressView()
                } else if let message = error.value, servers.value.isEmpty {
                    ContentUnavailableView {
                        Label("Failed to Load Monitoring Data", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Retry") { Task { try? await ctrl.load(silent: false) } }.buttonStyle(.borderedProminent)
                    }
                } else if servers.value.isEmpty {
                    ContentUnavailableView("No Monitoring Data", systemImage: "chart.bar", description: Text("Enable monitoring from the web dashboard"))
                } else if visible.value.isEmpty {
                    ContentUnavailableView.search(text: query.value)
                }
            }
            .searchable(text: query.binding { ctrl.setQuery(query: $0) }, prompt: "Search servers")
            .refreshable { try? await ctrl.load(silent: true) }
            .navigationTitle("Monitoring")
        } detail: {
            if let server = servers.value.first(where: { $0.id == selection }) {
                MonitoringDetailView(server: server).id(server.id)
            } else {
                ContentUnavailableView("No Server Selected", systemImage: "chart.bar")
            }
        }
        .task(id: selection) {
            if let server = servers.value.first(where: { $0.id == selection }) { try? await ctrl.select(server: server) } else { _ = ctrl.clearSelection() }
        }
        .onAppear { ctrl.start() }
        .onDisappear { ctrl.stop() }
    }
}

struct IssueLabel: View {
    let server: MonitoringServer

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            IconTile(symbol: stateSymbol(server.state), color: stateColor(server.state), size: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(server.state.title).font(.subheadline.weight(.semibold))
                Text(server.issueMessage).font(.footnote).foregroundStyle(.secondary).lineLimit(3)
                if let meta = server.issueMeta { Text(meta).font(.caption).foregroundStyle(.tertiary) }
            }
        }
    }
}

private struct MonitoringRow: View {
    let server: MonitoringServer

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ServerTile(symbol: sfSymbol(IconKeys.shared.monitoringServer(server: server)), color: server.isPve ? NX.proxmox : accentFill, offline: !server.isOnline, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text(server.name).font(.headline).lineLimit(1)
                    Text(server.address).mono(.footnote).foregroundStyle(NX.subtext).lineLimit(1)
                }
                Spacer(minLength: 0)
                Circle().fill(stateColor(server.state)).frame(width: 9, height: 9).accessibilityLabel(server.state.label)
            }
            if server.isOnline {
                HStack(spacing: 20) {
                    UsageMetric(label: "CPU", value: server.cpuUsage?.doubleValue, history: server.cpuHistory.map(\.doubleValue))
                    UsageMetric(label: "Memory", value: server.memoryUsage?.doubleValue, history: server.memoryHistory.map(\.doubleValue))
                }
                HStack(spacing: 12) {
                    ForEach(server.facts, id: \.label) { fact in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(fact.label).font(.caption2).foregroundStyle(.secondary)
                            Text(fact.value).font(.footnote.weight(.semibold)).monospacedDigit()
                        }
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            } else {
                IssueLabel(server: server)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct UsageMetric: View {
    let label: String
    let value: Double?
    let history: [Double]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(label).font(.caption).foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Text(value.map(wholePercent) ?? Formatters.shared.EMPTY).font(.title3.weight(.semibold)).monospacedDigit()
            }
            Sparkline(values: history, color: usageColor(value ?? 0))
        }
        .frame(maxWidth: .infinity)
    }
}

struct Sparkline: View {
    let values: [Double]
    let color: Color

    var body: some View {
        Chart(Array(values.enumerated()), id: \.offset) { point in
            AreaMark(x: .value("Index", point.offset), y: .value("Value", point.element))
                .foregroundStyle(LinearGradient(colors: [color.opacity(0.28), color.opacity(0)], startPoint: .top, endPoint: .bottom))
            LineMark(x: .value("Index", point.offset), y: .value("Value", point.element))
                .foregroundStyle(color)
                .lineStyle(StrokeStyle(lineWidth: 1.75, lineCap: .round, lineJoin: .round))
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: 0...max(100, values.max() ?? 100))
        .chartLegend(.hidden)
        .frame(height: 30)
        .accessibilityHidden(true)
    }
}
