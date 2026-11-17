import SwiftUI
import NextermKit

struct GuacamoleSessionView: View {
    let session: AppSession
    @State private var viewport: FlowState<GuacamoleViewport?>
    @State private var state: FlowState<ConnectionState>

    init(session: AppSession) {
        self.session = session
        _viewport = State(initialValue: FlowState(session.guacamole!.viewport, or: nil as GuacamoleViewport?))
        _state = State(initialValue: FlowState(session.connectionState, or: ConnectionState.connecting))
    }

    var body: some View {
        ZStack {
            Color.black
            if let vp = viewport.value { GuacamoleDisplay(viewport: vp, viewOnly: session.isViewOnly).id(ObjectIdentifier(vp)) }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let agent = session.agent { ViewOnlyBanner(text: agent.viewOnlyMessage) }
        }
        .overlay {
            if state.value == ConnectionState.disconnected {
                SessionStateOverlay(state: state.value, ready: false) { nx.sessions.reconnect(session: session) }
            }
        }
    }
}

private struct GuacamoleDisplay: View {
    let viewport: GuacamoleViewport
    let viewOnly: Bool
    @State private var hasFrame: FlowState<Bool>
    @State private var error: FlowState<String?>
    @State private var ctrl: FlowState<Bool>
    @State private var alt: FlowState<Bool>
    @State private var shift: FlowState<Bool>
    @State private var mouse: GuacMouseMode
    @State private var text = ""
    @FocusState private var typing: Bool

    init(viewport: GuacamoleViewport, viewOnly: Bool) {
        self.viewport = viewport
        self.viewOnly = viewOnly
        let kb = viewport.state.keyboard
        _hasFrame = State(initialValue: FlowState(viewport.state.hasFrame, or: false))
        _error = State(initialValue: FlowState(viewport.state.client.error, or: nil as String?))
        _ctrl = State(initialValue: FlowState(kb.ctrl, or: false))
        _alt = State(initialValue: FlowState(kb.alt, or: false))
        _shift = State(initialValue: FlowState(kb.shift, or: false))
        _mouse = State(initialValue: viewport.mouseMode)
    }

    private var kb: GuacKeyboard { viewport.state.keyboard }

    var body: some View {
        ZStack {
            GuacCanvas(viewport: viewport)
            if !viewOnly { keyInput }
            if !hasFrame.value && error.value == nil { ProgressView("Connecting…").controlSize(.large).tint(.white).foregroundStyle(.white) }
        }
        .errorAlert(error.value.map { "Error: \($0)" }) { viewport.state.client.clearError() }
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if viewOnly {
                    Button("Fit to Screen", systemImage: "arrow.up.left.and.arrow.down.right") { viewport.fit() }
                } else {
                    Button(typing ? "Hide Keyboard" : "Show Keyboard", systemImage: typing ? "keyboard.chevron.compact.down" : "keyboard") {
                        typing.toggle()
                    }
                    tools
                }
            }
        }
    }

    private var keyInput: some View {
        TextField("", text: $text)
            .focused($typing)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .frame(width: 1, height: 1)
            .opacity(0.01)
            .accessibilityHidden(true)
            .onChange(of: text) { _, t in kb.onTextFieldChanged(text: t) }
            .onSubmit {
                kb.sendKeyPress(keysym: GuacKeysym.shared.ENTER)
                kb.resetTextField()
                text = ""
                typing = true
            }
    }

    private var tools: some View {
        Menu("Tools", systemImage: "ellipsis.circle") {
            Picker("Input", selection: Binding(get: { mouse }, set: { mouse = $0; viewport.mouseMode = $0 })) {
                Label("Touch", systemImage: "hand.tap").tag(GuacMouseMode.direct)
                Label("Mouse", systemImage: "cursorarrow").tag(GuacMouseMode.virtualMouse)
            }
            Button("Fit to Screen", systemImage: "arrow.up.left.and.arrow.down.right") { viewport.fit() }
            Button("Ctrl+Alt+Del", systemImage: "command") { kb.sendCtrlAltDel() }
            Section("Modifiers") {
                Toggle("Ctrl", isOn: Binding(get: { ctrl.value }, set: { _ in kb.toggleCtrl() }))
                Toggle("Alt", isOn: Binding(get: { alt.value }, set: { _ in kb.toggleAlt() }))
                Toggle("Shift", isOn: Binding(get: { shift.value }, set: { _ in kb.toggleShift() }))
            }
            Menu("Keys", systemImage: "keyboard") {
                ForEach(GuacKeysym.shared.toolbar, id: \.label) { k in
                    Button(k.label) { kb.sendKeyPress(keysym: k.keysym) }
                }
            }
        }
    }
}

private struct GuacCanvas: UIViewControllerRepresentable {
    let viewport: GuacamoleViewport
    func makeUIViewController(context: Context) -> UIViewController {
        GuacamoleViewControllerKt.GuacamoleViewController(viewport: viewport)
    }
    func updateUIViewController(_ vc: UIViewController, context: Context) {}
}
