import SwiftUI
import UIKit
import NextermKit

struct TerminalSessionView: View {
    let session: AppSession
    let terminal: TerminalConnection
    @State private var state: FlowState<ConnectionState>
    @State private var received: FlowState<Bool>
    @State private var error: FlowState<String?>
    @State private var keyboard = false

    init(session: AppSession, terminal: TerminalConnection) {
        self.session = session
        self.terminal = terminal
        _state = State(initialValue: FlowState(terminal.state, or: ConnectionState.connecting))
        _received = State(initialValue: FlowState(terminal.receivedData, or: false))
        _error = State(initialValue: FlowState(terminal.error, or: nil as String?))
    }

    var body: some View {
        TerminalSurface(controller: terminal.controller, onTap: { if !session.isViewOnly { keyboard = true } })
            .background { if !session.isViewOnly { KeyCapture(active: $keyboard, controller: terminal.controller) } }
            .background(.black, ignoresSafeAreaEdges: [])
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if let agent = session.agent { ViewOnlyBanner(text: agent.viewOnlyMessage) }
            }
            .overlay {
                SessionStateOverlay(state: state.value, ready: received.value || error.value != nil) {
                    nx.sessions.reconnect(session: session)
                }
            }
            .errorAlert(error.value) { terminal.clearError() }
            .toolbar {
                if !session.isViewOnly {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(keyboard ? "Hide Keyboard" : "Show Keyboard", systemImage: keyboard ? "keyboard.chevron.compact.down" : "keyboard") {
                            keyboard.toggle()
                        }
                    }
                }
            }
    }
}

private struct KeyBar: View {
    let controller: TerminalController
    let hide: () -> Void
    @State private var ctrl: FlowState<Bool>
    @State private var alt: FlowState<Bool>

    init(controller: TerminalController, hide: @escaping () -> Void) {
        self.controller = controller
        self.hide = hide
        _ctrl = State(initialValue: FlowState(controller.ctrlActive, or: false))
        _alt = State(initialValue: FlowState(controller.altActive, or: false))
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(nx.terminalSettings.toolbarKeys(), id: \.self) { key in
                    if key.isToggle {
                        Toggle(key.label, isOn: Binding(get: { key == ToolbarKey.ctrl ? ctrl.value : alt.value },
                                                        set: { _ in controller.press(key: key) }))
                            .toggleStyle(.button)
                    } else {
                        Button(key.label) { controller.press(key: key) }
                    }
                }
                Divider()
                Button("Copy", systemImage: "doc.on.doc") {
                    if let text = controller.doCopySelection() { UIPasteboard.general.string = text }
                }
                Button("Paste", systemImage: "doc.on.clipboard") {
                    if let text = UIPasteboard.general.string { controller.paste(text: text) }
                }
                Button("Hide Keyboard", systemImage: "keyboard.chevron.compact.down", action: hide)
            }
            .labelStyle(.iconOnly)
            .buttonStyle(.bordered)
            .font(.callout.monospaced().weight(.medium))
            .padding(.horizontal, 8)
        }
    }
}

private struct KeyCapture: UIViewRepresentable {
    @Binding var active: Bool
    let controller: TerminalController

    func makeUIView(context: Context) -> KeyInputView {
        let view = KeyInputView()
        view.onResign = { active = false }
        view.attach(controller: controller, bar: KeyBar(controller: controller) { active = false })
        return view
    }

    func updateUIView(_ view: KeyInputView, context: Context) {
        let want = active
        DispatchQueue.main.async {
            if want && !view.isFirstResponder { view.becomeFirstResponder() }
            if !want && view.isFirstResponder { _ = view.resignFirstResponder() }
        }
    }
}

final class KeyInputView: UIView, UIKeyInput {
    private var controller: TerminalController?
    private var accessory: UIView?
    var onResign: () -> Void = {}

    var autocorrectionType = UITextAutocorrectionType.no
    var autocapitalizationType = UITextAutocapitalizationType.none
    var spellCheckingType = UITextSpellCheckingType.no
    var smartQuotesType = UITextSmartQuotesType.no
    var smartDashesType = UITextSmartDashesType.no
    var smartInsertDeleteType = UITextSmartInsertDeleteType.no
    var inlinePredictionType = UITextInlinePredictionType.no
    var keyboardType = UIKeyboardType.asciiCapable

    func attach(controller: TerminalController, bar: some View) {
        self.controller = controller
        let host = UIHostingController(rootView: bar.tint(accent))
        host.safeAreaRegions = []
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        let input = UIInputView(frame: CGRect(x: 0, y: 0, width: 0, height: 52), inputViewStyle: .keyboard)
        let material = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
        material.frame = input.bounds
        material.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        input.addSubview(material)
        input.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: input.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: input.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: input.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: input.bottomAnchor),
        ])
        accessory = input
    }

    override var inputAccessoryView: UIView? { accessory }
    override var canBecomeFirstResponder: Bool { true }
    var hasText: Bool { true }

    func insertText(_ text: String) {
        if text == "\n" { send(.enter) } else { controller?.input(text: text) }
    }

    func deleteBackward() { send(.backspace) }

    override func resignFirstResponder() -> Bool {
        let resigned = super.resignFirstResponder()
        DispatchQueue.main.async { self.onResign() }
        return resigned
    }

    override func paste(_ sender: Any?) {
        if let text = UIPasteboard.general.string { controller?.paste(text: text) }
    }

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        action == #selector(paste(_:)) || super.canPerformAction(action, withSender: sender)
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        var unhandled = Set<UIPress>()
        for press in presses {
            guard let key = press.key else { unhandled.insert(press); continue }
            let mapped = Self.keys[key.keyCode] ?? (key.modifierFlags.contains(.control)
                ? key.charactersIgnoringModifiers.utf16.first.flatMap { TerminalKey.companion.forChar(c: $0) } : nil)
            if let mapped { send(mapped, key.modifierFlags) } else { unhandled.insert(press) }
        }
        if !unhandled.isEmpty { super.pressesBegan(unhandled, with: event) }
    }

    private func send(_ key: TerminalKey, _ flags: UIKeyModifierFlags = []) {
        controller?.sendKey(key: key, ctrl: flags.contains(.control), alt: flags.contains(.alternate), shift: flags.contains(.shift))
    }

    private static let keys: [UIKeyboardHIDUsage: TerminalKey] = {
        var map: [UIKeyboardHIDUsage: TerminalKey] = [
            .keyboardUpArrow: .arrowUp, .keyboardDownArrow: .arrowDown, .keyboardLeftArrow: .arrowLeft,
            .keyboardRightArrow: .arrowRight, .keyboardEscape: .escape, .keyboardHome: .home, .keyboardEnd: .end,
            .keyboardPageUp: .pageUp, .keyboardPageDown: .pageDown, .keyboardTab: .tab,
            .keyboardInsert: .insert, .keyboardDeleteForward: .delete_,
        ]
        let fKeys: [UIKeyboardHIDUsage] = [.keyboardF1, .keyboardF2, .keyboardF3, .keyboardF4, .keyboardF5, .keyboardF6,
                                           .keyboardF7, .keyboardF8, .keyboardF9, .keyboardF10, .keyboardF11, .keyboardF12]
        for (i, usage) in fKeys.enumerated() { map[usage] = TerminalKey.companion.function(n: Int32(i + 1)) }
        return map
    }()
}
