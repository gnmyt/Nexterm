import SwiftUI
import NextermKit

struct MonitoringView: View {
    private let ctrl = app.monitoring
    @State private var servers = FlowState(app.monitoring.servers, or: [MonitoringServer]())
    @State private var loading = FlowState(app.monitoring.isLoading, or: true)
    @State private var error = FlowState(app.monitoring.error, or: nil as String?)
    @State private var selection: String?

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section {
                    ForEach(servers.value, id: \.id) { s in
                        NavigationLink(value: s.id) { MonitoringRow(server: s) }
                    }
                } header: {
                    if !servers.value.isEmpty { Text(ctrl.reportingSummary()) }
                }
            }
            .overlay {
                if loading.value && servers.value.isEmpty {
                    ProgressView()
                } else if let e = error.value, servers.value.isEmpty {
                    ContentUnavailableView {
                        Label("Something went wrong", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(e)
                    } actions: {
                        Button("Retry") { Task { try? await ctrl.load(silent: false) } }.buttonStyle(.borderedProminent)
                    }
                } else if servers.value.isEmpty {
                    ContentUnavailableView("No Monitoring Data", systemImage: "chart.bar", description: Text("Enable monitoring from the web dashboard"))
                }
            }
            .refreshable { try? await ctrl.load(silent: true) }
            .navigationTitle("Monitoring")
        } detail: {
            if let s = servers.value.first(where: { $0.id == selection }) {
                MonitoringDetailView(server: s)
            } else {
                ContentUnavailableView("No Server Selected", systemImage: "chart.bar")
            }
        }
        .task(id: selection) {
            if let s = servers.value.first(where: { $0.id == selection }) { try? await ctrl.select(server: s) } else { _ = ctrl.clearSelection() }
        }
        .onAppear { ctrl.start() }
        .onDisappear { ctrl.stop() }
    }
}

private struct MonitoringRow: View {
    let server: MonitoringServer

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Row(title: server.name, subtitle: server.ip, icon: sfSymbol(IconKeys.shared.monitoringServer(server: server)),
                color: server.hasError ? .secondary : server.isPve ? .teal : accent)
            if server.hasData {
                HStack(spacing: 16) {
                    UsageGauge(label: "CPU", value: server.cpuUsage?.doubleValue ?? 0)
                    UsageGauge(label: "Memory", value: server.memoryUsage?.doubleValue ?? 0)
                }
            } else if let e = server.errorMessage {
                Label(e, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.red).lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct MonitoringDetailView: View {
    let server: MonitoringServer
    @State private var details = FlowState(app.monitoring.details, or: nil as MonitoringDetails?)
    @State private var loadingDetails = FlowState(app.monitoring.isLoadingDetails, or: false)

    var body: some View {
        let ctrl = app.monitoring
        let latest = details.value?.latest
        List {
            Section(ctrl.infoTitle()) {
                ForEach(ctrl.infoRows(), id: \.label) { LabeledContent($0.label, value: $0.value) }
            }
            Section("Performance") {
                UsageGauge(label: "CPU Usage", value: latest?.cpuUsage?.doubleValue ?? 0)
                UsageGauge(label: "Memory Usage", value: latest?.memoryUsage?.doubleValue ?? 0)
                ForEach(ctrl.performanceRows(), id: \.label) { LabeledContent($0.label, value: $0.value) }
            }
            if let nodes = latest?.osInfo?.nodes, server.isPve, !nodes.isEmpty {
                ForEach(nodes, id: \.name) { n in
                    Section {
                        LabeledContent("Status") { Text(n.status).foregroundStyle(n.isOnline ? .green : .red) }
                        UsageGauge(label: "CPU", value: n.cpuUsage?.doubleValue ?? 0)
                        UsageGauge(label: "Memory", value: n.memoryUsage?.doubleValue ?? 0)
                        UsageGauge(label: "Storage", value: n.diskUsage?.doubleValue ?? 0)
                    } header: {
                        Text("Node \(n.name)")
                    }
                }
            }
        }
        .overlay { if loadingDetails.value && details.value == nil { ProgressView() } }
        .refreshable { try? await ctrl.select(server: server) }
        .navigationTitle(server.name)
    }
}
