import SwiftUI
import NextermKit

struct ScriptSessionView: View {
    let session: AppSession
    let terminal: TerminalConnection
    let run: ScriptRun
    @State private var state: FlowState<ScriptState>
    @State private var expanded = false
    @State private var value = ""

    init(session: AppSession, terminal: TerminalConnection, run: ScriptRun) {
        self.session = session
        self.terminal = terminal
        self.run = run
        _state = State(initialValue: FlowState(run.state) { $0 as! ScriptState })
    }

    private var input: ScriptDialog.Input? { state.value.dialog as? ScriptDialog.Input }
    private var notice: ScriptDialog.Notice? { state.value.dialog as? ScriptDialog.Notice }

    private var inputShown: Binding<Bool> {
        presented { ($0 as? ScriptDialog.Input).map { $0.kind != .select } ?? false }
    }

    private var selectShown: Binding<Bool> {
        presented { ($0 as? ScriptDialog.Input)?.kind == .select }
    }

    private var noticeShown: Binding<Bool> {
        presented { $0 is ScriptDialog.Notice }
    }

    private var resultShown: Binding<Bool> {
        presented(dismiss: true) { $0 is ScriptDialog.Summary || $0 is ScriptDialog.Table }
    }

    var body: some View {
        terminalView
            .alert("Input Required", isPresented: inputShown, presenting: input) { prompt in
                inputActions(prompt)
            } message: { prompt in
                Text(prompt.prompt)
            }
            .confirmationDialog(input?.prompt ?? "", isPresented: selectShown, titleVisibility: .visible, presenting: input) { prompt in
                selectActions(prompt)
            }
            .alert(notice?.title ?? "", isPresented: noticeShown) {
                Button("OK") { run.dismiss() }
            } message: {
                Text(notice?.message ?? "")
            }
            .sheet(isPresented: resultShown) {
                ScriptResultSheet(dialog: state.value.dialog) { run.dismiss() }
            }
    }

    private var terminalView: some View {
        let script = state.value
        return TerminalSessionView(session: session, terminal: terminal)
            .safeAreaInset(edge: .top, spacing: 0) { header(script) }
            .onChange(of: script.notice) { _, notice in if let notice { app.show(notice) } }
            .onChange(of: input) { _, prompt in resetValue(for: prompt) }
    }

    private func resetValue(for prompt: ScriptDialog.Input?) {
        if let prompt, prompt.kind == .text {
            value = prompt.placeholder
        } else {
            value = ""
        }
    }

    @ViewBuilder
    private func inputActions(_ prompt: ScriptDialog.Input) -> some View {
        switch prompt.kind {
        case .confirm:
            Button("Yes") { run.submit(value: "Yes") }
            Button("No") { run.submit(value: "No") }
        case .password:
            SecureField("Password", text: $value)
            Button("Submit") { run.submit(value: value) }.disabled(value.isEmpty)
        default:
            TextField("Value", text: $value)
            Button("Submit") { run.submit(value: value) }.disabled(value.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        Button("Cancel", role: .cancel) { run.cancel() }
    }

    @ViewBuilder
    private func selectActions(_ prompt: ScriptDialog.Input) -> some View {
        ForEach(prompt.options, id: \.self) { option in Button(option) { run.submit(value: option) } }
        Button("Cancel", role: .cancel) { run.cancel() }
    }

    private func presented(dismiss: Bool = false, _ matches: @escaping (ScriptDialog?) -> Bool) -> Binding<Bool> {
        Binding(get: { matches(state.value.dialog) }, set: { shown in if !shown && dismiss && matches(state.value.dialog) { run.dismiss() } })
    }

    private func header(_ script: ScriptState) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            DisclosureGroup(isExpanded: $expanded) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(script.steps, id: \.index) { step in
                            Label(step.title.isEmpty ? "Step \(step.index + 1)" : step.title, systemImage: symbol(step.status))
                                .foregroundStyle(color(step.status))
                                .font(.subheadline)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
                }
                .frame(maxHeight: 200)
            } label: {
                HStack(spacing: 12) {
                    if script.isFailed {
                        Image(systemName: "xmark.octagon.fill").foregroundStyle(NX.error)
                    } else if script.isCompleted {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(accent)
                    } else {
                        ProgressView()
                    }
                    VStack(alignment: .leading) {
                        Text(script.name).font(.headline)
                        Text("\(script.summary) · \(script.currentTitle)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            if script.isRunning {
                if script.fraction >= 0 { ProgressView(value: script.fraction) } else { ProgressView().progressViewStyle(.linear) }
            }
        }
        .background(NX.surface)
        .hairline(.bottom)
    }

    private func symbol(_ status: ScriptStepStatus) -> String {
        switch status {
        case .done: "checkmark.circle.fill"
        case .running: "play.circle.fill"
        case .failed: "xmark.circle.fill"
        case .skipped: "minus.circle"
        default: "circle"
        }
    }

    private func color(_ status: ScriptStepStatus) -> Color {
        switch status {
        case .done: accent
        case .running: NX.warning
        case .failed: NX.error
        default: .secondary
        }
    }
}

private struct ScriptResultSheet: View {
    let dialog: ScriptDialog?
    let close: () -> Void

    var body: some View {
        NavigationStack {
            List {
                if let summary = dialog as? ScriptDialog.Summary {
                    ForEach(summary.items, id: \.self) { item in LabeledContent(item.label, value: item.value) }
                } else if let table = dialog as? ScriptDialog.Table {
                    if table.rows.isEmpty { ContentUnavailableView("No Rows", systemImage: "tablecells") }
                    ForEach(table.rows, id: \.index) { row in
                        Section {
                            ForEach(row.cells, id: \.self) { cell in LabeledContent(cell.label, value: cell.value) }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = copyText }
                }
                ToolbarItem(placement: .confirmationAction) { Button("Done", action: close) }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var title: String { (dialog as? ScriptDialog.Summary)?.title ?? (dialog as? ScriptDialog.Table)?.title ?? "" }

    private var copyText: String {
        if let summary = dialog as? ScriptDialog.Summary { return summary.items.map { "\($0.label): \($0.value)" }.joined(separator: "\n") }
        if let table = dialog as? ScriptDialog.Table { return table.rows.map { $0.cells.map(\.value).joined(separator: ", ") }.joined(separator: "\n") }
        return ""
    }
}
