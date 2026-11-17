import SwiftUI
import NextermKit

let nx = Nexterm.companion.start(appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
let app = AppModel()

typealias KFlow = any Kotlinx_coroutines_coreStateFlow

@Observable final class FlowState<T> {
    private(set) var value: T
    @ObservationIgnored private var handle: Closeable?

    init(_ flow: KFlow, _ map: @escaping (Any?) -> T) {
        value = map(flow.value)
        handle = FlowWatcherKt.watchState(flow) { [weak self] in self?.value = map($0) }
    }

    convenience init(_ flow: KFlow, or fallback: T) { self.init(flow) { $0 as? T ?? fallback } }

    func binding(_ set: @escaping (T) -> Void) -> Binding<T> { Binding(get: { self.value }, set: set) }

    deinit { handle?.close() }
}

struct Scoped<T: AnyObject, Content: View>: View {
    final class Box {
        let value: T, close: (T) -> Void
        init(_ value: T, _ close: @escaping (T) -> Void) { self.value = value; self.close = close }
        deinit { close(value) }
    }
    let make: () -> T
    var close: (T) -> Void = { _ in }
    @ViewBuilder let content: (T) -> Content
    @State private var box: Box?

    var body: some View {
        if let box { content(box.value) } else { Color.clear.onAppear { box = Box(make(), close) } }
    }
}

enum AppTab: Hashable { case servers, sessions, monitoring, settings }

@Observable final class AppModel {
    var tab = AppTab.servers
    var message: String?
    @ObservationIgnored let authenticated = FlowState(nx.accounts.isAuthenticated, or: false)
    @ObservationIgnored let account = FlowState(nx.accounts.activeAccount, or: nil as ServerAccount?)
    @ObservationIgnored let sessions = FlowState(nx.sessions.sessions, or: [AppSession]())
    @ObservationIgnored let active = FlowState(nx.sessions.activeSession, or: nil as AppSession?)
    @ObservationIgnored let fullscreen = FlowState(nx.sessions.fullscreen, or: false)
    @ObservationIgnored let aiAvailable = FlowState(nx.ai.isAvailable, or: false)
    @ObservationIgnored let themeMode = FlowState(nx.themeSettings.themeMode, or: ThemeMode.system)
    @ObservationIgnored let accent = FlowState(nx.themeSettings.accentColor) { ($0 as? NSNumber)?.int64Value ?? 0xFF673AB7 }
    @ObservationIgnored let servers = nx.doNewServerList()
    @ObservationIgnored let monitoring = nx.doNewMonitoring()

    func show(_ message: String) { self.message = message }
}

var accent: Color { Color(argb: app.accent.value) }

func isSet<T>(_ b: Binding<T?>) -> Binding<Bool> {
    Binding(get: { b.wrappedValue != nil }, set: { if !$0 { b.wrappedValue = nil } })
}

extension Color {
    init(argb: Int64) {
        func c(_ shift: Int64) -> Double { Double((argb >> shift) & 0xFF) / 255 }
        self.init(.sRGB, red: c(16), green: c(8), blue: c(0), opacity: c(24))
    }
}

func roleColor(_ role: String) -> Color {
    switch role {
    case "PRIMARY": accent
    case "TERTIARY": .teal
    case "PINK": .pink
    case "PURPLE": .purple
    case "ORANGE": .orange
    case "AMBER": .yellow
    case "RED": .red
    default: .secondary
    }
}

private let symbols: [String: String] = [
    "server": "server.rack", "server-network": "network", "cube-outline": "cube", "monitor": "display",
    "monitor-small": "display", "console": "terminal", "console-line": "terminal", "remote-desktop": "rectangle.on.rectangle",
    "microsoft-windows": "pc", "apple": "apple.logo", "raspberry-pi": "cpu", "docker": "shippingbox",
    "folder": "folder", "folder-open": "folder.fill", "folder-outline": "folder", "folder-plus-outline": "folder.badge.plus",
    "domain": "building.2.fill", "domain-off": "building.2", "link-variant": "link", "file-outline": "doc",
    "file-document-outline": "doc.text", "file-pdf-box": "doc.richtext", "file-image-outline": "photo",
    "file-video-outline": "film", "file-music-outline": "music.note", "zip-box-outline": "doc.zipper",
    "code-json": "curlybraces", "file-code-outline": "chevron.left.forwardslash.chevron.right",
    "file-cog-outline": "gearshape", "database-outline": "cylinder", "file-edit-outline": "square.and.pencil",
    "file-move-outline": "arrow.right.doc.on.clipboard", "information-outline": "info.circle",
    "trash-can-outline": "trash", "lock-outline": "lock", "magnify": "magnifyingglass",
    "devices": "laptopcomputer.and.iphone", "application": "app.badge", "cellphone-link": "iphone.radiowaves.left.and.right",
    "cellphone": "iphone", "tablet": "ipad", "laptop": "laptopcomputer",
    "format-list-bulleted": "list.bullet", "lan-connect": "bolt.horizontal", "broadcast": "dot.radiowaves.left.and.right", "restore": "arrow.counterclockwise",
    "web": "globe", "script-text-outline": "scroll", "power": "power", "play": "play", "stop": "stop",
    "content-duplicate": "plus.square.on.square", "refresh": "arrow.clockwise", "power-sleep": "moon.zzz", "close": "xmark", "lan-disconnect": "link.badge.minus",
    "keyboard-outline": "keyboard", "text-box-outline": "doc.plaintext", "monitor-screenshot": "camera.viewfinder",
    "cursor-default-click": "cursorarrow.click", "mouse": "computermouse", "clipboard-text-outline": "doc.on.clipboard",
    "help-circle-outline": "questionmark.circle",
]

func sfSymbol(_ key: String) -> String { symbols[key] ?? "server.rack" }

struct Row: View {
    let title: String
    var subtitle: String?
    let icon: String
    var color: Color = accent

    var body: some View {
        Label {
            Text(title)
            if let subtitle { Text(subtitle) }
        } icon: {
            Image(systemName: icon).foregroundStyle(color)
        }
    }
}

struct ViewOnlyBanner: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "eye")
            .font(.footnote)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.regularMaterial)
    }
}

struct SessionStateOverlay: View {
    let state: ConnectionState
    let ready: Bool
    let reconnect: () -> Void

    var body: some View {
        if state == ConnectionState.disconnected {
            ContentUnavailableView {
                Label("Disconnected", systemImage: "bolt.horizontal.circle")
            } description: {
                Text("The connection to the server was lost.")
            } actions: {
                Button("Reconnect", action: reconnect).buttonStyle(.borderedProminent)
            }
            .background(.background)
        } else if !ready {
            ProgressView("Connecting…").controlSize(.large)
        }
    }
}

extension View {
    func errorAlert(_ error: String?, clear: @escaping () -> Void) -> some View {
        alert("Error", isPresented: Binding(get: { error != nil }, set: { if !$0 { clear() } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(error ?? "")
        }
    }
}
