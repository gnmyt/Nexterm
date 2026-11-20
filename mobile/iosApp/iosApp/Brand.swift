import SwiftUI
import UIKit
import NextermKit

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: alpha)
    }

    init(light: Color, dark: Color) {
        self.init(UIColor { $0.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }

    func mixed(with other: Color, by amount: Double) -> Color {
        var (r1, g1, b1, a1) = (CGFloat(0), CGFloat(0), CGFloat(0), CGFloat(0))
        var (r2, g2, b2, a2) = (CGFloat(0), CGFloat(0), CGFloat(0), CGFloat(0))
        UIColor(self).getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        UIColor(other).getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let t = CGFloat(amount)
        return Color(.sRGB, red: Double(r1 + (r2 - r1) * t), green: Double(g1 + (g2 - g1) * t), blue: Double(b1 + (b2 - b1) * t), opacity: Double(a1))
    }
}

enum NX {
    static let background = Color(light: Color(hex: 0xF6F7F9), dark: Color(hex: 0x0A0D12))
    static let surface = Color(light: .white, dark: Color(hex: 0x10151C))
    static let surfaceHigh = Color(light: Color(hex: 0xE6E8EC), dark: Color(hex: 0x1B222C))
    static let fill = Color(light: Color(hex: 0x101620, alpha: 0.05), dark: Color(hex: 0xFFFFFF, alpha: 0.06))
    static let border = Color(light: Color(hex: 0x101620, alpha: 0.10), dark: Color(hex: 0xFFFFFF, alpha: 0.08))
    static let subtext = Color(light: Color(hex: 0x5B6472), dark: Color(hex: 0x9AA4B5))
    static let success = Color(light: Color(hex: 0x29C16A), dark: Color(hex: 0x30C77A))
    static let warning = Color(light: Color(hex: 0xDC5600), dark: Color(hex: 0xF0962A))
    static let error = Color(light: Color(hex: 0xD85959), dark: Color(hex: 0xE5484D))
    static let amber = Color(hex: 0xEAB308)
    static let proxmox = Color(hex: 0xDC5600)
    static let terminal = Color(hex: 0x13181C)
}

var accentFill: Color { Color(argb: app.accent.value) }

var accent: Color {
    let base = accentFill
    return Color(light: base, dark: base.mixed(with: .white, by: 0.18))
}

var accentSoft: Color { Color(light: accentFill.opacity(0.14), dark: accentFill.opacity(0.28)) }

struct NextermMark: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 323.148, y: 401.419))
        p.addCurve(to: CGPoint(x: 286.72, y: 364.992), control1: CGPoint(x: 303.03, y: 401.419), control2: CGPoint(x: 286.72, y: 385.11))
        p.addCurve(to: CGPoint(x: 323.148, y: 328.565), control1: CGPoint(x: 286.72, y: 344.874), control2: CGPoint(x: 303.03, y: 328.565))
        p.addLine(to: CGPoint(x: 444.573, y: 328.565))
        p.addCurve(to: CGPoint(x: 481, y: 364.992), control1: CGPoint(x: 464.691, y: 328.565), control2: CGPoint(x: 481, y: 344.874))
        p.addCurve(to: CGPoint(x: 444.573, y: 401.419), control1: CGPoint(x: 481, y: 385.11), control2: CGPoint(x: 464.691, y: 401.419))
        p.closeSubpath()
        p.move(to: CGPoint(x: 141.286, y: 291.862))
        p.addCurve(to: CGPoint(x: 141.196, y: 219.648), control1: CGPoint(x: 161.238, y: 271.91), control2: CGPoint(x: 161.197, y: 239.55))
        p.addLine(to: CGPoint(x: 93.3467, y: 172.037))
        p.addCurve(to: CGPoint(x: 118.953, y: 110), control1: CGPoint(x: 70.3893, y: 149.193), control2: CGPoint(x: 86.5666, y: 110))
        p.addCurve(to: CGPoint(x: 144.597, y: 120.607), control1: CGPoint(x: 128.568, y: 110), control2: CGPoint(x: 137.791, y: 113.815))
        p.addLine(to: CGPoint(x: 254.421, y: 230.211))
        p.addCurve(to: CGPoint(x: 254.421, y: 281.695), control1: CGPoint(x: 268.507, y: 244.539), control2: CGPoint(x: 268.507, y: 267.852))
        p.addLine(to: CGPoint(x: 145.359, y: 390.757))
        p.addCurve(to: CGPoint(x: 119.617, y: 401.419), control1: CGPoint(x: 138.532, y: 397.584), control2: CGPoint(x: 129.272, y: 401.419))
        p.addCurve(to: CGPoint(x: 93.8753, y: 339.273), control1: CGPoint(x: 87.1842, y: 401.419), control2: CGPoint(x: 70.9416, y: 362.206))
        p.closeSubpath()
        let box = CGRect(x: 75, y: 110, width: 406, height: 291.419)
        let scale = min(rect.width / box.width, rect.height / box.height)
        return p.applying(CGAffineTransform(translationX: -box.midX, y: -box.midY))
            .applying(CGAffineTransform(scaleX: scale, y: scale))
            .applying(CGAffineTransform(translationX: rect.midX, y: rect.midY))
    }
}

struct NextermLogo: View {
    var size: CGFloat = 72

    var body: some View {
        NextermMark()
            .fill(accentFill)
            .frame(width: size, height: size * 0.72)
            .accessibilityHidden(true)
    }
}

struct ServerTile: View {
    let symbol: String
    var color: Color = accentFill
    var offline = false
    var size: CGFloat = 32

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(offline ? AnyShapeStyle(NX.subtext) : AnyShapeStyle(.white))
            .frame(width: size, height: size)
            .background(offline ? AnyShapeStyle(NX.fill) : AnyShapeStyle(color.gradient), in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}

extension ServerTile {
    init(server: Server) {
        self.init(symbol: sfSymbol(IconKeys.shared.server(server: server)), color: server.isPve ? NX.proxmox : accentFill, offline: server.isStopped)
    }
}

func tagColor(_ tag: NextermKit.Tag) -> Color { tag.colorArgb.map { Color(argb: $0.int64Value) } ?? NX.subtext }

struct TagDots: View {
    let tags: [NextermKit.Tag]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(tags.prefix(3), id: \.id) { tag in
                Circle().fill(tagColor(tag)).frame(width: 8, height: 8)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(tags.map(\.name).joined(separator: ", "))
    }
}

struct Chip: View {
    let label: String
    var symbol: String?
    var dot: Color?
    var selected = false
    var onRemove: (() -> Void)?
    let action: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Button(action: action) {
                HStack(spacing: 6) {
                    if let dot { Circle().fill(dot).frame(width: 8, height: 8) }
                    if let symbol { Image(systemName: symbol).font(.caption.weight(.semibold)) }
                    Text(label).font(.subheadline.weight(.medium)).lineLimit(1)
                }
            }
            if let onRemove {
                Button("Remove \(label)", systemImage: "xmark", action: onRemove)
                    .labelStyle(.iconOnly).font(.caption2.weight(.bold)).foregroundStyle(NX.subtext)
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(selected ? accent : .primary)
        .padding(.horizontal, 12)
        .frame(height: 34)
        .background(selected ? accentSoft : NX.fill, in: Capsule())
        .overlay { Capsule().strokeBorder(selected ? accent.opacity(0.6) : NX.border) }
    }
}

struct LinkGlyph: View {
    let symbol: String
    let color: Color
    let size: CGFloat

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "laptopcomputer").font(.system(size: 40)).foregroundStyle(NX.subtext)
            Capsule().fill(NX.border).frame(width: 28, height: 2).padding(.leading, 8)
            Image(systemName: symbol).font(.system(size: size)).foregroundStyle(color)
            Capsule().fill(NX.border).frame(width: 28, height: 2).padding(.trailing, 8)
            Image(systemName: "server.rack").font(.system(size: 40)).foregroundStyle(NX.subtext)
        }
        .accessibilityHidden(true)
    }
}

struct KeyCapStyle: ButtonStyle {
    var active = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold, design: .monospaced))
            .foregroundStyle(active ? .white : .primary)
            .padding(.horizontal, 10)
            .frame(minWidth: 40, minHeight: 38)
            .background(active ? AnyShapeStyle(accentFill) : AnyShapeStyle(NX.fill), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(NX.border) }
            .opacity(configuration.isPressed ? 0.55 : 1)
            .contentShape(Rectangle())
    }
}

struct SoftButtonStyle: ButtonStyle {
    var color: Color?
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(color ?? .primary)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background((color ?? accentFill).opacity(color == nil ? 0.3 : 0.16), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(NX.border) }
            .opacity(enabled ? (configuration.isPressed ? 0.7 : 1) : 0.45)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension View {
    func card(radius: CGFloat = 16, fill: Color = NX.surface) -> some View {
        background(fill, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(NX.border) }
    }

    func brandedList() -> some View {
        scrollContentBackground(.hidden).background(NX.background.ignoresSafeArea())
    }

    func brandedRows() -> some View { listRowBackground(NX.surface) }

    func hairline(_ edge: Alignment) -> some View { overlay(alignment: edge) { Rectangle().fill(NX.border).frame(height: 1) } }

    func mono(_ style: Font.TextStyle = .footnote) -> some View { font(.system(style, design: .monospaced)) }
}

struct Toast: Equatable {
    let id = UUID()
    let text: String
    var isError = false
}

struct ToastHost: ViewModifier {
    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let toast = app.toast {
                Label(toast.text, systemImage: toast.isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                    .font(.subheadline.weight(.medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(toast.isError ? NX.error : .primary)
                    .lineLimit(3)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .card(radius: 18, fill: NX.surfaceHigh)
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture { app.toast = nil }
                    .task(id: toast.id) {
                        try? await Task.sleep(for: .seconds(toast.isError ? 5 : 3))
                        if app.toast?.id == toast.id { app.toast = nil }
                    }
                    .accessibilityAddTraits(.isStaticText)
            }
        }
        .animation(.snappy, value: app.toast)
    }
}

extension View {
    func toastHost() -> some View { modifier(ToastHost()) }
}
