import SwiftUI
import NextermKit

private struct QuickTarget {
    let server: Server
    let type: ConnectionType
}

private struct ScriptTarget {
    let server: Server
    let identityId: KotlinInt?
}

struct ServersView: View {
    private let list = app.servers
    @State private var loading = FlowState(app.servers.isLoading, or: true)
    @State private var error = FlowState(app.servers.error, or: nil as String?)
    @State private var entries = FlowState(app.servers.filtered, or: [Entry]())
    @State private var tags = FlowState(app.servers.allTags, or: [Tag]())
    @State private var selectedTags = FlowState(app.servers.selectedTags) { Set(($0 as? NSSet)?.compactMap { ($0 as? NSNumber)?.int32Value } ?? []) }
    @State private var expanded = FlowState(app.servers.expandedIds, or: Set<String>())
    @State private var total = FlowState(app.servers.totalServers, or: Int32(0))
    @State private var recent = FlowState(app.servers.recent, or: [Server]())
    @State private var paused = FlowState(nx.sessions.hibernated, or: [HibernatedSession]())
    @State private var revision = FlowState(app.servers.menuRevision, or: Int32(0))
    @State private var scriptTarget: ScriptTarget?
    @State private var search = ""
    @State private var pending: ConnectRequest?
    @State private var reason = ""
    @State private var quick: QuickTarget?
    @State private var connecting = false
    @State private var columns = NavigationSplitViewVisibility.all
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        NavigationSplitView(columnVisibility: Binding(get: { app.fullscreen.value ? .detailOnly : columns }, set: { if !app.fullscreen.value { columns = $0 } }),
                            preferredCompactColumn: .constant(.sidebar)) {
            let pausedIds = Set(paused.value.compactMap { $0.server.id })
            let _ = revision.value
            List {
                if !recent.value.isEmpty && !entries.value.isEmpty {
                    Section("Recent") {
                        ForEach(recent.value, id: \.self) { ServerNode(server: $0, paused: pausedIds.contains($0.id ?? ""), act: act) }
                    }
                }
                Section {
                    ForEach(entries.value, id: \.self) { EntryNode(entry: $0, expanded: expanded.value, paused: pausedIds, act: act) }
                } header: {
                    if total.value > 0 { Text(list.onlineSummary()) }
                }
            }
            .overlay { overlay }
            .navigationTitle("Servers")
            .searchable(text: $search, prompt: "Search servers")
            .onChange(of: search) { _, text in list.setSearchText(text: text) }
            .refreshable {
                do { try await list.refresh() } catch { app.show("Failed to refresh: \(error.localizedDescription)") }
            }
            .task(id: app.account.value?.id) { try? await list.load() }
            .toolbar {
                if connecting { ToolbarItem(placement: .topBarLeading) { ProgressView() } }
                if !tags.value.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu("Filter by Tag", systemImage: selectedTags.value.isEmpty
                             ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill") {
                            ForEach(tags.value, id: \.id) { tag in
                                Toggle(tag.name, isOn: Binding(get: { selectedTags.value.contains(tag.id) }, set: { _ in list.toggleTag(id: tag.id) }))
                            }
                            if !selectedTags.value.isEmpty {
                                Divider()
                                Button("Clear Filter", systemImage: "xmark") { list.clearTags() }
                            }
                        }
                    }
                }
            }
            .alert("Connection Reason Required", isPresented: isSet($pending), presenting: pending) { p in
                TextField("Reason", text: $reason)
                Button("Cancel", role: .cancel) {}
                Button("Connect") { create(p, reason: reason.trimmingCharacters(in: .whitespacesAndNewlines)) }
                    .disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } message: { p in
                Text("Please provide a reason for connecting to \(p.server.name).")
            }
            .onChange(of: reason) { _, text in
                let max = Int(ConnectionRules.shared.CONNECTION_REASON_MAX_LENGTH)
                if text.count > max { reason = String(text.prefix(max)) }
            }
            .sheet(isPresented: isSet($quick)) {
                if let q = quick { QuickConnectSheet(server: q.server) { start(list.request(server: q.server, type: q.type, identity: $0)) } }
            }
            .sheet(isPresented: isSet($scriptTarget)) {
                if let t = scriptTarget {
                    ScriptPickerSheet(server: t.server) { start(list.scriptRequest(server: t.server, identityId: t.identityId, script: $0)) }
                }
            }
            .disabled(connecting)
        } detail: {
            if sizeClass != .compact { ActiveSessionView() }
        }
    }

    @ViewBuilder private var overlay: some View {
        if loading.value && entries.value.isEmpty {
            ProgressView()
        } else if let message = error.value {
            ContentUnavailableView {
                Label("Something went wrong", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Retry") { Task { try? await list.load() } }.buttonStyle(.borderedProminent)
            }
        } else if entries.value.isEmpty {
            if search.isEmpty {
                ContentUnavailableView(list.emptyTitle(), systemImage: "server.rack", description: Text(list.emptySubtitle()))
            } else {
                ContentUnavailableView.search(text: search)
            }
        }
    }

    private func act(_ intent: ServerIntent) {
        let step = list.plan(intent: intent)
        if let m = step as? ConnectStep.Message {
            app.show(m.text)
        } else if let q = step as? ConnectStep.QuickConnect {
            quick = QuickTarget(server: q.server, type: q.type)
        } else if let c = step as? ConnectStep.Connect {
            start(c.request)
        } else if let p = step as? ConnectStep.PickScript {
            scriptTarget = ScriptTarget(server: p.server, identityId: p.identityId)
        } else if let e = step as? ConnectStep.Execute {
            connecting = true
            Task {
                do {
                    let result = try await list.execute(intent: e.intent)
                    if let message = result.message { app.show(message) }
                    if result.openedSession && sizeClass == .compact { app.tab = .sessions }
                } catch {
                    app.show(error.localizedDescription)
                }
                connecting = false
            }
        }
    }

    private func start(_ r: ConnectRequest) {
        if r.needsReason {
            reason = ""
            pending = r
        } else {
            create(r, reason: nil)
        }
    }

    private func create(_ r: ConnectRequest, reason: String?) {
        connecting = true
        Task {
            do {
                _ = try await nx.sessions.createSession(request: r, connectionReason: reason)
                if sizeClass == .compact { app.tab = .sessions }
            } catch {
                app.show("Failed to connect: \(error.localizedDescription)")
            }
            connecting = false
        }
    }
}

private struct EntryNode: View {
    let entry: Entry
    let expanded: Set<String>
    let paused: Set<String>
    let act: (ServerIntent) -> Void

    var body: some View {
        if let folder = entry as? ServerFolder {
            let row = ServerListRow.FolderRow(folder: folder, depth: 0, isExpanded: expanded.contains(folder.id ?? ""))
            DisclosureGroup(isExpanded: Binding(get: { row.isExpanded }, set: { _ in app.servers.toggleFolder(folderId: folder.id) })) {
                ForEach((folder.allServers as [Entry]) + (folder.allFolders as [Entry]), id: \.self) {
                    EntryNode(entry: $0, expanded: expanded, paused: paused, act: act)
                }
            } label: {
                Row(title: folder.name, subtitle: row.subtitle, icon: sfSymbol(row.iconKey), color: roleColor(row.colorRole.name))
            }
        } else if let server = entry as? Server {
            ServerNode(server: server, paused: paused.contains(server.id ?? ""), act: act)
        }
    }
}

private struct ServerNode: View {
    let server: Server
    let paused: Bool
    let act: (ServerIntent) -> Void

    var body: some View {
        let row = ServerListRow.ServerRow(server: server, depth: 0)
        Button { act(app.servers.primaryIntent(server: server)) } label: {
            HStack {
                Row(title: server.name, subtitle: server.subtitle, icon: sfSymbol(row.iconKey), color: roleColor(row.colorRole.name))
                if paused {
                    Spacer()
                    Image(systemName: "moon.zzz").foregroundStyle(.secondary).accessibilityLabel("Hibernated session")
                }
            }
            .badge(server.tags.isEmpty ? nil : Text(server.tags.map(\.name).joined(separator: ", ")))
        }
        .tint(server.isStopped ? .secondary : .primary)
        .swipeActions(edge: .trailing) {
            if ConnectionRules.shared.supportsSftp(server: server) {
                Button("File Browser", systemImage: "folder") { act(ServerIntent.Connect(server: server, type: .sftp, identityId: nil)) }.tint(.accentColor)
            }
        }
        .swipeActions(edge: .leading) {
            if server.canWakeOnLan {
                Button("Wake-On-LAN", systemImage: "power") { act(ServerIntent.Wake(server: server)) }.tint(.green)
            }
        }
        .contextMenu {
            ForEach(Array(app.servers.menu(server: server).enumerated()), id: \.offset) { _, item in
                if item.hasOptions {
                    Menu {
                        ForEach(Array(item.options.enumerated()), id: \.offset) { _, option in
                            Button(option.label) { act(option.intent) }
                        }
                    } label: {
                        Label(item.label, systemImage: sfSymbol(item.action.iconKey))
                    }
                } else {
                    Button(item.label, systemImage: sfSymbol(item.action.iconKey), role: item.action.isDestructive ? .destructive : nil) { act(item.intent) }
                }
            }
        }
    }
}

private struct ScriptPickerSheet: View {
    let server: Server
    let run: (Script) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var scripts: [Script]?
    @State private var query = ""

    var body: some View {
        let shown = (scripts ?? []).filter { $0.matches(query: query) }
        NavigationStack {
            List(shown, id: \.self) { script in
                Button {
                    dismiss()
                    run(script)
                } label: {
                    HStack {
                        Row(title: script.name, subtitle: script.description_, icon: "scroll")
                        if script.isFromSource {
                            Spacer()
                            Image(systemName: "icloud.and.arrow.down").foregroundStyle(.secondary).accessibilityLabel("From a source")
                        }
                    }
                }
                .tint(.primary)
            }
            .overlay {
                if scripts == nil {
                    ProgressView()
                } else if scripts?.isEmpty == true {
                    ContentUnavailableView("No Scripts", systemImage: "scroll", description: Text("No scripts match this server's operating system"))
                } else if shown.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, prompt: "Search scripts")
            .task { scripts = (try? await app.servers.scriptsFor(server: server)) ?? [] }
            .navigationTitle("Run Script")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct QuickConnectSheet: View {
    let server: Server
    let onConnect: (DirectIdentity) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var auth = ""
    @State private var username = ""
    @State private var password = ""
    @State private var passphrase = ""
    @State private var key: String?
    @State private var keyName: String?
    @State private var importing = false
    @State private var failure: String?

    private var options: [AuthTypeOption] { ConnectionRules.shared.allowedAuthTypes(protocol: server.protocolLower) }

    var body: some View {
        let opt = options.first { $0.id == auth } ?? options[0]
        NavigationStack {
            Form {
                Section(server.name) {
                    if opt.showsUsername {
                        TextField("Username", text: $username).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                    Picker("Authentication", selection: $auth) {
                        ForEach(options, id: \.id) { Text($0.label).tag($0.id) }
                    }
                    if opt.showsPassword { SecureField("Password", text: $password).textContentType(.password) }
                    if opt.showsKey {
                        Button(keyName ?? "Select key file", systemImage: "key") { importing = true }
                        SecureField("Passphrase (optional)", text: $passphrase)
                    }
                }
                if let failure { Label(failure, systemImage: "exclamationmark.triangle").foregroundStyle(.red) }
            }
            .navigationTitle("Quick Connect")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Connect", action: connect) }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.item]) { result in
                guard case .success(let url) = result else { return }
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                do {
                    key = try String(contentsOf: url, encoding: .utf8)
                    keyName = url.lastPathComponent
                } catch {
                    failure = "Failed to read key: \(error.localizedDescription)"
                }
            }
        }
        .onAppear { if auth.isEmpty { auth = options[0].id } }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func connect() {
        do {
            let identity = try ConnectionRules.shared.buildDirectIdentity(authType: auth, username: username, password: password,
                                                                         sshKey: key, passphrase: passphrase)
            dismiss()
            onConnect(identity)
        } catch {
            failure = error.localizedDescription
        }
    }
}
