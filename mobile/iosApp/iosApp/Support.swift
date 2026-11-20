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

enum AppTab: Hashable { case servers, monitoring, assistant, settings }

@Observable final class AppModel {
    var tab = AppTab.servers
    var toast: Toast?
    var sessionOpen = false
    @ObservationIgnored let authenticated = FlowState(nx.accounts.isAuthenticated, or: false)
    @ObservationIgnored let account = FlowState(nx.accounts.activeAccount, or: nil as ServerAccount?)
    @ObservationIgnored let sessions = FlowState(nx.sessions.sessions, or: [AppSession]())
    @ObservationIgnored let active = FlowState(nx.sessions.activeSession, or: nil as AppSession?)
    @ObservationIgnored let fullscreen = FlowState(nx.sessions.fullscreen, or: false)
    @ObservationIgnored let trust = FlowState(nx.sessions.trustChallenges, or: [String: TrustChallenge]())
    @ObservationIgnored let aiAvailable = FlowState(nx.ai.isAvailable, or: false)
    @ObservationIgnored let themeMode = FlowState(nx.themeSettings.themeMode, or: ThemeMode.system)
    @ObservationIgnored let accent = FlowState(nx.themeSettings.accentColor) { ($0 as? NSNumber)?.int64Value ?? 0xFF314BD3 }
    @ObservationIgnored let servers = nx.doNewServerList()
    @ObservationIgnored let monitoring = nx.doNewMonitoring()

    var colorScheme: ColorScheme? { themeMode.value == ThemeMode.light ? .light : themeMode.value == ThemeMode.dark ? .dark : nil }

    func show(_ message: String, error: Bool? = nil) {
        let lower = message.lowercased()
        toast = Toast(text: message, isError: error ?? ["fail", "error", "offline", "not ", "lost", "denied"].contains { lower.contains($0) })
    }
}

func closeSession(_ id: String) {
    Task { try? await nx.sessions.closeSession(sessionId: id) }
}

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
    case "TERTIARY": NX.proxmox
    case "PINK": Color(hex: 0xDB2777)
    case "PURPLE": Color(hex: 0xA78BFA)
    case "ORANGE": NX.warning
    case "AMBER": NX.amber
    case "RED": NX.error
    default: NX.subtext
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

struct IconTile: View {
    let symbol: String
    let color: Color
    var size: CGFloat = 32

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.47, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: size, height: size)
            .background(color.opacity(0.16), in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}

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
            IconTile(symbol: icon, color: color, size: 30)
        }
    }
}

struct ViewOnlyBanner: View {
    let text: String
    @State private var expanded = false

    var body: some View {
        Button { withAnimation(.snappy) { expanded.toggle() } } label: {
            Label(expanded ? text : "View only", systemImage: "eye.fill")
                .font(.footnote.weight(.medium))
                .multilineTextAlignment(.leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .card(radius: 16, fill: NX.surfaceHigh)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .accessibilityLabel(text)
    }
}

struct SessionStateOverlay: View {
    let session: AppSession
    let state: ConnectionState
    let ready: Bool
    var message: String?
    var beforeReconnect: () -> Void = {}

    var body: some View {
        if state == ConnectionState.disconnected {
            ZStack(alignment: .top) {
                NX.background.ignoresSafeArea()
                Rectangle().fill(NX.error).frame(height: 2)
                VStack(spacing: 24) {
                    LinkGlyph(symbol: "exclamationmark.circle.fill", color: NX.error, size: 26)
                    VStack(spacing: 8) {
                        Text("Connection failed").font(.title2.weight(.semibold))
                        Text(message ?? "The connection to \(session.server.name) was lost.")
                            .font(.subheadline).foregroundStyle(NX.subtext).multilineTextAlignment(.center)
                    }
                    HStack(spacing: 12) {
                        Button("Close", systemImage: "xmark") { closeSession(session.sessionId) }.buttonStyle(.bordered)
                        Button("Reconnect", systemImage: "arrow.clockwise") {
                            beforeReconnect()
                            nx.sessions.reconnect(sessionId: session.sessionId)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .controlSize(.large)
                }
                .padding(32)
                .frame(maxWidth: 460)
                .frame(maxHeight: .infinity)
            }
        } else if !ready {
            ConnectionLoader()
        }
    }
}

struct ConnectionLoader: View {
    @State private var start = Date()

    private static let keys: [(time: Double, width: Double)] = [(0, 0), (0.4, 0.22), (1.2, 0.32), (2.4, 0.45), (4, 0.55), (5.6, 0.65), (6.8, 0.75), (8, 0.85)]

    private static func progress(_ t: Double) -> Double {
        guard let next = keys.firstIndex(where: { $0.time >= t }), next > 0 else { return t <= 0 ? 0 : 0.85 }
        let (a, b) = (keys[next - 1], keys[next])
        return a.width + (b.width - a.width) * (t - a.time) / (b.time - a.time)
    }

    var body: some View {
        TimelineView(.animation) { context in
            let t = context.date.timeIntervalSince(start)
            ZStack(alignment: .topLeading) {
                NX.background.ignoresSafeArea()
                GeometryReader { geo in
                    Rectangle().fill(accentFill).frame(width: geo.size.width * Self.progress(t), height: 2)
                }
                HStack(spacing: 32) {
                    Image(systemName: "laptopcomputer").font(.system(size: 34)).foregroundStyle(NX.subtext)
                    HStack(spacing: 12) {
                        ForEach(0..<3, id: \.self) { i in
                            let phase = 0.5 - 0.5 * cos(2 * .pi * max(0, t - Double(i) * 0.3) / 1.5)
                            Circle().fill(accentFill).frame(width: 6, height: 6).opacity(phase).offset(x: -4 + 8 * phase)
                        }
                    }
                    Image(systemName: "server.rack").font(.system(size: 34)).foregroundStyle(NX.subtext)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Connecting")
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
