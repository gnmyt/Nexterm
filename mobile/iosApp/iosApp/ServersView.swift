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
    @State private var tags = FlowState(app.servers.allTags, or: [NextermKit.Tag]())
    @State private var selectedTags = FlowState(app.servers.selectedTags) { Set(($0 as? NSSet)?.compactMap { ($0 as? NSNumber)?.int32Value } ?? []) }
    @State private var expanded = FlowState(app.servers.expandedIds, or: Set<String>())
    @State private var filtering = FlowState(app.servers.isFiltering, or: false)
    @State private var total = FlowState(app.servers.totalServers, or: Int32(0))
    @State private var recent = FlowState(app.servers.recent, or: [Server]())
    @State private var favorites = FlowState(app.servers.favorites, or: [Server]())
    @State private var favoriteIds = FlowState(app.servers.favoriteIds, or: [String]())
    @State private var paused = FlowState(nx.sessions.hibernated, or: [HibernatedSession]())
    @State private var revision = FlowState(app.servers.menuRevision, or: Int32(0))
    @State private var accounts = FlowState(nx.accounts.accounts, or: [ServerAccount]())
    @State private var online = FlowState(nx.stream.isConnected, or: true)
    @State private var scriptTarget: ScriptTarget?
    @State private var search = ""
    @State private var pending: ConnectRequest?
    @State private var reason = ""
    @State private var quick: QuickTarget?
    @State private var connecting = false
    @State private var adding = false
    @State private var authorizing = false
    @State private var columns = NavigationSplitViewVisibility.all
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        NavigationSplitView(columnVisibility: Binding(get: { app.fullscreen.value ? .detailOnly : columns }, set: { if !app.fullscreen.value { columns = $0 } }),
                            preferredCompactColumn: .constant(.sidebar)) {
            let context = RowContext(paused: Set(paused.value.compactMap { $0.server.id }), favorites: Set(favoriteIds.value),
                                     expanded: expanded.value, expandAll: filtering.value, act: act)
            let _ = revision.value
            List {
                if !tags.value.isEmpty {
                    filters
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
                if !favorites.value.isEmpty && !entries.value.isEmpty {
                    Section("Favourites") {
                        ForEach(keyed(favorites.value, in: "favourite")) { ServerNode(server: $0.value, context: context) }
                    }
                    .listRowBackground(rowBackground)
                }
                if !recent.value.isEmpty && !entries.value.isEmpty {
                    Section("Recent") {
                        ForEach(keyed(recent.value, in: "recent")) { ServerNode(server: $0.value, context: context) }
                    }
                    .listRowBackground(rowBackground)
                }
                Section {
                    ForEach(keyed(entries.value, in: "tree")) { EntryNode(entry: $0.value, path: $0.id, context: context) }
                } header: {
                    if total.value > 0 {
                        HStack(spacing: 6) {
                            Text(filtering.value ? "Results" : "All Servers")
                            Spacer()
                            Text(online.value ? list.onlineSummary() : "Reconnecting…").textCase(nil)
                        }
                    }
                }
                .listRowBackground(rowBackground)
            }
            .listSectionSpacing(.compact)
            .brandedList()
            .overlay { overlay }
            .navigationTitle(sizeClass == .compact ? "Servers" : "")
            .searchable(text: $search, prompt: "Name, address or tag")
            .onChange(of: search) { _, text in list.setSearchText(text: text) }
            .refreshable {
                do { try await list.refresh() } catch { app.show("Failed to refresh: \(error.localizedDescription)") }
            }
            .task(id: app.account.value?.id) { try? await list.load() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { accountMenu }
                if connecting { ToolbarItem(placement: .topBarTrailing) { ProgressView() } }
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
            .sheet(isPresented: $adding) { DeviceSetupView(adding: true) }
            .sheet(isPresented: $authorizing) { NavigationStack { AuthorizeLoginView() } }
            .disabled(connecting)
        } detail: {
            if sizeClass != .compact { ActiveSessionView() }
        }
    }

    private var rowBackground: Color? { sizeClass == .compact ? NX.surface : nil }

    private var accountMenu: some View {
        Menu {
            Picker("Nexterm Server", selection: Binding(get: { app.account.value?.id ?? "" }, set: { nx.accounts.switchAccount(id: $0) })) {
                ForEach(accounts.value, id: \.id) { a in
                    Label { Text(a.label); Text(a.subtitle) } icon: { Image(systemName: "network") }.tag(a.id)
                }
            }
            Section {
                Button("Add Nexterm Server", systemImage: "plus") { adding = true }
                Button("Authorize Web Login", systemImage: "qrcode.viewfinder") { authorizing = true }
            }
        } label: {
            HStack(spacing: 7) {
                NextermLogo(size: 20)
                Text(app.account.value?.label ?? "Nexterm").font(.subheadline.weight(.semibold)).foregroundStyle(.primary).lineLimit(1)
                Image(systemName: "chevron.up.chevron.down").font(.caption2.weight(.bold)).foregroundStyle(NX.subtext)
            }
            .padding(.horizontal, 4)
            .frame(maxWidth: 200)
        }
        .accessibilityLabel("Nexterm server: \(app.account.value?.label ?? "")")
    }

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(tags.value, id: \.id) { tag in
                    Chip(label: tag.name, dot: tagColor(tag), selected: selectedTags.value.contains(tag.id)) {
                        list.toggleTag(id: tag.id)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 2)
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
            if !search.isEmpty {
                ContentUnavailableView.search(text: search)
            } else if filtering.value {
                ContentUnavailableView {
                    Label("No Matching Servers", systemImage: "line.3.horizontal.decrease.circle")
                } actions: {
                    Button("Clear Filters") { list.clearTags() }
                }
            } else {
                VStack(spacing: 14) {
                    NextermLogo(size: 64)
                    Text(list.emptyTitle()).font(.title3.weight(.bold))
                    Text(list.emptySubtitle()).foregroundStyle(NX.subtext)
                }
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
                    if let message = result.message { app.show(message, error: false) }
                    if result.openedSession { app.sessionOpen = true }
                } catch {
                    app.show(error.localizedDescription, error: true)
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
                app.sessionOpen = true
            } catch {
                app.show("Failed to connect: \(error.localizedDescription)")
            }
            connecting = false
        }
    }
}

private struct RowContext {
    let paused: Set<String>
    let favorites: Set<String>
    let expanded: Set<String>
    let expandAll: Bool
    let act: (ServerIntent) -> Void
}

private struct Keyed<Value>: Identifiable {
    let id: String
    let value: Value
}

private func keyed<E: Entry>(_ entries: [E], in scope: String) -> [Keyed<E>] {
    entries.map { Keyed(id: "\(scope)/\($0.type):\($0.id ?? $0.name)", value: $0) }
}

private struct EntryNode: View {
    let entry: Entry
    let path: String
    let context: RowContext

    var body: some View {
        if let folder = entry as? ServerFolder {
            let open = context.expandAll || context.expanded.contains(folder.id ?? "")
            let row = ServerListRow.FolderRow(folder: folder, depth: 0, isExpanded: open)
            DisclosureGroup(isExpanded: Binding(get: { open }, set: { _ in if !context.expandAll { app.servers.toggleFolder(folderId: folder.id) } })) {
                ForEach(keyed((folder.allServers as [Entry]) + (folder.allFolders as [Entry]), in: path)) {
                    EntryNode(entry: $0.value, path: $0.id, context: context)
                }
            } label: {
                HStack(spacing: 12) {
                    IconTile(symbol: sfSymbol(row.iconKey), color: roleColor(row.colorRole.name))
                    Text(folder.name).font(.body.weight(.semibold)).lineLimit(1)
                    Spacer(minLength: 0)
                    Text("\(folder.serverCount)").font(.footnote.weight(.medium)).monospacedDigit().foregroundStyle(NX.subtext)
                }
            }
        } else if let server = entry as? Server {
            ServerNode(server: server, context: context)
        }
    }
}

private struct ServerNode: View {
    let server: Server
    let context: RowContext

    var body: some View {
        let id = server.id ?? ""
        let favorite = context.favorites.contains(id)
        Button { context.act(app.servers.primaryIntent(server: server)) } label: {
            HStack(spacing: 12) {
                ServerTile(server: server)
                VStack(alignment: .leading, spacing: 2) {
                    Text(server.name).font(.body.weight(.semibold)).lineLimit(1)
                    Text(server.detail).mono(.caption).foregroundStyle(NX.subtext).lineLimit(1)
                }
                Spacer(minLength: 4)
                if context.paused.contains(id) {
                    Image(systemName: "moon.zzz.fill").font(.footnote).foregroundStyle(accent).accessibilityLabel("Hibernated session")
                }
                if favorite { Image(systemName: "star.fill").font(.caption2).foregroundStyle(NX.amber).accessibilityLabel("Favourite") }
                if !server.tags.isEmpty { TagDots(tags: server.tags) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(server.isStopped ? 0.7 : 1)
        .swipeActions(edge: .trailing) {
            if ConnectionRules.shared.supportsSftp(server: server) {
                Button("File Browser", systemImage: "folder") { context.act(ServerIntent.Connect(server: server, type: .sftp, identityId: nil)) }.tint(accentFill)
            }
        }
        .swipeActions(edge: .leading) {
            Button(favorite ? "Unfavourite" : "Favourite", systemImage: favorite ? "star.slash" : "star") { app.servers.toggleFavorite(server: server) }
                .tint(NX.amber)
            if server.canWakeOnLan {
                Button("Wake-On-LAN", systemImage: "power") { context.act(ServerIntent.Wake(server: server)) }.tint(NX.success)
            }
        }
        .contextMenu {
            ForEach(Array(app.servers.menu(server: server).enumerated()), id: \.offset) { _, item in
                if item.hasOptions {
                    Menu {
                        ForEach(Array(item.options.enumerated()), id: \.offset) { _, option in
                            Button(option.label) { context.act(option.intent) }
                        }
                    } label: {
                        Label(item.label, systemImage: sfSymbol(item.action.iconKey))
                    }
                } else {
                    Button(item.label, systemImage: sfSymbol(item.action.iconKey), role: item.action.isDestructive ? .destructive : nil) { context.act(item.intent) }
                }
            }
            Divider()
            Button(favorite ? "Remove from Favourites" : "Add to Favourites", systemImage: favorite ? "star.slash" : "star") {
                app.servers.toggleFavorite(server: server)
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
