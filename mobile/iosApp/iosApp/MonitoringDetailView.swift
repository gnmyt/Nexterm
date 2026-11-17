import SwiftUI
import Charts
import NextermKit

private enum DetailTab: String, Hashable {
    case overview = "Overview", storage = "Storage", network = "Network", processes = "Processes", nodes = "Nodes"
}

struct MonitoringDetailView: View {
    let server: MonitoringServer
    private let ctrl = app.monitoring
    @State private var details = FlowState(app.monitoring.details, or: nil as MonitoringDetails?)
    @State private var failed = FlowState(app.monitoring.detailsFailed, or: false)
    @State private var range = FlowState(app.monitoring.timeRange, or: TimeRange.hour)
    @State private var tab = DetailTab.overview
    @State private var query = ""
    @State private var sort = ProcessSort.cpu

    private var tabs: [DetailTab] { server.isPve ? [.overview, .nodes] : [.overview, .storage, .network, .processes] }

    var body: some View {
        List {
            if !server.isOnline { Section { IssueLabel(server: server).padding(.vertical, 2) } }
            if let details = details.value, let latest = details.latest {
                switch tab {
                case .nodes: NodesTab(nodes: latest.osInfo?.nodes ?? [])
                case .storage: StorageTab(storage: latest.storage)
                case .network: NetworkTab(network: latest.networking)
                case .processes: ProcessesTab(latest: latest, query: $query, sort: $sort)
                case .overview:
                    OverviewTab(server: server, details: details, latest: latest, range: range.binding { r in Task { try? await ctrl.setTimeRange(range: r) } })
                }
            }
        }
        .listStyle(.insetGrouped)
        .id(tab)
        .overlay {
            if details.value?.latest == nil {
                if failed.value {
                    ContentUnavailableView {
                        Label("Failed to Load Monitoring Data", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text("Check your connection and try again.")
                    } actions: {
                        Button("Retry") { Task { try? await ctrl.refreshDetails() } }.buttonStyle(.borderedProminent)
                    }
                } else {
                    ProgressView()
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            Picker("Section", selection: $tab) { ForEach(tabs, id: \.self) { Text($0.rawValue).tag($0) } }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(.bar)
        }
        .refreshable { try? await ctrl.refreshDetails() }
        .navigationTitle(server.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 6) {
                    Circle().fill(stateColor(server.state)).frame(width: 8, height: 8)
                    Text(server.state.label).font(.subheadline.weight(.medium))
                }
                .padding(.horizontal, 6)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

private struct StatusBadge: View {
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15), in: Capsule())
        .fixedSize()
    }
}

private struct TagLabel: View {
    let text: String
    var tint: Color = .secondary

    var body: some View {
        Text(text).font(.caption2.weight(.semibold)).foregroundStyle(tint)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            .fixedSize()
    }
}

private struct Meter: View {
    let percent: Double
    var height: CGFloat = 6

    var body: some View {
        ProgressView(value: Formatters.shared.fraction(percent: percent))
            .tint(usageColor(percent))
            .scaleEffect(x: 1, y: height / 4, anchor: .center)
            .frame(height: height)
    }
}

private struct FactGrid: View {
    let facts: [InfoRow]
    var large = false

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading, spacing: 14) {
            ForEach(facts, id: \.label) { fact in
                VStack(alignment: .leading, spacing: 2) {
                    Text(fact.label).font(.caption).foregroundStyle(.secondary)
                    Text(fact.value).font(large ? .title2.weight(.semibold) : .subheadline.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(fact.alert ? Color.orange : Color.primary).lineLimit(1).minimumScaleFactor(0.7)
                    if let detail = fact.detail { Text(detail).font(.caption2).foregroundStyle(.secondary) }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct OverviewTab: View {
    let server: MonitoringServer
    let details: MonitoringDetails
    let latest: MonitoringSnapshot
    @Binding var range: TimeRange

    var body: some View {
        Section { FactGrid(facts: server.isPve ? latest.clusterFacts : latest.overviewFacts, large: true) }
        Section {
            ForEach(details.charts(isPve: server.isPve), id: \.title) { MetricChart(series: $0) }
        } header: {
            HStack {
                Text("Performance")
                Spacer()
                Picker("Time Range", selection: $range) {
                    ForEach([TimeRange.hour, .sixHours, .day], id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .fixedSize()
                .textCase(nil)
            }
        }
        Section(server.isPve ? "Cluster Information" : "System Information") {
            ForEach(server.isPve ? latest.clusterInfo : latest.systemInfo, id: \.label) { LabeledContent($0.label, value: $0.value) }
        }
    }
}

private struct MetricChart: View {
    let series: ChartSeries

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(series.title).font(.subheadline.weight(.semibold))
                Spacer()
                if let latest = series.latest { Text(latest).font(.headline).monospacedDigit() }
            }
            if series.points.count < 2 {
                Text("No data available for the selected time range").font(.footnote).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 120)
            } else {
                Chart(series.points, id: \.time) { point in
                    let date = Date(timeIntervalSince1970: Double(point.time) / 1000)
                    AreaMark(x: .value("Time", date), y: .value(series.title, point.value))
                        .foregroundStyle(LinearGradient(colors: [accent.opacity(0.3), accent.opacity(0)], startPoint: .top, endPoint: .bottom))
                        .interpolationMethod(.monotone)
                    LineMark(x: .value("Time", date), y: .value(series.title, point.value))
                        .foregroundStyle(accent)
                        .interpolationMethod(.monotone)
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
                .chartYScale(domain: 0...series.top)
                .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) }
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisGridLine(); AxisValueLabel(format: .dateTime.hour().minute()) } }
                .frame(height: 160)
            }
        }
        .padding(.vertical, 6)
    }
}

private struct NodesTab: View {
    let nodes: [PveNode]

    var body: some View {
        if nodes.isEmpty {
            Section { ContentUnavailableView("No Nodes Available", systemImage: "network") }
        }
        ForEach(nodes, id: \.name) { node in
            Section {
                HStack {
                    Text(node.name).font(.headline)
                    Spacer()
                    StatusBadge(label: node.isOnline ? "Online" : "Offline", color: node.isOnline ? .green : .red)
                }
                if node.isOnline {
                    ForEach(node.usage, id: \.label) { row in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(row.label).font(.subheadline.weight(.semibold))
                                if let detail = row.detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
                                Spacer()
                                Text(wholePercent(row.percent)).font(.subheadline.weight(.semibold)).monospacedDigit()
                            }
                            Meter(percent: row.percent)
                        }
                        .padding(.vertical, 2)
                    }
                    ForEach(node.info, id: \.label) { LabeledContent($0.label, value: $0.value) }
                } else {
                    Text("This node is currently offline").foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct StorageTab: View {
    let storage: StorageOverview?

    var body: some View {
        if let storage {
            if let failing = storage.failing {
                Section {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Disk failure predicted").font(.subheadline.weight(.semibold))
                            Text(failing).font(.footnote).foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                    }
                }
            }
            if let percent = storage.percent?.doubleValue {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 14) {
                            Text(wholePercent(percent)).font(.system(size: 40, weight: .semibold, design: .rounded)).monospacedDigit()
                            VStack(alignment: .leading, spacing: 2) {
                                Text(storage.usedText).font(.subheadline.weight(.semibold))
                                Text(storage.freeText).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        Meter(percent: percent, height: 8)
                    }
                    .padding(.vertical, 4)
                }
            }
            Section("Filesystems (\(storage.filesystems.count))") {
                if storage.filesystems.isEmpty { Text("No mounted partitions").foregroundStyle(.secondary) }
                ForEach(storage.filesystems, id: \.mountPoint) { FilesystemItem(row: $0) }
            }
            ForEach(storage.disks, id: \.name) { disk in
                Section { DiskItem(disk: disk) } header: { if disk.name == storage.disks.first?.name { Text("Disks (\(storage.disks.count))") } }
            }
        } else {
            Section { ContentUnavailableView("No Disk Usage Data", systemImage: "internaldrive") }
        }
    }
}

private struct FilesystemItem: View {
    let row: FilesystemRow

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(row.mountPoint).font(.subheadline.weight(.semibold).monospaced()).lineLimit(1)
                ForEach(row.tags, id: \.self) { TagLabel(text: $0) }
                Spacer(minLength: 0)
                Text(wholePercent(row.percent)).font(.subheadline.weight(.semibold)).monospacedDigit()
            }
            Meter(percent: row.percent)
            HStack {
                Text(row.usedText)
                Spacer()
                Text(row.freeText)
            }
            .font(.caption).foregroundStyle(.secondary).monospacedDigit()
            Text(row.source).font(.caption2.monospaced()).foregroundStyle(.tertiary).lineLimit(1)
            if let percent = row.inodesPercent?.doubleValue, let text = row.inodesText {
                HStack(spacing: 8) {
                    Text("Inodes")
                    Meter(percent: percent, height: 4).frame(width: 64)
                    Text(text).monospacedDigit()
                }
                .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private func segmentColor(_ shade: Int32) -> Color {
    switch shade {
    case 0: accent
    case 1: accent.opacity(0.62)
    case 2: accent.opacity(0.36)
    default: Color(.systemFill)
    }
}

private func healthColor(_ status: HealthStatus) -> Color {
    switch status {
    case .passed: .green
    case .warning: .orange
    case .failed: .red
    default: .secondary
    }
}

private struct DiskItem: View {
    let disk: DiskRow

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Text(disk.name).font(.subheadline.weight(.semibold).monospaced())
                if let kind = disk.kind { TagLabel(text: kind) }
                Spacer(minLength: 0)
                Text(disk.sizeText).font(.subheadline.weight(.semibold)).monospacedDigit()
            }
            if disk.model != nil || disk.health != nil {
                HStack {
                    Text(disk.model ?? "").font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                    Spacer(minLength: 0)
                    if let health = disk.health { StatusBadge(label: health.label, color: healthColor(health)) }
                }
            }
            GeometryReader { geo in
                let total = max(disk.segments.reduce(0) { $0 + $1.weight }, 1)
                let spacing = CGFloat(max(disk.segments.count - 1, 0)) * 2
                HStack(spacing: 2) {
                    ForEach(disk.segments, id: \.name) { segment in
                        RoundedRectangle(cornerRadius: 3, style: .continuous).fill(segmentColor(segment.shade))
                            .frame(width: max(6, (geo.size.width - spacing) * segment.weight / total))
                    }
                }
                .frame(width: geo.size.width, alignment: .leading)
                .clipped()
            }
            .frame(height: 12)
            .accessibilityHidden(true)
            VStack(spacing: 6) {
                ForEach(disk.segments, id: \.name) { segment in
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 3, style: .continuous).fill(segmentColor(segment.shade)).frame(width: 10, height: 10)
                        Text(segment.name).font(segment.isFree ? .caption : .caption.monospaced())
                        Text(segment.usage).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(1)
                        Spacer(minLength: 0)
                        Text(segment.sizeText).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                    }
                }
            }
        }
        .padding(.vertical, 4)
        ForEach(disk.facts, id: \.label) { fact in
            LabeledContent(fact.label) { Text(fact.value).foregroundStyle(fact.alert ? Color.orange : Color.secondary) }
        }
    }
}

private struct NetworkTab: View {
    let network: NetworkOverview?

    var body: some View {
        if let network {
            if let summary = network.summary {
                Section {
                    HStack(spacing: 16) {
                        RateTile(label: "Download", symbol: "arrow.down", value: summary.download)
                        RateTile(label: "Upload", symbol: "arrow.up", value: summary.upload)
                    }
                    .padding(.vertical, 4)
                    ForEach(summary.facts, id: \.label) { fact in
                        LabeledContent(fact.label) { Text(fact.value).textSelection(.enabled) }
                    }
                }
            }
            if !network.interfaces.isEmpty {
                Section("Interfaces (\(network.interfaces.count))") {
                    ForEach(network.interfaces, id: \.name) { InterfaceItem(row: $0) }
                }
            }
            if !network.virtualInterfaces.isEmpty {
                Section {
                    DisclosureGroup("Virtual interfaces (\(network.virtualInterfaces.count))") {
                        ForEach(network.virtualInterfaces, id: \.name) { CompactInterfaceItem(row: $0) }
                    }
                }
            }
        } else {
            Section { ContentUnavailableView("No Network Interface Data", systemImage: "network") }
        }
    }
}

private struct RateTile: View {
    let label: String
    let symbol: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(label, systemImage: symbol).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title2.weight(.semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct RateLabel: View {
    let symbol: String
    let value: String
    var total: String?

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            Image(systemName: symbol).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).padding(.top, 3)
            VStack(alignment: .leading, spacing: 1) {
                Text(value).font(.subheadline).monospacedDigit().lineLimit(1)
                if let total { Text(total).font(.caption2).foregroundStyle(.secondary).monospacedDigit() }
            }
        }
    }
}

private struct InterfaceItem: View {
    let row: InterfaceRow
    @State private var copied: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text(row.name).font(.subheadline.weight(.semibold).monospaced()).foregroundStyle(row.isUp ? .primary : .secondary).lineLimit(1)
                if row.isDefault { TagLabel(text: "Default route", tint: accent) }
                if let kind = row.kind { TagLabel(text: kind) }
                Spacer(minLength: 0)
                if let state = row.stateLabel { StatusBadge(label: state, color: row.isUp ? .green : .secondary) }
            }
            if !row.addresses.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(row.addresses, id: \.text) { address in
                            Button {
                                UIPasteboard.general.string = address.value
                                copied = address.text
                                Task { try? await Task.sleep(for: .seconds(1.5)); if copied == address.text { copied = nil } }
                            } label: {
                                Label(address.text, systemImage: copied == address.text ? "checkmark" : "doc.on.doc")
                                    .labelStyle(.titleAndIcon).font(.caption.monospaced())
                            }
                            .accessibilityLabel("Copy \(address.value)")
                            .buttonStyle(.bordered)
                            .buttonBorderShape(.roundedRectangle(radius: 7))
                            .controlSize(.mini)
                            .tint(address.muted ? .secondary : accent)
                        }
                    }
                }
            }
            HStack(alignment: .top) {
                RateLabel(symbol: "arrow.down", value: row.download, total: row.downloadTotal).frame(maxWidth: .infinity, alignment: .leading)
                RateLabel(symbol: "arrow.up", value: row.upload, total: row.uploadTotal).frame(maxWidth: .infinity, alignment: .leading)
            }
            if !row.meta.isEmpty { Text(row.meta.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary).monospacedDigit() }
            ForEach(row.problems, id: \.label) { Text($0.value).font(.caption).foregroundStyle($0.alert ? Color.orange : Color.secondary) }
        }
        .padding(.vertical, 4)
    }
}

private struct CompactInterfaceItem: View {
    let row: InterfaceRow

    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(row.isUp ? Color.green : Color(.systemFill)).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 1) {
                Text(row.name).font(.subheadline.monospaced()).lineLimit(1)
                if let address = row.primaryAddress { Text(address).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(1) }
            }
            Spacer(minLength: 0)
            RateLabel(symbol: "arrow.down", value: row.download)
            RateLabel(symbol: "arrow.up", value: row.upload)
        }
    }
}

private struct ProcessesTab: View {
    let latest: MonitoringSnapshot
    @Binding var query: String
    @Binding var sort: ProcessSort

    var body: some View {
        if latest.hasProcesses {
            let processes = latest.processes(query: query, sort: sort)
            Section {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search processes", text: $query).textInputAutocapitalization(.never).autocorrectionDisabled()
                    if !query.isEmpty {
                        Button("Clear", systemImage: "xmark.circle.fill") { query = "" }.labelStyle(.iconOnly).buttonStyle(.borderless).foregroundStyle(.secondary)
                    }
                }
                Picker("Sort by", selection: $sort) {
                    ForEach([ProcessSort.cpu, .memory], id: \.self) { Text($0.label).tag($0) }
                }
            }
            Section {
                if processes.isEmpty { ContentUnavailableView.search(text: query) }
                ForEach(Array(processes.enumerated()), id: \.offset) { ProcessItem(process: $0.element, sort: sort) }
            } header: {
                HStack(spacing: 12) {
                    Text("\(processes.count) of \(latest.processCount) processes")
                    Spacer(minLength: 0)
                    Text("CPU").frame(width: ProcessItem.statWidth, alignment: .trailing)
                    Text("Memory").frame(width: ProcessItem.statWidth, alignment: .trailing)
                }
            }
        } else {
            Section {
                ContentUnavailableView("No Process Data", systemImage: "terminal", description: Text("Process data will appear after the next monitoring cycle."))
            }
        }
    }
}

private struct ProcessItem: View {
    static let statWidth: CGFloat = 60
    let process: ProcessEntry
    let sort: ProcessSort

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(process.command).font(.footnote.monospaced()).lineLimit(1)
                Text(process.meta).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
            stat(process.cpuText, sort == .cpu)
            stat(process.memText, sort == .memory)
        }
    }

    private func stat(_ value: String, _ active: Bool) -> some View {
        Text(value).font(.subheadline).monospacedDigit().foregroundStyle(active ? accent : .primary)
            .frame(width: Self.statWidth, alignment: .trailing)
    }
}
