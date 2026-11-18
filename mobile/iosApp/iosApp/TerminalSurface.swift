import SwiftUI
import NextermKit

struct TerminalSurface: UIViewControllerRepresentable {
    let controller: TerminalController
    let onTap: () -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        TerminalViewControllerKt.TerminalViewController(controller: controller, onTap: onTap)
    }

    func updateUIViewController(_ vc: UIViewController, context: Context) {}
}
