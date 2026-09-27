import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, UIDocumentInteractionControllerDelegate {
  private var activeDocControllers: [UIDocumentInteractionController] = []
  private var previewHosts: [(controller: UIDocumentInteractionController, presenter: UIViewController)] = []

  private func rememberPresenter(_ presenter: UIViewController, for controller: UIDocumentInteractionController) {
    previewHosts.removeAll { $0.controller === controller }
    previewHosts.append((controller: controller, presenter: presenter))
  }

  private func forgetPresenter(for controller: UIDocumentInteractionController) {
    previewHosts.removeAll { $0.controller === controller }
    activeDocControllers.removeAll { $0 === controller }
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "nexterm/edit") {
      let editChannel = FlutterMethodChannel(name: "nexterm/edit", binaryMessenger: registrar.messenger())
      editChannel.setMethodCallHandler { [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) in
        if call.method == "open" {
          guard let args = call.arguments as? [String: Any],
                let path = args["path"] as? String else {
            result(FlutterError(code: "BAD_ARGS", message: "Missing path", details: nil))
            return
          }
          DispatchQueue.main.async {
            result(self?.presentDocument(atPath: path) ?? false)
          }
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
    }
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "nexterm/fileprovider") {
      let providerChannel = FlutterMethodChannel(name: "nexterm/fileprovider", binaryMessenger: registrar.messenger())
      providerChannel.setMethodCallHandler { (call: FlutterMethodCall, result: @escaping FlutterResult) in
        if call.method == "setExposeEnabled" {
          let enabled = (call.arguments as? [String: Any])?["enabled"] as? Bool ?? false
          UserDefaults.standard.set(enabled, forKey: "nexterm_expose_to_files")
          if let shared = UserDefaults(suiteName: "group.dev.gnm.nexterm-mobile") {
            shared.set(enabled, forKey: "nexterm_expose_to_files")
          }
          result(true)
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
    }
  }

  private func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    for scene in scenes {
      for window in scene.windows where window.isKeyWindow {
        var current = window.rootViewController
        while let presented = current?.presentedViewController {
          current = presented
        }
        if current != nil {
          return current
        }
      }
    }
    for scene in scenes {
      for window in scene.windows {
        var current = window.rootViewController
        while let presented = current?.presentedViewController {
          current = presented
        }
        if current != nil {
          return current
        }
      }
    }
    return nil
  }

  private func presentDocument(atPath path: String) -> Bool {
    let fileURL = URL(fileURLWithPath: path)
    guard FileManager.default.fileExists(atPath: fileURL.path) else {
      return false
    }
    guard let presenter = topViewController() else {
      return false
    }
    let controller = UIDocumentInteractionController(url: fileURL)
    controller.delegate = self
    rememberPresenter(presenter, for: controller)
    activeDocControllers.append(controller)
    let presented = controller.presentPreview(animated: true)
    if !presented {
      let menuPresented = controller.presentOpenInMenu(from: presenter.view.bounds, in: presenter.view, animated: true)
      if !menuPresented {
        forgetPresenter(for: controller)
      }
      return menuPresented
    }
    return true
  }

  func documentInteractionControllerViewControllerForPreview(_ controller: UIDocumentInteractionController) -> UIViewController {
    if let host = previewHosts.first(where: { $0.controller === controller }) {
      return host.presenter
    }
    return topViewController() ?? UIViewController()
  }

  func documentInteractionControllerDidEndPreview(_ controller: UIDocumentInteractionController) {
    forgetPresenter(for: controller)
  }

  func documentInteractionControllerDidDismissOpenInMenu(_ controller: UIDocumentInteractionController) {
    forgetPresenter(for: controller)
  }

  func documentInteractionControllerDidDismissOptionsMenu(_ controller: UIDocumentInteractionController) {
    forgetPresenter(for: controller)
  }
}
