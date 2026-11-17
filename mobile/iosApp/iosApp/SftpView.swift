import SwiftUI
import QuickLook
import NextermKit

private enum SftpPrompt { case newFolder, rename(SftpEntry) }

struct SftpView: View {
    let session: AppSession
    let browser: SftpBrowser
    @State private var entries: FlowState<[SftpEntry]>
    @State private var crumbs: FlowState<[Breadcrumb]>
    @State private var canBack: FlowState<Bool>
    @State private var canUp: FlowState<Bool>
    @State private var loading: FlowState<Bool>
    @State private var connected: FlowState<Bool>
    @State private var state: FlowState<ConnectionState>
    @State private var error: FlowState<String?>
    @State private var selected: FlowState<Set<String>>
    @State private var transfer: FlowState<TransferProgress?>
    @State private var editMode = EditMode.inactive
    @State private var prompt: SftpPrompt?
    @State private var name = ""
    @State private var deleting: [SftpEntry]?
    @State private var importing = false
    @State private var preview: URL?
    @State private var previewItems: [URL] = []

    init(session: AppSession, browser: SftpBrowser) {
        self.session = session
        self.browser = browser
        _entries = State(initialValue: FlowState(browser.entries, or: []))
        _crumbs = State(initialValue: FlowState(browser.breadcrumbs, or: []))
        _canBack = State(initialValue: FlowState(browser.canGoBack, or: false))
        _canUp = State(initialValue: FlowState(browser.canGoUp, or: false))
        _loading = State(initialValue: FlowState(browser.isLoading, or: false))
        _connected = State(initialValue: FlowState(browser.isConnected, or: false))
        _state = State(initialValue: FlowState(browser.connectionState, or: ConnectionState.connecting))
        _error = State(initialValue: FlowState(browser.error, or: nil))
        _selected = State(initialValue: FlowState(browser.selected, or: []))
        _transfer = State(initialValue: FlowState(browser.transfer, or: nil))
    }

    private var selection: Binding<Set<String>> {
        Binding(get: { selected.value }, set: { new in
            selected.value.symmetricDifference(new).forEach { browser.toggleSelection(name: $0) }
        })
    }

    var body: some View {
        List(entries.value, id: \.name, selection: editMode.isEditing ? selection : .constant([])) { row($0) }
            .environment(\.editMode, $editMode)
            .refreshable { browser.refresh() }
            .overlay {
                if !connected.value || state.value == ConnectionState.disconnected {
                    SessionStateOverlay(state: state.value, ready: false) { nx.sessions.reconnect(sessionId: session.sessionId) }
                } else if loading.value && entries.value.isEmpty {
                    ProgressView()
                } else if entries.value.isEmpty && !loading.value {
                    ContentUnavailableView("Empty Directory", systemImage: "folder")
                }
            }
            .onChange(of: selected.value.isEmpty) { _, empty in editMode = empty ? .inactive : .active }
            .onChange(of: editMode) { _, mode in if !mode.isEditing { browser.clearSelection() } }
            .toolbar {
                if editMode.isEditing { selectionBar } else { browseBar }
            }
            .errorAlert(error.value) { browser.clearError() }
            .alert(promptTitle, isPresented: isSet($prompt), presenting: prompt) { p in
                TextField(promptField, text: $name).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button("Cancel", role: .cancel) {}
                Button(promptTitle == "Rename" ? "Rename" : "Create") {
                    switch p {
                    case .newFolder: browser.createFolder(name: name)
                    case .rename(let e): browser.rename(entry: e, newName: name)
                    }
                }
            }
            .confirmationDialog(deleting.map { browser.deleteConfirmationMessage(entries: $0) } ?? "", isPresented: isSet($deleting),
                                titleVisibility: .visible, presenting: deleting) { list in
                Button("Delete", role: .destructive) { browser.delete(entries: list) }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.item], allowsMultipleSelection: true) { result in
                if case .success(let urls) = result { upload(urls) }
            }
            .quickLookPreview($preview, in: previewItems)
    }

    private var browseBar: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            Button("Back", systemImage: "chevron.backward") { browser.goBack() }.disabled(!canBack.value)
            Button("Up", systemImage: "arrow.up") { browser.goUp() }.disabled(!canUp.value)
            Spacer()
            if let t = transfer.value {
                ProgressView(value: t.fraction >= 0 ? t.fraction : nil) { Text(t.fileName).font(.caption) }.frame(maxWidth: 160)
            } else {
                Menu(crumbs.value.last?.label ?? "/") {
                    ForEach(crumbs.value.reversed(), id: \.path) { c in
                        Button(c.path, systemImage: c.isCurrent ? "folder.fill" : "folder") { browser.navigateTo(path: c.path) }
                    }
                }
                .font(.subheadline.weight(.semibold))
            }
            Spacer()
            Button("Select", systemImage: "checkmark.circle") { editMode = .active }
            Menu("Add", systemImage: "plus") {
                Button("New Folder", systemImage: "folder.badge.plus") { ask(.newFolder, "") }
                Button("Upload File", systemImage: "arrow.up.doc") { importing = true }
            }
            .disabled(!connected.value)
        }
    }

    private var selectionBar: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            Button("Done") { editMode = .inactive }
            Spacer()
            Text("\(selected.value.count) Selected").font(.subheadline.weight(.semibold)).fixedSize()
            Spacer()
            Button("Download", systemImage: "arrow.down.circle") { download(browser.selectedEntries()) }.disabled(selected.value.isEmpty)
            Button("Delete", systemImage: "trash", role: .destructive) { askDelete(browser.selectedEntries()) }.disabled(selected.value.isEmpty)
        }
    }

    private var promptTitle: String { if case .rename = prompt { "Rename" } else { "New Folder" } }
    private var promptField: String { if case .rename = prompt { "New name" } else { "Folder name" } }

    private func row(_ e: SftpEntry) -> some View {
        Button { if !editMode.isEditing && !browser.tap(entry: e) && !e.isDir { download([e]) } } label: {
            Row(title: e.name, subtitle: e.subtitle.isEmpty ? nil : e.subtitle, icon: sfSymbol(IconKeys.shared.file(entry: e)),
                color: roleColor(IconKeys.shared.fileColor(entry: e).name))
        }
        .tint(.primary)
        .contextMenu {
            if !e.isDir { Button("Download", systemImage: "arrow.down.circle") { download([e]) } }
            Button("Rename", systemImage: "pencil") { ask(.rename(e), e.name) }
            Button("Delete", systemImage: "trash", role: .destructive) { askDelete([e]) }
        }
        .swipeActions {
            Button("Delete", systemImage: "trash", role: .destructive) { askDelete([e]) }
            Button("Rename", systemImage: "pencil") { ask(.rename(e), e.name) }
        }
    }

    private func ask(_ p: SftpPrompt, _ initial: String) {
        name = initial
        prompt = p
    }

    private func askDelete(_ list: [SftpEntry]) {
        if browser.needsDeleteConfirmation() { deleting = list } else { browser.delete(entries: list) }
    }

    private func download(_ list: [SftpEntry]) {
        let files = list.filter { !$0.isDir }
        guard !files.isEmpty else { return app.show("No files selected for download") }
        let dir = FileManager.default.temporaryDirectory.appending(path: session.sessionId, directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        Task {
            var urls: [URL] = []
            for e in files {
                let url = dir.appending(path: e.name)
                do {
                    _ = try await browser.downloadToFile(entry: e, path: url.path(percentEncoded: false))
                    urls.append(url)
                } catch {
                    app.show("Download failed: \(error.localizedDescription)")
                }
            }
            editMode = .inactive
            previewItems = urls
            preview = urls.first
        }
    }

    private func upload(_ urls: [URL]) {
        let sources: [UploadSource] = urls.compactMap { url in
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let tmp = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
            guard (try? FileManager.default.copyItem(at: url, to: tmp)) != nil else { return nil }
            return SftpFilesKt.uploadSource(path: tmp.path(percentEncoded: false), name: url.lastPathComponent)
        }
        Task {
            if let result = try? await browser.upload(files: sources) { app.show(result.message) }
        }
    }
}
