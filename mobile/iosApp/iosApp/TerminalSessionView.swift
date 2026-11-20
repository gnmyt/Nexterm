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
        let ready = received.value || error.value != nil
        TerminalSurface(controller: terminal.controller, onTap: { if !session.isViewOnly { keyboard = true } })
            .background { if !session.isViewOnly { KeyCapture(active: $keyboard, controller: terminal.controller) } }
            .background(NX.terminal, ignoresSafeAreaEdges: [])
            .overlay {
                SessionStateOverlay(session: session, state: state.value, ready: ready, message: error.value) { terminal.clearError() }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if let message = session.viewOnlyMessage {
                    ViewOnlyBanner(text: message).frame(maxWidth: .infinity, alignment: .leading)
                } else if ready && state.value != ConnectionState.disconnected {
                    KeyBar(controller: terminal.controller, keyboard: $keyboard)
                }
            }
            .background(NX.terminal.ignoresSafeArea())
            .errorAlert(state.value == ConnectionState.disconnected ? nil : error.value) { terminal.clearError() }
    }
}

private struct KeyBar: View {
    let controller: TerminalController
    @Binding var keyboard: Bool
    @State private var ctrl: FlowState<Bool>
    @State private var alt: FlowState<Bool>

    init(controller: TerminalController, keyboard: Binding<Bool>) {
        self.controller = controller
        _keyboard = keyboard
        _ctrl = State(initialValue: FlowState(controller.ctrlActive, or: false))
        _alt = State(initialValue: FlowState(controller.altActive, or: false))
    }

    var body: some View {
        HStack(spacing: 0) {
            Button(keyboard ? "Hide Keyboard" : "Show Keyboard", systemImage: keyboard ? "keyboard.chevron.compact.down" : "keyboard") { keyboard.toggle() }
                .buttonStyle(KeyCapStyle(active: keyboard))
                .padding(.leading, 8).padding(.trailing, 6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(nx.terminalSettings.toolbarKeys(), id: \.self) { key in
                        if key.isToggle {
                            Button(key.label) { controller.press(key: key) }
                                .buttonStyle(KeyCapStyle(active: key == ToolbarKey.ctrl ? ctrl.value : alt.value))
                        } else {
                            Button(key.label) { controller.press(key: key) }
                                .buttonStyle(KeyCapStyle())
                                .buttonRepeatBehavior(key.isCompact ? .enabled : .disabled)
                        }
                    }
                }
                .padding(.horizontal, 2)
            }
            .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.03), .init(color: .black, location: 0.97), .init(color: .clear, location: 1)],
                                 startPoint: .leading, endPoint: .trailing))
            Menu {
                Button("Paste", systemImage: "doc.on.clipboard") {
                    if let text = UIPasteboard.general.string { controller.paste(text: text) }
                }
                Button("Copy Selection", systemImage: "doc.on.doc") {
                    if let text = controller.doCopySelection() { UIPasteboard.general.string = text }
                }
            } label: {
                Label("Clipboard", systemImage: "doc.on.clipboard")
            } primaryAction: {
                if let text = controller.doCopySelection(), !text.isEmpty { UIPasteboard.general.string = text }
                else if let text = UIPasteboard.general.string { controller.paste(text: text) }
            }
            .buttonStyle(KeyCapStyle())
            .padding(.leading, 6).padding(.trailing, 8)
        }
        .labelStyle(.iconOnly)
        .sensoryFeedback(.selection, trigger: ctrl.value)
        .sensoryFeedback(.selection, trigger: alt.value)
        .padding(.vertical, 7)
        .background(NX.surface.ignoresSafeArea(edges: .bottom))
        .hairline(.top)
    }
}

private struct KeyCapture: UIViewRepresentable {
    @Binding var active: Bool
    let controller: TerminalController

    func makeUIView(context: Context) -> KeyInputView {
        let view = KeyInputView()
        view.onResign = { active = false }
        view.attach(controller: controller)
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
    var onResign: () -> Void = {}

    var autocorrectionType = UITextAutocorrectionType.no
    var autocapitalizationType = UITextAutocapitalizationType.none
    var spellCheckingType = UITextSpellCheckingType.no
    var smartQuotesType = UITextSmartQuotesType.no
    var smartDashesType = UITextSmartDashesType.no
    var smartInsertDeleteType = UITextSmartInsertDeleteType.no
    var inlinePredictionType = UITextInlinePredictionType.no
    var keyboardType = UIKeyboardType.asciiCapable

    func attach(controller: TerminalController) { self.controller = controller }

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
