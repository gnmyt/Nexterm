import SwiftUI
import Speech
import AVFoundation
import Textual
import NextermKit

struct AssistantTab: View {
    var body: some View {
        NavigationStack { AssistantView() }
    }
}

private struct AssistantView: View {
    private let chat = nx.assistant
    @State private var state = FlowState(nx.assistant.state) { $0 as! AIChatState }
    @State private var input = ""
    @State private var speech = SpeechInput()
    @State private var picking = false
    @FocusState private var composing: Bool

    var body: some View {
        let s = state.value
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(s.messages, id: \.id) { MessageView(message: $0, chat: chat, pinned: $0.id == s.pendingApproval?.id) }
                if s.isRunning && s.pendingApproval == nil {
                    HStack(spacing: 8) { ProgressView().controlSize(.small); Text("Working…") }.font(.subheadline).foregroundStyle(NX.subtext)
                }
                if s.canContinue && !s.isRunning {
                    Button("Continue", systemImage: "arrow.forward.circle") { chat.continueRun() }
                        .buttonStyle(.bordered).buttonBorderShape(.capsule)
                }
                if let e = s.connectionError, !s.isUnavailable {
                    HStack {
                        Label(e, systemImage: "wifi.exclamationmark").font(.footnote).foregroundStyle(NX.error)
                        Spacer()
                        if !s.isReconnecting { Button("Retry") { chat.retry() }.font(.footnote.weight(.semibold)) }
                    }
                    .padding(12).card(radius: 14)
                }
            }
            .padding(16)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
        .background(NX.background.ignoresSafeArea())
        .overlay {
            if s.isUnavailable { unavailable(s) } else if s.messages.isEmpty && !composing { welcome(s) }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !s.isUnavailable {
                VStack(spacing: 8) {
                    if let pending = s.pendingApproval, let callId = pending.callId { approval(pending, callId) }
                    scope(s)
                    composer(s)
                }
                .padding(.top, 8)
                .padding(.bottom, 8)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
                .background(.bar)
            }
        }
        .navigationTitle("Assistant")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Menu {
                    Picker("Permissions", selection: Binding(get: { s.approvalMode }, set: { chat.setApprovalMode(mode: $0) })) {
                        ForEach(ApprovalMode.entries, id: \.self) { mode in
                            Label { Text(mode.label); Text(mode.detail) } icon: { Image(systemName: modeSymbol(mode)) }.tag(mode)
                        }
                    }
                } label: {
                    Label("Permissions: \(s.approvalMode.label)", systemImage: modeSymbol(s.approvalMode))
                }
                Button("New Chat", systemImage: "square.and.pencil") {
                    input = ""
                    chat.doNewChat()
                }
                .disabled(s.messages.isEmpty)
            }
        }
        .sheet(isPresented: $picking) { ServerPickerSheet(chat: chat, state: state) }
        .task { chat.activate() }
        .onDisappear { speech.stop() }
    }

    private func modeSymbol(_ mode: ApprovalMode) -> String {
        mode == ApprovalMode.allow ? "bolt.shield" : mode == ApprovalMode.readonly ? "lock.shield" : "checkmark.shield"
    }

    private func welcome(_ s: AIChatState) -> some View {
        VStack(spacing: 18) {
            NextermLogo(size: 64)
            VStack(spacing: 6) {
                Text("What should we look at?").font(.title2.weight(.bold))
                Text(s.allowedServers.isEmpty
                     ? "Add the servers the assistant may work on. It can run commands and read or edit files there, and asks before changing anything."
                     : "Working on \(s.scopeLabel). It asks before changing anything.")
                    .font(.subheadline).foregroundStyle(NX.subtext).multilineTextAlignment(.center)
            }
            VStack(spacing: 8) {
                ForEach(s.suggestions, id: \.self) { text in
                    Button {
                        if !chat.send(input: text) { input = text }
                    } label: {
                        HStack {
                            Text(text).font(.subheadline.weight(.medium))
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.caption.weight(.bold)).foregroundStyle(NX.subtext)
                        }
                        .padding(.horizontal, 14).frame(height: 46)
                        .card(radius: 14)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: 480)
    }

    private func unavailable(_ s: AIChatState) -> some View {
        ContentUnavailableView {
            Label("Assistant Unavailable", systemImage: "sparkles")
        } description: {
            Text(s.connectionError ?? "The assistant is not configured on this server.")
        } actions: {
            Button("Try Again") { chat.retry() }.buttonStyle(.bordered)
        }
    }

    private func approval(_ m: ChatMessage, _ callId: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("\(m.toolLabel) needs your approval", systemImage: "hand.raised.fill").font(.subheadline.weight(.semibold)).foregroundStyle(NX.warning)
            if !m.summary.isEmpty {
                Text(m.summary).mono(.footnote).lineLimit(6).textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10).background(NX.fill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            HStack(spacing: 10) {
                Button("Deny") { chat.confirm(callId: callId, allow: false) }.buttonStyle(SoftButtonStyle(color: NX.error))
                Button("Allow") { chat.confirm(callId: callId, allow: true) }.buttonStyle(SoftButtonStyle())
            }
        }
        .padding(14)
        .card(radius: 18, fill: NX.surfaceHigh)
        .padding(.horizontal, 12)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func scope(_ s: AIChatState) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Chip(label: s.allowedServers.isEmpty ? "Add Servers" : "Servers", symbol: "plus") { picking = true }
                ForEach(s.allowedServers, id: \.id) { server in
                    Chip(label: server.name, symbol: sfSymbol(IconKeys.shared.server(server: server)),
                         selected: server.entryId == s.activeEntryId, onRemove: { chat.revoke(server: server) }) {
                        chat.focus(server: server.entryId == s.activeEntryId ? nil : server)
                    }
                }
                if let label = s.agentSessionsLabel { Text(label).font(.caption).foregroundStyle(NX.subtext) }
            }
            .padding(.horizontal, 12)
        }
    }

    private func composer(_ s: AIChatState) -> some View {
        HStack(alignment: .bottom, spacing: 4) {
            TextField(speech.listening ? "Listening…" : s.inputHint, text: $input, axis: .vertical)
                .lineLimit(1...5)
                .focused($composing)
                .padding(.vertical, 10)
            Group {
                if s.isRunning {
                    Button("Stop", systemImage: "stop.circle.fill") { chat.stop() }.foregroundStyle(NX.error)
                } else if input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button(speech.listening ? "Stop Dictation" : "Dictate", systemImage: speech.listening ? "mic.fill" : "mic") {
                        speech.toggle { input = $0 }
                    }
                    .foregroundStyle(speech.listening ? AnyShapeStyle(.tint) : AnyShapeStyle(NX.subtext))
                    .symbolEffect(.pulse, isActive: speech.listening)
                } else {
                    Button("Send", systemImage: "arrow.up.circle.fill") {
                        speech.stop()
                        if chat.send(input: input) { input = "" }
                    }
                    .disabled(!chat.canSend(input: input))
                }
            }
            .labelStyle(.iconOnly)
            .font(.title2)
            .frame(minWidth: 38, minHeight: 40)
        }
        .padding(.leading, 16)
        .padding(.trailing, 4)
        .card(radius: 22)
        .disabled(!s.isReady)
        .padding(.horizontal, 12)
    }
}

private struct ServerPickerSheet: View {
    let chat: AIChatSession
    let state: FlowState<AIChatState>
    @State private var servers = FlowState(app.servers.allServers, or: [Server]())
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let shown = ServerFilter.shared.assistantCandidates(servers: servers.value, query: query)
        NavigationStack {
            List(shown, id: \.id) { server in
                let on = state.value.isAllowed(server: server)
                Button { chat.toggle(server: server) } label: {
                    HStack(spacing: 12) {
                        ServerTile(server: server)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(server.name).font(.body.weight(.medium)).lineLimit(1)
                            Text(server.detail).mono(.caption).foregroundStyle(NX.subtext).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: on ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(on ? accent : NX.subtext.opacity(0.5))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .brandedRows()
            }
            .brandedList()
            .overlay { if shown.isEmpty { ContentUnavailableView.search(text: query) } }
            .searchable(text: $query, prompt: "Search servers")
            .task { if servers.value.isEmpty { try? await app.servers.load() } }
            .navigationTitle("Assistant Can Use")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct MessageView: View {
    let message: ChatMessage
    let chat: AIChatSession
    let pinned: Bool

    var body: some View {
        let m = message
        if m.role == ChatRole.user {
            Text(m.text).textSelection(.enabled)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(accentSoft, in: .rect(cornerRadius: 18, style: .continuous))
                .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(NX.border) }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.leading, 48)
        } else if m.role == ChatRole.assistant {
            StructuredText(markdown: m.text).textual.textSelection(.enabled)
        } else if m.role == ChatRole.system {
            Label(m.text, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(NX.error)
                .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                .background(NX.error.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        } else if m.role == ChatRole.note {
            Text(m.text).font(.caption).foregroundStyle(NX.subtext).frame(maxWidth: .infinity)
        } else {
            ToolCard(message: m, chat: chat, pinned: pinned)
        }
    }
}

private struct ToolCard: View {
    let message: ChatMessage
    let chat: AIChatSession
    let pinned: Bool
    @State private var expanded = false

    private var outputs: [String] { [message.stdout, message.stderr, message.fileContent].compactMap { $0 } }
    private var hasDetail: Bool { !outputs.isEmpty || !message.directoryEntries.isEmpty }

    var body: some View {
        let m = message
        VStack(alignment: .leading, spacing: 10) {
            Button { withAnimation(.snappy) { expanded.toggle() } } label: {
                HStack(spacing: 10) {
                    IconTile(symbol: sfSymbol(m.toolIconKey), color: statusColor, size: 28)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(m.toolLabel).font(.subheadline.weight(.semibold))
                        if !m.summary.isEmpty { Text(m.summary).mono(.caption).foregroundStyle(NX.subtext).lineLimit(expanded ? nil : 1) }
                    }
                    Spacer(minLength: 0)
                    status
                    if hasDetail { Image(systemName: "chevron.right").font(.caption2.weight(.bold)).foregroundStyle(NX.subtext).rotationEffect(.degrees(expanded ? 90 : 0)) }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .allowsHitTesting(hasDetail || m.summary.count >= 40)
            if m.isQuestion { QuestionBody(message: m, chat: chat) }
            if expanded {
                ForEach(outputs, id: \.self) { output in
                    ScrollView([.horizontal, .vertical]) { Text(output).mono(.caption2).textSelection(.enabled).padding(10) }
                        .frame(maxWidth: .infinity, maxHeight: 220, alignment: .topLeading)
                        .background(NX.terminal, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .foregroundStyle(Color(hex: 0xF2F4F8))
                }
                if !m.directoryEntries.isEmpty {
                    Text(m.directoryEntries.map(\.displayName).joined(separator: "\n")).mono(.caption2)
                }
            }
            ForEach(Array(m.images.enumerated()), id: \.offset) { _, img in
                if let data = Data(base64Encoded: img.data, options: .ignoreUnknownCharacters), let image = UIImage(data: data) {
                    Image(uiImage: image).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
            if let note = m.note {
                Text(note).font(.caption).foregroundStyle(m.status == ToolStatus.error ? NX.error : NX.subtext)
            }
            if m.isAwaitingConfirmation && !pinned, let callId = m.callId {
                HStack {
                    Button("Deny", role: .cancel) { chat.confirm(callId: callId, allow: false) }.buttonStyle(.bordered)
                    Button("Allow") { chat.confirm(callId: callId, allow: true) }.buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(radius: 16)
    }

    private var statusColor: Color {
        let m = message
        if m.status == ToolStatus.error || m.isFailed { return NX.error }
        if m.status == ToolStatus.denied || m.status == ToolStatus.aborted { return NX.subtext }
        if m.isAwaitingConfirmation || m.isAwaitingAnswer { return NX.warning }
        return accent
    }

    @ViewBuilder private var status: some View {
        let m = message
        if let code = m.exitCode?.int32Value {
            Text("exit \(code)").mono(.caption2).fontWeight(.bold).foregroundStyle(m.isFailed ? NX.error : NX.success)
        } else if m.status == ToolStatus.running {
            ProgressView().controlSize(.small)
        } else if m.isAwaitingConfirmation {
            Text("Waiting").font(.caption2.weight(.semibold)).foregroundStyle(NX.warning)
        } else if m.status == ToolStatus.done && !m.isQuestion {
            Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(NX.success)
        }
    }
}

private struct QuestionBody: View {
    let message: ChatMessage
    let chat: AIChatSession
    @State private var text = ""
    @State private var selected: [String] = []

    var body: some View {
        let m = message
        VStack(alignment: .leading, spacing: 8) {
            if let q = m.question { StructuredText(markdown: q).textual.textSelection(.enabled) }
            if m.isAwaitingAnswer, let callId = m.callId {
                ForEach(m.questionOptions, id: \.label) { o in
                    let isSelected = selected.contains(o.label)
                    Button {
                        if !m.isMultiSelect { chat.answer(callId: callId, text: o.label) }
                        else if isSelected { selected.removeAll { $0 == o.label } }
                        else { selected.append(o.label) }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Label(o.label, systemImage: isSelected ? "checkmark.circle.fill" : (m.isMultiSelect ? "circle" : "arrow.right.circle"))
                            if let d = o.description_ { Text(d).font(.caption).foregroundStyle(.secondary) }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.bordered)
                }
                if m.allowsFreeText || m.isMultiSelect {
                    HStack {
                        if m.allowsFreeText {
                            TextField(m.questionOptions.isEmpty ? "Type your answer…" : "Something else…", text: $text, axis: .vertical)
                                .lineLimit(1...4)
                                .textFieldStyle(.roundedBorder)
                                .onSubmit { submit(callId) }
                        } else {
                            Spacer()
                        }
                        Button("Send", systemImage: "arrow.up.circle.fill") { submit(callId) }
                            .labelStyle(.iconOnly)
                            .font(.title2)
                            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !(m.isMultiSelect && !selected.isEmpty))
                    }
                }
            }
            if let a = m.answer { Text(a).font(.callout.weight(.medium)).foregroundStyle(.tint) }
        }
    }

    private func submit(_ callId: String) {
        let typed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if message.isMultiSelect { chat.answer(callId: callId, choices: typed.isEmpty ? selected : selected + [typed]) }
        else if !typed.isEmpty { chat.answer(callId: callId, text: typed) }
    }
}

@Observable final class SpeechInput {
    private(set) var listening = false
    @ObservationIgnored private let recognizer = SFSpeechRecognizer()
    @ObservationIgnored private let engine = AVAudioEngine()
    @ObservationIgnored private var request: SFSpeechAudioBufferRecognitionRequest?
    @ObservationIgnored private var task: SFSpeechRecognitionTask?

    func toggle(onText: @escaping (String) -> Void) {
        if listening { return stop() }
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { return }
            AVAudioApplication.requestRecordPermission { granted in
                DispatchQueue.main.async { if granted { self.start(onText) } }
            }
        }
    }

    private func start(_ onText: @escaping (String) -> Void) {
        guard let recognizer, recognizer.isAvailable, !listening else { return }
        listening = true
        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audio.setActive(true, options: .notifyOthersOnDeactivation)
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            let node = engine.inputNode
            node.installTap(onBus: 0, bufferSize: 1024, format: node.outputFormat(forBus: 0)) { buffer, _ in request.append(buffer) }
            engine.prepare()
            try engine.start()
            self.request = request
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.listening else { return }
                    if let result { onText(result.bestTranscription.formattedString) }
                    if error != nil || result?.isFinal == true { self.stop() }
                }
            }
        } catch {
            stop()
        }
    }

    func stop() {
        guard listening else { return }
        listening = false
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.finish()
        request = nil
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
