import SwiftUI
import VisionKit

struct QRScannerSheet: View {
    let title: String
    let hint: String
    let onDetect: (String) -> Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    QRScanner { code in
                        guard onDetect(code) else { return false }
                        dismiss()
                        return true
                    }
                    .ignoresSafeArea()
                } else {
                    ContentUnavailableView("Camera Unavailable", systemImage: "camera",
                                           description: Text("Allow camera access in Settings to scan QR codes."))
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .status) { Text(hint).font(.footnote).multilineTextAlignment(.center) }
            }
        }
    }
}

private struct QRScanner: UIViewControllerRepresentable {
    let onCode: (String) -> Bool

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])], isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        DispatchQueue.main.async { try? vc.startScanning() }
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onCode: (String) -> Bool
        private var done = false
        init(onCode: @escaping (String) -> Bool) { self.onCode = onCode }

        func dataScanner(_ scanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            for case .barcode(let code) in addedItems where !done {
                if let value = code.payloadStringValue, onCode(value) {
                    done = true
                    scanner.stopScanning()
                }
            }
        }
    }
}
