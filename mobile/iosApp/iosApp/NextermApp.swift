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
        .alert(app.message ?? "", isPresented: Binding(get: { app.message != nil }, set: { if !$0 { app.message = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .tint(accent)
        .preferredColorScheme(app.themeMode.value == ThemeMode.light ? .light : app.themeMode.value == ThemeMode.dark ? .dark : nil)
    }
}

struct MainTabs: View {
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let sessions = app.sessions.value
        let compact = sizeClass == .compact
        TabView(selection: Binding(get: { app.tab }, set: { app.tab = $0 })) {
            Tab("Servers", systemImage: "server.rack", value: AppTab.servers) { ServersView() }
            if compact && !sessions.isEmpty {
                Tab("Sessions", systemImage: "display", value: AppTab.sessions) { SessionsView() }
                    .badge(sessions.count)
            }
            Tab("Monitoring", systemImage: "chart.bar", value: AppTab.monitoring) { MonitoringView() }
            Tab("Settings", systemImage: "gear", value: AppTab.settings) { SettingsView() }
        }
        .onChange(of: sessions.isEmpty) { _, empty in
            if empty && app.tab == .sessions { app.tab = .servers }
        }
        .onChange(of: compact) { _, compact in
            if !compact && app.tab == .sessions { app.tab = .servers }
            if compact && app.tab == .servers && app.active.value != nil { app.tab = .sessions }
        }
    }
}
