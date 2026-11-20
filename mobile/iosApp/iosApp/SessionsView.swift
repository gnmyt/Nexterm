import SwiftUI
import NextermKit

struct ActiveSessionView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var switcher = false
    @State private var closingAfterSwitcher: String?
    @State private var snippets = false
    @State private var generate = false
    @State private var fontSize = FlowState(nx.terminalSettings.fontSize, or: 13.0)

    var body: some View {
        let fullscreen = app.fullscreen.value
        Group {
            if let s = app.active.value {
                SessionContent(session: s)
                    .overlay { if let challenge = app.trust.value[s.sessionId] { TrustPrompt(sessionId: s.sessionId, challenge: challenge).id(challenge.fingerprint) } }
                    .id(s.sessionId)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        if sizeClass == .compact {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("Minimise", systemImage: "chevron.down") { app.sessionOpen = false }
                            }
                        }
                        ToolbarItem(placement: .principal) {
                            SessionCapsule(session: s, count: app.sessions.value.count) { switcher = true }.id(s.sessionId)
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Menu("Session Actions", systemImage: "ellipsis") { actions(s) }
                        }
                    }
                    .sheet(isPresented: $snippets) { SnippetsSheet { s.terminal?.send(data: $0) } }
                    .sheet(isPresented: $generate) { GenerateCommandSheet(session: s) }
                    .toolbarVisibility(fullscreen ? .hidden : .automatic, for: .navigationBar)
                    .statusBarHidden(fullscreen)
                    .persistentSystemOverlays(fullscreen ? .hidden : .automatic)
                    .overlay(alignment: .topTrailing) {
                        if fullscreen {
                            Button("Exit Full Screen", systemImage: "arrow.down.right.and.arrow.up.left") { nx.sessions.setFullscreen(value: false) }
                                .labelStyle(.iconOnly).font(.footnote.weight(.bold)).foregroundStyle(.white)
                                .frame(width: 36, height: 36).background(.black.opacity(0.45), in: Circle())
                                .overlay { Circle().strokeBorder(.white.opacity(0.18)) }
                                .padding(10)
                        }
                    }
            } else {
                ZStack {
                    NX.background.ignoresSafeArea()
                    VStack(spacing: 14) {
                        NextermLogo(size: 72)
                        Text("No Active Session").font(.title3.weight(.bold))
                        Text("Pick a server to connect.").foregroundStyle(NX.subtext)
                    }
                }
            }
        }
        .sheet(isPresented: $switcher, onDismiss: closeDeferred) { SessionSwitcher { closingAfterSwitcher = $0 } }
    }

    private func closeDeferred() {
        guard let id = closingAfterSwitcher else { return }
        closingAfterSwitcher = nil
        closeSession(id)
    }

    @ViewBuilder private func actions(_ s: AppSession) -> some View {
        if s.supportsSnippets { Button("Snippets", systemImage: "curlybraces") { snippets = true } }
        if s.supportsAI && app.aiAvailable.value {
            Button("Generate Command", systemImage: "wand.and.stars") { generate = true }
        }
        if s.terminal != nil {
            ControlGroup("Text Size") {
                Button("Smaller", systemImage: "textformat.size.smaller") { nx.terminalSettings.setFontSize(size: fontSize.value - 1) }
                Button("Larger", systemImage: "textformat.size.larger") { nx.terminalSettings.setFontSize(size: fontSize.value + 1) }
            }
        }
        Button("Full Screen", systemImage: "arrow.up.left.and.arrow.down.right") { nx.sessions.setFullscreen(value: true) }
        Section {
            ForEach(s.actions, id: \.self) { action in
                Button(action.label, systemImage: sfSymbol(action.iconKey), role: action.isDestructive ? .destructive : nil) { perform(action, on: s) }
            }
        }
    }
}

func perform(_ action: SessionAction, on session: AppSession) {
    Task {
        do {
            if let message = try await nx.sessions.perform(session: session, action: action) { app.show(message) }
        } catch {
            app.show(error.localizedDescription, error: true)
        }
    }
}

private struct SessionCapsule: View {
    let session: AppSession
    let count: Int
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 7) {
                Image(systemName: session.isViewOnly ? "eye" : sfSymbol(session.type.iconKey)).font(.caption.weight(.semibold)).foregroundStyle(NX.subtext)
                Text(session.server.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                if count > 1 {
                    Text("\(count)").font(.caption2.weight(.bold)).monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2).background(accentSoft, in: Capsule()).foregroundStyle(accent)
                }
                Image(systemName: "chevron.down").font(.caption2.weight(.bold)).foregroundStyle(NX.subtext)
            }
            .padding(.horizontal, 12)
            .frame(height: 34)
            .frame(maxWidth: 240)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(session.server.name), \(session.type.label), \(count) open sessions")
        .accessibilityHint("Shows all sessions")
    }
}

private struct SessionSwitcher: View {
    let closeLast: (String) -> Void
    @State private var paused = FlowState(nx.sessions.hibernated, or: [HibernatedSession]())
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Open") {
                    ForEach(app.sessions.value, id: \.sessionId) { s in
                        let active = s.sessionId == app.active.value?.sessionId
                        HStack(spacing: 12) {
                            Button {
                                nx.sessions.setActive(sessionId: s.sessionId)
                                dismiss()
                            } label: {
                                HStack(spacing: 12) {
                                    ServerTile(symbol: s.isViewOnly ? "eye" : sfSymbol(s.type.iconKey), color: s.server.isPve ? NX.proxmox : accentFill)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(s.server.name).font(.body.weight(.semibold)).lineLimit(1)
                                        Text(s.typeLabel).font(.footnote).foregroundStyle(NX.subtext)
                                    }
                                    Spacer(minLength: 0)
                                    if active { Image(systemName: "checkmark").font(.footnote.weight(.bold)).foregroundStyle(accent) }
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            Button("Close \(s.server.name)", systemImage: "xmark.circle.fill") { close(s) }
                                .labelStyle(.iconOnly).buttonStyle(.borderless).font(.title3).foregroundStyle(NX.subtext)
                        }
                        .swipeActions {
                            Button("Close", systemImage: "xmark") { close(s) }.tint(NX.error)
                        }
                        .listRowBackground(active ? accentSoft : NX.surface)
                    }
                }
                if !paused.value.isEmpty {
                    Section("Hibernated") {
                        ForEach(paused.value, id: \.sessionId) { p in
                            Button {
                                dismiss()
                                Task {
                                    do { _ = try await nx.sessions.resume(sessionId: p.sessionId) } catch { app.show(error.localizedDescription, error: true) }
                                }
                            } label: {
                                Row(title: p.server.name, subtitle: p.subtitle, icon: "moon.zzz.fill", color: NX.subtext)
                            }
                            .tint(.primary)
                        }
                    }
                    .brandedRows()
                }
                Section {
                    Button("Connect to Another Server", systemImage: "plus") {
                        dismiss()
                        app.tab = .servers
                        app.sessionOpen = false
                    }
                }
                .brandedRows()
            }
            .brandedList()
            .navigationTitle("Sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func close(_ s: AppSession) {
        if app.sessions.value.count <= 1 {
            closeLast(s.sessionId)
            dismiss()
        } else {
            closeSession(s.sessionId)
        }
    }
}

private struct SessionContent: View {
    let session: AppSession

    var body: some View {
        if let terminal = session.terminal, let run = session.script {
            ScriptSessionView(session: session, terminal: terminal, run: run)
        } else if let terminal = session.terminal {
            TerminalSessionView(session: session, terminal: terminal)
        } else if let browser = session.sftp {
            SftpView(session: session, browser: browser)
        } else if let control = session.browser {
            BrowserSessionView(session: session, browser: control)
        } else {
            GuacamoleSessionView(session: session)
        }
    }
}

struct SnippetsSheet: View {
    let send: (String) -> Void
    @State private var snippets = FlowState(nx.snippets.snippets, or: [Snippet]())
    @State private var loading = FlowState(nx.snippets.isLoading, or: false)
    @State private var error = FlowState(nx.snippets.error, or: nil as String?)
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let shown = snippets.value.filter { $0.matches(query: query) }
        NavigationStack {
            List(shown, id: \.id) { s in
                Button {
                    send(s.command)
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        IconTile(symbol: "curlybraces", color: accent, size: 30)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.name).font(.body.weight(.medium))
                            Text(s.command).mono(.caption).foregroundStyle(NX.subtext).lineLimit(2)
                        }
                    }
                }
                .tint(.primary)
                .brandedRows()
            }
            .brandedList()
            .overlay {
                if loading.value && snippets.value.isEmpty {
                    ProgressView()
                } else if let e = error.value {
                    ContentUnavailableView("Failed to load snippets", systemImage: "exclamationmark.triangle", description: Text(e))
                } else if snippets.value.isEmpty {
                    ContentUnavailableView("No Snippets", systemImage: "curlybraces", description: Text("Create snippets in the web interface to reuse commands here."))
                } else if shown.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, prompt: "Search snippets")
            .refreshable { try? await nx.snippets.reloadSnippets() }
            .task { try? await nx.snippets.loadSnippets(forceRefresh: false) }
            .navigationTitle("Snippets")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct GenerateCommandSheet: View {
    let session: AppSession
    @State private var suggester: CommandSuggester
    @State private var state: FlowState<CommandSuggestions>
    @State private var prompt = ""
    @FocusState private var focused: Bool
    @Environment(\.dismiss) private var dismiss

    init(session: AppSession) {
        self.session = session
        let suggester = nx.ai.commandSuggester(sessionId: session.sessionId)
        _suggester = State(initialValue: suggester)
        _state = State(initialValue: FlowState(suggester.state) { $0 as! CommandSuggestions })
    }

    var body: some View {
        let s = state.value
        NavigationStack {
            List {
                Section {
                    TextField("e.g. find the ten largest files here", text: $prompt, axis: .vertical)
                        .lineLimit(1...4)
                        .focused($focused)
                        .submitLabel(.go)
                        .onSubmit { generate(fresh: true) }
                } footer: {
                    Text("The command is typed into \(session.server.name) but not run. You press return.")
                }
                .brandedRows()
                if s.isBusy {
                    HStack(spacing: 10) { ProgressView(); Text("Thinking…").foregroundStyle(NX.subtext) }.brandedRows()
                }
                if let failure = s.error { Label(failure, systemImage: "exclamationmark.triangle").foregroundStyle(NX.error).brandedRows() }
                if !s.commands.isEmpty {
                    Section("Suggestions") {
                        ForEach(s.commands, id: \.self) { command in
                            Button {
                                session.terminal?.send(data: command)
                                dismiss()
                            } label: {
                                HStack(spacing: 12) {
                                    Text(command).mono(.subheadline).multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
                                    Image(systemName: "arrow.turn.down.left").font(.footnote.weight(.semibold)).foregroundStyle(accent)
                                }
                            }
                            .tint(.primary)
                        }
                        Button("Try Others", systemImage: "arrow.triangle.2.circlepath") { generate(fresh: false) }.disabled(s.isBusy)
                    }
                    .brandedRows()
                }
            }
            .brandedList()
            .navigationTitle("Generate Command")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Generate") { generate(fresh: true) }.disabled(s.isBusy || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func generate(fresh: Bool) {
        Task { try? await suggester.generate(prompt: prompt, fresh: fresh) }
    }
}
