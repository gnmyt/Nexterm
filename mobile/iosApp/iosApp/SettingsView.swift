import SwiftUI
import NextermKit

struct SettingsView: View {
    private let ts = nx.terminalSettings
    private let sf = nx.sftpSettings
    @State private var accounts = FlowState(nx.accounts.accounts, or: [ServerAccount]())
    @State private var fontSize = FlowState(nx.terminalSettings.fontSize, or: 13.0)
    @State private var themeId = FlowState(nx.terminalSettings.themeId, or: "default")
    @State private var cursor = FlowState(nx.terminalSettings.cursorStyle, or: TerminalCursorStyle.block)
    @State private var hidden = FlowState(nx.sftpSettings.showHiddenFiles, or: false)
    @State private var confirmDelete = FlowState(nx.sftpSettings.confirmBeforeDelete, or: true)
    @State private var foldersFirst = FlowState(nx.sftpSettings.sortFoldersFirst, or: true)
    @State private var confirmLogout = false

    var body: some View {
        NavigationSplitView {
            Form {
              Group {
                Section {
                    HStack(spacing: 14) {
                        NextermLogo(size: 30)
                            .frame(width: 52, height: 52)
                            .background(accentSoft, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                            .overlay { RoundedRectangle(cornerRadius: 15, style: .continuous).strokeBorder(NX.border) }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.account.value?.displayName ?? "").font(.headline)
                            Text(app.account.value?.displayUrl ?? "").mono(.caption).foregroundStyle(NX.subtext).lineLimit(1)
                        }
                    }
                    .padding(.vertical, 4)
                    NavigationLink { AccountsView() } label: { Row(title: "Nexterm Servers", subtitle: "\(accounts.value.count) connected", icon: "network") }
                    NavigationLink { LoginSessionsView() } label: { Row(title: "Signed-In Devices", icon: "laptopcomputer.and.iphone") }
                    NavigationLink { AuthorizeLoginView() } label: { Row(title: "Authorize Web Login", icon: "qrcode.viewfinder") }
                }
                Section("Appearance") {
                    Picker("Theme", selection: app.themeMode.binding { nx.themeSettings.setThemeMode(mode: $0) }) {
                        Text("System").tag(ThemeMode.system)
                        Text("Light").tag(ThemeMode.light)
                        Text("Dark").tag(ThemeMode.dark)
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Accent")
                        HStack(spacing: 0) {
                            ForEach(ThemeSettings.companion.ACCENTS, id: \.argb) { option in
                                let selected = option.argb == app.accent.value
                                Button { nx.themeSettings.setAccentColor(argb: option.argb) } label: {
                                    Circle().fill(Color(argb: option.argb))
                                        .overlay { if selected { Image(systemName: "checkmark").font(.caption2.weight(.heavy)).foregroundStyle(.white) } }
                                        .padding(4)
                                        .overlay { Circle().strokeBorder(selected ? Color(argb: option.argb) : .clear, lineWidth: 2) }
                                        .aspectRatio(1, contentMode: .fit)
                                        .frame(maxWidth: 34)
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(option.name)
                                .accessibilityAddTraits(selected ? .isSelected : [])
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section("Terminal") {
                    Stepper(value: fontSize.binding { ts.setFontSize(size: $0) }, in: 8...24) {
                        LabeledContent("Font Size", value: "\(Int(fontSize.value)) pt")
                    }
                    Picker("Color Theme", selection: themeId.binding { ts.setTheme(id: $0) }) {
                        ForEach(TerminalThemes.shared.all, id: \.id) { Text($0.name).tag($0.id) }
                    }
                    Picker("Cursor", selection: cursor.binding { ts.setCursorStyle(style: $0) }) {
                        ForEach(TerminalSettings.companion.CURSOR_STYLES, id: \.self) { Text($0.name.capitalized).tag($0) }
                    }
                    NavigationLink("Keyboard Toolbar") { ToolbarSettingsView() }
                }
                Section("File Browser") {
                    Toggle(isOn: hidden.binding { sf.setShowHiddenFiles(value: $0) }) {
                        Text("Show Hidden Files")
                        Text("Show files starting with .")
                    }
                    Toggle("Confirm Before Delete", isOn: confirmDelete.binding { sf.setConfirmBeforeDelete(value: $0) })
                    Toggle("Sort Folders First", isOn: foldersFirst.binding { sf.setSortFoldersFirst(value: $0) })
                }
                Section {
                    Button("Log Out", role: .destructive) { confirmLogout = true }
                } footer: {
                    Text("Nexterm \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")").frame(maxWidth: .infinity).padding(.top, 8)
                }
              }
              .brandedRows()
            }
            .brandedList()
            .navigationTitle("Settings")
            .confirmationDialog("Are you sure you want to log out?", isPresented: $confirmLogout, titleVisibility: .visible) {
                Button("Log Out", role: .destructive) { Task { try? await nx.accounts.logout() } }
            }
        } detail: {
            ZStack { NX.background.ignoresSafeArea(); NextermLogo(size: 72).opacity(0.5) }
        }
    }
}

private struct ToolbarSettingsView: View {
    @State private var order = FlowState(nx.terminalSettings.groupOrder, or: [ToolbarGroup]())
    @State private var enabled = FlowState(nx.terminalSettings.groupEnabled) { $0 as? [AnyHashable: Any] ?? [:] }

    var body: some View {
        List {
            Section {
                ForEach(order.value, id: \.self) { g in
                    Toggle(isOn: Binding(get: { enabled.value[g] as? Bool ?? false },
                                         set: { nx.terminalSettings.setGroupEnabled(group: g, enabled: $0) })) {
                        Text(g.label)
                        Text(g.description_)
                    }
                }
                .onMove { from, to in
                    guard let f = from.first else { return }
                    nx.terminalSettings.moveGroup(from: Int32(f), to: Int32(to > f ? to - 1 : to))
                }
            } footer: {
                Text("ESC and TAB are always shown. Toggle and drag to reorder.")
            }
            .brandedRows()
        }
        .brandedList()
        .environment(\.editMode, .constant(.active))
        .navigationTitle("Keyboard Toolbar")
    }
}

private struct AccountsView: View {
    @State private var accounts = FlowState(nx.accounts.accounts, or: [ServerAccount]())
    @State private var adding = false
    @State private var renaming: ServerAccount?
    @State private var removing: ServerAccount?
    @State private var label = ""

    @ViewBuilder private func row(_ a: ServerAccount) -> some View {
        let active = a.id == app.account.value?.id
        Button { nx.accounts.switchAccount(id: a.id) } label: {
            Row(title: a.label, subtitle: a.subtitle, icon: "network")
                .badge(active ? Text("Active") : nil)
        }
        .tint(.primary)
        .brandedRows()
        .swipeActions {
            Button("Remove", systemImage: "trash", role: .destructive) { removing = a }
            Button("Rename", systemImage: "pencil") { label = a.label; renaming = a }
        }
        .contextMenu {
            if !active { Button("Switch to", systemImage: "arrow.left.arrow.right") { nx.accounts.switchAccount(id: a.id) } }
            Button("Rename", systemImage: "pencil") { label = a.label; renaming = a }
            Button("Remove", systemImage: "trash", role: .destructive) { removing = a }
        }
    }

    var body: some View {
        List(accounts.value, id: \.id, rowContent: row)
        .brandedList()
        .overlay {
            if accounts.value.isEmpty {
                ContentUnavailableView("No connections", systemImage: "server.rack", description: Text("Add a server to get started"))
            }
        }
        .navigationTitle("Nexterm Servers")
        .toolbar { Button("Add Nexterm Server", systemImage: "plus") { adding = true } }
        .sheet(isPresented: $adding) { DeviceSetupView(adding: true) }
        .alert("Rename Server", isPresented: isSet($renaming), presenting: renaming) { a in
            TextField("Label", text: $label)
            Button("Cancel", role: .cancel) {}
            Button("Rename") { nx.accounts.renameAccount(id: a.id, label: label) }
        }
        .confirmationDialog("Remove \"\(removing?.label ?? "")\"? This will log you out.", isPresented: isSet($removing),
                            titleVisibility: .visible, presenting: removing) { a in
            Button("Remove Server", role: .destructive) { Task { try? await nx.accounts.removeAccount(id: a.id) } }
        }
    }
}

private struct LoginSessionsView: View {
    @State private var sessions: [SessionModel] = []
    @State private var loading = true
    @State private var revoking: SessionModel?

    var body: some View {
        List(sessions, id: \.id) { s in
            Row(title: UserAgents.shared.deviceLabel(ua: s.userAgent),
                subtitle: "\(s.ip ?? "Unknown IP") · \(Formatters.shared.relativeTime(epochMillis: s.lastActivity))",
                icon: sfSymbol(IconKeys.shared.userAgent(ua: s.userAgent)))
                .badge(s.current?.boolValue == true ? Text("This Device") : nil)
                .brandedRows()
            .swipeActions {
                if s.current?.boolValue != true { Button("Revoke", systemImage: "xmark.circle", role: .destructive) { revoking = s } }
            }
        }
        .overlay {
            if loading { ProgressView() } else if sessions.isEmpty {
                ContentUnavailableView("No other sessions", systemImage: "desktopcomputer", description: Text("Only this device is active"))
            }
        }
        .brandedList()
        .task { await load() }
        .refreshable { await load() }
        .navigationTitle("Signed-In Devices")
        .confirmationDialog("Are you sure you want to end this session?", isPresented: isSet($revoking),
                            titleVisibility: .visible, presenting: revoking) { s in
            Button("Revoke Session", role: .destructive) {
                Task {
                    let ok = (try? await nx.accounts.revokeSession(sessionId: s.id))?.boolValue ?? false
                    if !ok { app.show("Failed to revoke session") }
                    await load()
                }
            }
        }
    }

    private func load() async {
        sessions = (try? await nx.accounts.listSessions()) ?? []
        loading = false
    }
}

struct AuthorizeLoginView: View {
    @State private var payload: AuthorizePayload?
    @State private var scanning = true
    @State private var failure: String?
    @State private var busy = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
          Group {
            if let p = payload {
                Section("Web Login Request") {
                    LabeledContent("Device Code", value: p.code)
                    LabeledContent("Server", value: p.server)
                }
                if let failure { Label(failure, systemImage: "exclamationmark.triangle").foregroundStyle(NX.error) }
                Section {
                    Button { approve(p) } label: { if busy { ProgressView() } else { Text("Approve") } }.disabled(busy)
                    Button("Cancel", role: .cancel) { dismiss() }
                }
            } else {
                Button("Scan QR Code", systemImage: "qrcode.viewfinder") { scanning = true }
            }
          }
          .brandedRows()
        }
        .brandedList()
        .navigationTitle("Authorize Login")
        .sheet(isPresented: $scanning) {
            QRScannerSheet(title: "Scan QR Code", hint: "Point your camera at the QR code on the login page") { raw in
                guard let p = QrPayloads.shared.parseAuthorize(raw: raw) else { return false }
                payload = p
                failure = nil
                return true
            }
        }
    }

    private func approve(_ p: AuthorizePayload) {
        busy = true
        Task {
            do {
                try await nx.accounts.authorizeWebLogin(code: p.code, server: p.server)
                app.show("Login authorized")
                dismiss()
            } catch {
                failure = error.localizedDescription
            }
            busy = false
        }
    }
}
