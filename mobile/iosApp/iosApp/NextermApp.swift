import SwiftUI
import NextermKit

@main
struct NextermApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup { RootView() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { nx.onResume() }
            }
    }
}

struct RootView: View {
    var body: some View {
        Group {
            if app.authenticated.value { MainTabs() } else { DeviceSetupView() }
        }
        .toastHost()
        .tint(accent)
        .preferredColorScheme(app.colorScheme)
    }
}

struct MainTabs: View {
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let sessions = app.sessions.value
        let compact = sizeClass == .compact
        let docked = compact && !sessions.isEmpty
        tabs(docked: docked)
            .fullScreenCover(isPresented: Binding(get: { app.sessionOpen && docked }, set: { app.sessionOpen = $0 })) {
                NavigationStack { ActiveSessionView() }
                    .toastHost()
                    .tint(accent)
                    .preferredColorScheme(app.colorScheme)
            }
            .onChange(of: sessions.isEmpty) { _, empty in if empty { app.sessionOpen = false } }
            .onChange(of: app.aiAvailable.value) { _, available in
                if !available && app.tab == .assistant { app.tab = .servers }
            }
    }

    @ViewBuilder private func tabs(docked: Bool) -> some View {
        let view = TabView(selection: Binding(get: { app.tab }, set: { app.tab = $0 })) {
            Tab("Servers", systemImage: "server.rack", value: AppTab.servers) { ServersView() }
            Tab("Monitoring", systemImage: "waveform.path.ecg", value: AppTab.monitoring) { MonitoringView() }
            if app.aiAvailable.value {
                Tab("Assistant", systemImage: "sparkles", value: AppTab.assistant) { AssistantTab() }
            }
            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) { SettingsView() }
        }
        if #available(iOS 26.1, *) {
            view.tabViewBottomAccessory(isEnabled: docked) { SessionDock() }
        } else {
            view.overlay(alignment: .bottom) {
                if docked {
                    SessionDock().padding(.horizontal, 12).frame(height: 52).card(radius: 26, fill: NX.surfaceHigh)
                        .padding(.horizontal, 16).padding(.bottom, 58)
                }
            }
        }
    }
}

struct SessionDock: View {
    var body: some View {
        let sessions = app.sessions.value
        if let s = app.active.value ?? sessions.first {
            HStack(spacing: 10) {
                Button { app.sessionOpen = true } label: {
                    HStack(spacing: 10) {
                        Image(systemName: s.isViewOnly ? "eye" : sfSymbol(s.type.iconKey))
                            .font(.subheadline.weight(.semibold)).foregroundStyle(accent).frame(width: 24)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(s.server.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                            Text(sessions.count > 1 ? "\(s.type.label) · \(sessions.count) sessions open" : s.type.label)
                                .font(.caption).foregroundStyle(NX.subtext).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Button("Close Session", systemImage: "xmark") { closeSession(s.sessionId) }
                .labelStyle(.iconOnly).font(.footnote.weight(.bold)).foregroundStyle(NX.subtext)
                .frame(width: 32, height: 32).contentShape(Rectangle())
            }
            .padding(.horizontal, 14)
        }
    }
}
