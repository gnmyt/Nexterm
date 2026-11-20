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
        .overlay(alignment: .bottomLeading) {
            if let message = session.viewOnlyMessage { ViewOnlyBanner(text: message) }
        }
        .overlay {
            if state.value == ConnectionState.disconnected {
                SessionStateOverlay(session: session, state: state.value, ready: false)
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
            if !hasFrame.value && error.value == nil { ConnectionLoader() }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if hasFrame.value { bar }
        }
        .errorAlert(error.value.map { "Error: \($0)" }) { viewport.state.client.clearError() }
    }

    private var bar: some View {
        HStack(spacing: 0) {
            if !viewOnly {
                Button(typing ? "Hide Keyboard" : "Show Keyboard", systemImage: typing ? "keyboard.chevron.compact.down" : "keyboard") { typing.toggle() }
                    .buttonStyle(KeyCapStyle(active: typing))
                    .padding(.leading, 8).padding(.trailing, 6)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        Button(mouse == .direct ? "Touch Input" : "Mouse Input", systemImage: mouse == .direct ? "hand.tap" : "cursorarrow") {
                            mouse = mouse == .direct ? .virtualMouse : .direct
                            viewport.mouseMode = mouse
                        }
                        .buttonStyle(KeyCapStyle(active: mouse == .virtualMouse))
                        Button("CTRL") { kb.toggleCtrl() }.buttonStyle(KeyCapStyle(active: ctrl.value))
                        Button("ALT") { kb.toggleAlt() }.buttonStyle(KeyCapStyle(active: alt.value))
                        Button("SHIFT") { kb.toggleShift() }.buttonStyle(KeyCapStyle(active: shift.value))
                        ForEach(GuacKeysym.shared.toolbar, id: \.label) { k in
                            Button(k.label.uppercased()) { kb.sendKeyPress(keysym: k.keysym) }
                                .buttonStyle(KeyCapStyle())
                                .buttonRepeatBehavior(.enabled)
                        }
                        Button("CTRL+ALT+DEL") { kb.sendCtrlAltDel() }.buttonStyle(KeyCapStyle())
                    }
                    .padding(.horizontal, 2)
                }
            } else {
                Spacer()
            }
            Button("Fit to Screen", systemImage: "arrow.up.left.and.arrow.down.right") { viewport.fit() }
                .buttonStyle(KeyCapStyle())
                .padding(.leading, 6).padding(.trailing, 8)
        }
        .labelStyle(.iconOnly)
        .padding(.vertical, 7)
        .background(NX.surface.ignoresSafeArea(edges: .bottom))
        .hairline(.top)
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
}

private struct GuacCanvas: UIViewControllerRepresentable {
    let viewport: GuacamoleViewport
    func makeUIViewController(context: Context) -> UIViewController {
        GuacamoleViewControllerKt.GuacamoleViewController(viewport: viewport)
    }
    func updateUIViewController(_ vc: UIViewController, context: Context) {}
}
