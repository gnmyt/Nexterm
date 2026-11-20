import SwiftUI
import NextermKit

struct TrustPrompt: View {
    let sessionId: String
    let challenge: TrustChallenge
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        let tone = challenge.isChanged ? NX.error : accent
        ZStack(alignment: .topLeading) {
            NX.background.ignoresSafeArea()
            GeometryReader { geo in Rectangle().fill(accentFill).frame(width: geo.size.width * 0.45, height: 2) }
            ScrollView {
                VStack(spacing: 20) {
                    LinkGlyph(symbol: challenge.isChanged ? "exclamationmark.shield.fill" : "lock.shield", color: tone, size: 28)
                    VStack(spacing: 8) {
                        Text(challenge.title).font(.title2.weight(.semibold))
                        Text(challenge.message).font(.subheadline).foregroundStyle(NX.subtext)
                    }
                    .multilineTextAlignment(.center)
                    VStack(alignment: .leading, spacing: 14) {
                        if let previous = challenge.previousFingerprint {
                            value(challenge.previousLabel) { Text(previous).mono(.footnote).foregroundStyle(NX.subtext).strikethrough() }
                        }
                        value(challenge.fingerprintLabel) {
                            Text(challenge.fingerprint).mono(.footnote).foregroundStyle(challenge.isChanged ? NX.error : .primary).textSelection(.enabled)
                        }
                        if !challenge.facts.isEmpty {
                            Divider().overlay(NX.border)
                            ForEach(challenge.facts, id: \.label) { fact in value(fact.label) { Text(fact.value).font(.subheadline) } }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)
                    .card(radius: 12)
                    if let hint = failure ?? challenge.blockedHint {
                        Text(hint).font(.footnote).foregroundStyle(failure != nil ? NX.error : NX.subtext).multilineTextAlignment(.center)
                    }
                    HStack(spacing: 12) {
                        if challenge.isChanged {
                            if challenge.canTrust {
                                Button(challenge.acceptLabel, systemImage: "shield.slash") { answer(true) }.buttonStyle(.bordered)
                            }
                            Button(challenge.cancelLabel, systemImage: "xmark") { answer(false) }.buttonStyle(.bordered).tint(NX.error)
                        } else {
                            Button(challenge.cancelLabel, systemImage: "xmark") { answer(false) }.buttonStyle(.bordered)
                            Button(challenge.acceptLabel, systemImage: "checkmark") { answer(true) }.buttonStyle(.borderedProminent)
                        }
                    }
                    .controlSize(.large)
                    .disabled(busy)
                }
                .padding(24)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
                .containerRelativeFrame(.vertical, alignment: .center) { length, _ in length }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private func value(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(NX.subtext)
            content()
        }
    }

    private func answer(_ accept: Bool) {
        guard !busy else { return }
        busy = true
        failure = nil
        Task {
            do {
                try await nx.sessions.answerTrust(sessionId: sessionId, challenge: challenge, accept: accept)
            } catch {
                failure = error.localizedDescription
                busy = false
            }
        }
    }
}
