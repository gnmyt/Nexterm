import SwiftUI
import NextermKit

struct DeviceSetupView: View {
    var adding = false

    var body: some View {
        Scoped(make: nx.doNewDeviceSetupFlow, close: { $0.close() }) { DeviceSetupForm(flow: $0, adding: adding) }
    }
}

private struct DeviceSetupForm: View {
    let flow: DeviceSetupFlow
    let adding: Bool
    @State private var state: FlowState<DeviceSetupState>
    @State private var url = ""
    @State private var scanning = false
    @State private var copied = false
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    init(flow: DeviceSetupFlow, adding: Bool) {
        self.flow = flow
        self.adding = adding
        _state = State(initialValue: FlowState(flow.state) { $0 as! DeviceSetupState })
    }

    var body: some View {
        let s = state.value
        NavigationStack {
            Form {
                if !adding {
                    VStack(spacing: 8) {
                        Image("Logo").resizable().scaledToFit().frame(width: 72, height: 72).accessibilityHidden(true)
                        Text("Nexterm").font(.largeTitle.bold())
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
                if s.step == DeviceSetupStep.serverUrl {
                    Section {
                        TextField("Server URL", text: $url, prompt: Text("nexterm.example.com"))
                            .keyboardType(.URL)
                            .textContentType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.go)
                            .onSubmit(connect)
                    } footer: {
                        Text(s.error ?? "Enter the URL of your Nexterm server to connect.").foregroundStyle(s.error == nil ? .secondary : Color.red)
                    }
                    Section {
                        Button("Scan QR Code", systemImage: "qrcode.viewfinder") { scanning = true }
                            .disabled(s.isLoading)
                    }
                } else if s.step == DeviceSetupStep.authChoice {
                    Section("Choose how to authenticate with the server") {
                        Button { flow.showCode() } label: {
                            Row(title: "Enter Code", subtitle: "Display a code to enter on the web interface", icon: "number")
                        }
                        Button(action: openBrowser) {
                            Row(title: "Open in Browser", subtitle: "Open your browser to authorize", icon: "arrow.up.right.square")
                        }
                    }
                    .tint(.primary)
                } else if s.step == DeviceSetupStep.code {
                    Section {
                        Text(s.deviceCode ?? "----")
                            .font(.largeTitle.monospaced().bold())
                            .foregroundStyle(.tint)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                        Button("Copy Code", systemImage: "doc.on.doc") {
                            UIPasteboard.general.string = s.deviceCode
                            copied.toggle()
                        }
                        .sensoryFeedback(.success, trigger: copied)
                        Button("Open Browser", systemImage: "arrow.up.right.square", action: openBrowser)
                    } header: {
                        Text("Enter this code on your Nexterm web interface")
                    } footer: {
                        waiting("Waiting for authorization…")
                    }
                } else {
                    Section { } footer: { waiting("Connecting to server…") }
                }
                if let error = s.error, s.step != DeviceSetupStep.serverUrl {
                    Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red) }
                }
            }
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
            .background { Color(.systemGroupedBackground).ignoresSafeArea() }
            .navigationTitle(adding ? "Add Server" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if adding { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                if s.step == DeviceSetupStep.serverUrl {
                    ToolbarItem(placement: .confirmationAction) {
                        if s.isLoading { ProgressView() } else { Button("Connect", action: connect).disabled(url.trimmingCharacters(in: .whitespaces).isEmpty) }
                    }
                }
                if s.step != DeviceSetupStep.serverUrl {
                    ToolbarItem(placement: .topBarLeading) { Button("Back", systemImage: "chevron.backward") { flow.back() } }
                }
            }
        }
        .sheet(isPresented: $scanning) {
            QRScannerSheet(title: "Scan QR Code", hint: "Open \"Link Device\" in your web browser and scan the QR code shown there.") { raw in
                flow.handleScannedQr(raw: raw)
            }
        }
        .onChange(of: s.step) { _, step in
            if step == DeviceSetupStep.done {
                app.show("Successfully authenticated!")
                if adding { dismiss() }
            }
        }
    }

    private func connect() { Task { try? await flow.connect(url: url) } }

    private func openBrowser() {
        if let link = flow.openInBrowser(), let url = URL(string: link) { openURL(url) }
    }

    private func waiting(_ text: String) -> some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(text)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }
}
