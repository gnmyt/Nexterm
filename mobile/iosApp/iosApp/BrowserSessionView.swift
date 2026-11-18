import SwiftUI
import NextermKit

struct BrowserSessionView: View {
    let session: AppSession
    let browser: BrowserControl
    @State private var state: FlowState<BrowserState>
    @State private var address = ""
    @FocusState private var editing: Bool

    init(session: AppSession, browser: BrowserControl) {
        self.session = session
        self.browser = browser
        _state = State(initialValue: FlowState(browser.state, or: BrowserState(address: "", title: "", isLoading: false, canGoBack: false, canGoForward: false)))
    }

    var body: some View {
        let page = state.value
        GuacamoleSessionView(session: session)
            .safeAreaInset(edge: .top, spacing: 0) {
                VStack(spacing: 0) {
                    HStack(spacing: 4) {
                        Button("Back", systemImage: "chevron.backward") { browser.goBack() }
                            .disabled(!browser.canControl || !page.canGoBack)
                        Button("Forward", systemImage: "chevron.forward") { browser.goForward() }
                            .disabled(!browser.canControl || !page.canGoForward)
                        TextField("Search or enter address", text: $address)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.go)
                            .focused($editing)
                            .disabled(!browser.canControl)
                            .onSubmit { browser.navigate(address: address) }
                        Button(page.isLoading ? "Stop" : "Reload", systemImage: page.isLoading ? "xmark" : "arrow.clockwise") { browser.reloadOrStop() }
                            .disabled(!browser.canControl)
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.borderless)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    if page.isLoading { ProgressView().progressViewStyle(.linear) }
                }
                .background(.bar)
            }
            .onChange(of: page.address, initial: true) { _, uri in if !editing { address = uri } }
            .onChange(of: editing) { _, now in if !now { address = state.value.address } }
    }
}
