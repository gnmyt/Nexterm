import SwiftUI
import Speech
import AVFoundation
import Textual
import NextermKit

struct AIAssistantSheet: View {
    let session: AppSession

    var body: some View {
        Scoped(make: { nx.doNewAIChat(session: session) }, close: { $0.close() }) { AIChatView(chat: $0) }
    }
}

private struct AIChatView: View {
    let chat: AIChatSession
    @State private var state: FlowState<AIChatState>
    @State private var input = ""
    @State private var speech = SpeechInput()
    @Environment(\.dismiss) private var dismiss

    init(chat: AIChatSession) {
        self.chat = chat
        _state = State(initialValue: FlowState(chat.state) { $0 as! AIChatState })
    }

    var body: some View {
        let s = state.value
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if let e = s.connectionError { Label(e, systemImage: "wifi.exclamationmark").foregroundStyle(.red) }
                    ForEach(s.messages, id: \.id) { MessageView(message: $0, chat: chat) }
                    if s.isRunning { HStack(spacing: 8) { ProgressView(); Text("Thinking…") }.foregroundStyle(.secondary) }
                }
                .padding()
            }
            .defaultScrollAnchor(.bottom)
            .overlay {
                if s.isEmpty {
                    ContentUnavailableView("Ask the Assistant", systemImage: "sparkles", description: Text(
                        "It can run commands and read or edit files on \(chat.serverName ?? "this server") directly over the connection."))
                }
            }
            .safeAreaInset(edge: .bottom) { composer(s) }
            .navigationTitle("AI Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDragIndicator(.visible)
        .onDisappear { speech.stop() }
    }

    private func composer(_ s: AIChatState) -> some View {
        HStack(alignment: .bottom, spacing: 4) {
            TextField(speech.listening ? "Listening…" : s.inputHint, text: $input, axis: .vertical)
                .lineLimit(1...5)
                .padding(.vertical, 8)
            Group {
                if s.isRunning {
                    Button("Stop", systemImage: "stop.circle.fill") { chat.stop() }.foregroundStyle(.red)
                } else if input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button(speech.listening ? "Stop Dictation" : "Dictate", systemImage: speech.listening ? "mic.fill" : "mic") {
                        speech.toggle { input = $0 }
                    }
                    .foregroundStyle(speech.listening ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
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
            .frame(minWidth: 36, minHeight: 36)
        }
        .padding(.leading, 14)
        .padding(.trailing, 2)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 20))
        .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(.separator) }
        .disabled(!s.isReady)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }
}

private struct MessageView: View {
    let message: ChatMessage
    let chat: AIChatSession

    var body: some View {
        let m = message
        if m.role == ChatRole.user {
            Text(m.text).textSelection(.enabled)
                .padding(12)
                .background(.tint.opacity(0.15), in: .rect(cornerRadius: 16))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.leading, 40)
        } else if m.role == ChatRole.assistant {
            StructuredText(markdown: m.text).textual.textSelection(.enabled)
        } else if m.role == ChatRole.system {
            Label(m.text, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
        } else {
            ToolCard(message: m, chat: chat)
        }
    }
}

private struct ToolCard: View {
    let message: ChatMessage
    let chat: AIChatSession

    var body: some View {
        let m = message
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                if m.isQuestion { QuestionBody(message: m, chat: chat) }
                if !m.summary.isEmpty { Text(m.summary).font(.caption.monospaced()).foregroundStyle(.secondary).textSelection(.enabled) }
                ForEach([m.stdout, m.stderr, m.fileContent].compactMap { $0 }, id: \.self) { output in
                    ScrollView(.horizontal) { Text(output).font(.caption2.monospaced()).textSelection(.enabled) }
                        .frame(maxHeight: 200)
                }
                if !m.directoryEntries.isEmpty {
                    Text(m.directoryEntries.map(\.displayName).joined(separator: "\n")).font(.caption2.monospaced())
                }
                ForEach(Array(m.images.enumerated()), id: \.offset) { _, img in
                    if let data = Data(base64Encoded: img.data, options: .ignoreUnknownCharacters), let image = UIImage(data: data) {
                        Image(uiImage: image).resizable().scaledToFit()
                    }
                }
                if let note = m.note {
                    Text(note).font(.caption).foregroundStyle(m.status == ToolStatus.error ? .red : .secondary)
                }
                if m.isAwaitingConfirmation, let callId = m.callId {
                    Text("Allow this action?").font(.footnote)
                    HStack {
                        Button("Deny", role: .cancel) { chat.confirm(callId: callId, allow: false) }.buttonStyle(.bordered)
                        Button("Allow") { chat.confirm(callId: callId, allow: true) }.buttonStyle(.borderedProminent)
                    }
                    .controlSize(.regular)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
            HStack {
                Label(m.toolLabel, systemImage: sfSymbol(m.toolIconKey))
                Spacer()
                if let code = m.exitCode?.int32Value {
                    Text("exit \(code)").font(.caption.bold()).foregroundStyle(m.isFailed ? .red : .green)
                } else if m.status == ToolStatus.running {
                    ProgressView().controlSize(.small)
                }
            }
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
            if let a = m.answer { Text(a).font(.callout).foregroundStyle(.tint) }
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
                    if let result { onText(result.bestTranscription.formattedString) }
                    if error != nil || result?.isFinal == true { self?.stop() }
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
