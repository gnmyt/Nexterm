import SwiftUI
import NextermKit

struct SessionsView: View {
    var body: some View {
        NavigationStack { ActiveSessionView().toolbarVisibility(.hidden, for: .tabBar) }
    }
}

struct ActiveSessionView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var snippets = false
    @State private var ai = false

    var body: some View {
        let fullscreen = app.fullscreen.value
        Group {
            if let s = app.active.value {
                SessionContent(session: s)
                    .id(s.sessionId)
                    .navigationTitle(s.server.name)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbarTitleMenu { menu(s) }
                    .toolbar {
                        if sizeClass != .compact {
                            ToolbarItem(placement: .topBarLeading) { Menu("Sessions", systemImage: "rectangle.stack") { menu(s) } }
                        }
                        ToolbarItemGroup(placement: .topBarTrailing) {
                            fullscreenButton(fullscreen)
                            if s.supportsSnippets { Button("Snippets", systemImage: "curlybraces") { snippets = true } }
                            if s.supportsAI && app.aiAvailable.value { Button("AI Assistant", systemImage: "sparkles") { ai = true } }
                        }
                    }
                    .sheet(isPresented: $snippets) { SnippetsSheet { s.terminal?.send(data: $0) } }
                    .sheet(isPresented: $ai) { AIAssistantSheet(session: s) }
                    .toolbarVisibility(fullscreen ? .hidden : .automatic, for: .navigationBar, .tabBar)
                    .statusBarHidden(fullscreen)
                    .persistentSystemOverlays(fullscreen ? .hidden : .automatic)
                    .overlay(alignment: .topTrailing) {
                        if fullscreen { fullscreenButton(true).labelStyle(.iconOnly).buttonStyle(.bordered).padding(8) }
                    }
            } else {
                ContentUnavailableView("No Active Session", systemImage: "display", description: Text("Select a server to connect"))
            }
        }
    }

    private func fullscreenButton(_ on: Bool) -> some View {
        Button(on ? "Exit Full Screen" : "Full Screen", systemImage: on ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right") {
            nx.sessions.setFullscreen(value: !on)
        }
    }

    @ViewBuilder private func menu(_ s: AppSession) -> some View {
        Picker("Sessions", selection: Binding(get: { s.sessionId }, set: { nx.sessions.setActive(sessionId: $0) })) {
            ForEach(app.sessions.value, id: \.sessionId) { x in
                Label {
                    Text(x.server.name)
                    Text(x.type.label)
                } icon: {
                    Image(systemName: sfSymbol(x.type.iconKey))
                }
                .tag(x.sessionId)
            }
        }
        Section {
            if sizeClass == .compact {
                Button("Back to Servers", systemImage: "server.rack") { app.tab = .servers }
            }
            Button("Close Session", systemImage: "xmark", role: .destructive) {
                Task { try? await nx.sessions.closeSession(sessionId: s.sessionId) }
            }
        }
    }
}

private struct SessionContent: View {
    let session: AppSession

    var body: some View {
        if let terminal = session.terminal {
            TerminalSessionView(session: session, terminal: terminal)
        } else if let browser = session.sftp {
            SftpView(session: session, browser: browser)
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
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(snippets.value, id: \.id) { s in
                Button {
                    send(s.command)
                    dismiss()
                } label: {
                    Row(title: s.name, subtitle: s.description_, icon: "terminal")
                }
                .tint(.primary)
            }
            .overlay {
                if loading.value && snippets.value.isEmpty {
                    ProgressView()
                } else if let e = error.value {
                    ContentUnavailableView("Failed to load snippets", systemImage: "exclamationmark.triangle", description: Text(e))
                } else if snippets.value.isEmpty {
                    ContentUnavailableView("No snippets available", systemImage: "curlybraces")
                }
            }
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
