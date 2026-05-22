import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:xterm/xterm.dart';

enum ToolbarGroup {
  modifiers('Modifier Keys', 'CTRL, ALT'),
  signals('Signal Keys', '^C, ^Z, ^D'),
  arrows('Arrow Keys', '↑ ↓ ← →'),
  navigation('Navigation Keys', 'HOME, END, PGUP, PGDN'),
  functionKeys('Function Keys', 'F1–F12');

  final String label;
  final String description;
  const ToolbarGroup(this.label, this.description);
}

class TerminalColorTheme {
  final String id;
  final String name;
  final TerminalTheme theme;

  const TerminalColorTheme(this.id, this.name, this.theme);

  Color get background => theme.background;
  Color get foreground => theme.foreground;
}

class TerminalThemes {
  static TerminalColorTheme _t(String id, String name, {
    required Color bg, required Color fg, required Color cursor, required Color bw,
    required Color k, required Color r, required Color g, required Color y, required Color b, required Color m, required Color c, required Color w,
    required Color bk, required Color br, required Color bg2, required Color by, required Color bb, required Color bm, required Color bc,
  }) => TerminalColorTheme(id, name, TerminalTheme(
    background: bg, foreground: fg, cursor: cursor, selection: cursor.withValues(alpha: 0.3),
    black: k, red: r, green: g, yellow: y, blue: b, magenta: m, cyan: c, white: w,
    brightBlack: bk, brightRed: br, brightGreen: bg2, brightYellow: by, brightBlue: bb, brightMagenta: bm, brightCyan: bc, brightWhite: bw,
    searchHitBackground: y.withValues(alpha: 0.3), searchHitBackgroundCurrent: y.withValues(alpha: 0.5), searchHitForeground: bg,
  ));

  static final List<TerminalColorTheme> all = [
    _t('default', 'Default', bg: Color(0xFF13181C), fg: Color(0xFFF5F5F5), cursor: Color(0xFFF5F5F5), bw: Color(0xFFFFFFFF), k: Color(0xFF000000), r: Color(0xFFE25A5A), g: Color(0xFF7FBF7F), y: Color(0xFFFFBF7F), b: Color(0xFF7F7FBF), m: Color(0xFFBF7FBF), c: Color(0xFF7FBFBF), w: Color(0xFFBFBFBF), bk: Color(0xFF404040), br: Color(0xFFFF6B6B), bg2: Color(0xFF9ECEFF), by: Color(0xFFFFD93D), bb: Color(0xFF9D9DFF), bm: Color(0xFFFF9DFF), bc: Color(0xFF9DFFFF)),
    _t('dracula', 'Dracula', bg: Color(0xFF282A36), fg: Color(0xFFF8F8F2), cursor: Color(0xFFF8F8F2), bw: Color(0xFFFFFFFF), k: Color(0xFF21222C), r: Color(0xFFFF5555), g: Color(0xFF50FA7B), y: Color(0xFFF1FA8C), b: Color(0xFFBD93F9), m: Color(0xFFFF79C6), c: Color(0xFF8BE9FD), w: Color(0xFFF8F8F2), bk: Color(0xFF6272A4), br: Color(0xFFFF6E6E), bg2: Color(0xFF69FF94), by: Color(0xFFFFFFA5), bb: Color(0xFFD6ACFF), bm: Color(0xFFFF92DF), bc: Color(0xFFA4FFFF)),
    _t('monokai', 'Monokai', bg: Color(0xFF272822), fg: Color(0xFFF8F8F2), cursor: Color(0xFFF8F8F0), bw: Color(0xFFF8F8F2), k: Color(0xFF272822), r: Color(0xFFF92672), g: Color(0xFFA6E22E), y: Color(0xFFF4BF75), b: Color(0xFF66D9EF), m: Color(0xFFAE81FF), c: Color(0xFFA1EFE4), w: Color(0xFFF8F8F2), bk: Color(0xFF75715E), br: Color(0xFFF92672), bg2: Color(0xFFA6E22E), by: Color(0xFFF4BF75), bb: Color(0xFF66D9EF), bm: Color(0xFFAE81FF), bc: Color(0xFFA1EFE4)),
    _t('solarizedDark', 'Solarized', bg: Color(0xFF002B36), fg: Color(0xFF839496), cursor: Color(0xFF93A1A1), bw: Color(0xFFFDF6E3), k: Color(0xFF073642), r: Color(0xFFDC322F), g: Color(0xFF859900), y: Color(0xFFB58900), b: Color(0xFF268BD2), m: Color(0xFFD33682), c: Color(0xFF2AA198), w: Color(0xFFEEE8D5), bk: Color(0xFF002B36), br: Color(0xFFCB4B16), bg2: Color(0xFF586E75), by: Color(0xFF657B83), bb: Color(0xFF839496), bm: Color(0xFF6C71C4), bc: Color(0xFF93A1A1)),
    _t('nord', 'Nord', bg: Color(0xFF2E3440), fg: Color(0xFFD8DEE9), cursor: Color(0xFFD8DEE9), bw: Color(0xFFECEFF4), k: Color(0xFF3B4252), r: Color(0xFFBF616A), g: Color(0xFFA3BE8C), y: Color(0xFFEBCB8B), b: Color(0xFF81A1C1), m: Color(0xFFB48EAD), c: Color(0xFF88C0D0), w: Color(0xFFE5E9F0), bk: Color(0xFF4C566A), br: Color(0xFFBF616A), bg2: Color(0xFFA3BE8C), by: Color(0xFFEBCB8B), bb: Color(0xFF81A1C1), bm: Color(0xFFB48EAD), bc: Color(0xFF8FBCBB)),
    _t('cyberpunk', 'Cyberpunk', bg: Color(0xFF0A0A0A), fg: Color(0xFF00FF41), cursor: Color(0xFFFF0080), bw: Color(0xFFFFFFFF), k: Color(0xFF0A0A0A), r: Color(0xFFFF0080), g: Color(0xFF00FF41), y: Color(0xFFFFFF00), b: Color(0xFF0080FF), m: Color(0xFFFF0080), c: Color(0xFF00FFFF), w: Color(0xFFC0C0C0), bk: Color(0xFF404040), br: Color(0xFFFF4080), bg2: Color(0xFF40FF80), by: Color(0xFFFFFF80), bb: Color(0xFF4080FF), bm: Color(0xFFFF40FF), bc: Color(0xFF40FFFF)),
    _t('ocean', 'Ocean', bg: Color(0xFF001122), fg: Color(0xFFA3D5FF), cursor: Color(0xFF00CCFF), bw: Color(0xFFFFFFFF), k: Color(0xFF001122), r: Color(0xFFFF6B6B), g: Color(0xFF4ECDC4), y: Color(0xFFFFE66D), b: Color(0xFF5DADE2), m: Color(0xFFBB8FCE), c: Color(0xFF76D7C4), w: Color(0xFFBDC3C7), bk: Color(0xFF34495E), br: Color(0xFFFF8A80), bg2: Color(0xFF80CBC4), by: Color(0xFFFFF176), bb: Color(0xFF81D4FA), bm: Color(0xFFCE93D8), bc: Color(0xFFA7FFEB)),
    _t('sunset', 'Sunset', bg: Color(0xFF2D1B69), fg: Color(0xFFFFE4B5), cursor: Color(0xFFFF6B35), bw: Color(0xFFFFFFFF), k: Color(0xFF2D1B69), r: Color(0xFFFF6B35), g: Color(0xFFF7931E), y: Color(0xFFFFE135), b: Color(0xFFFF1744), m: Color(0xFFE91E63), c: Color(0xFFFF5722), w: Color(0xFFFFE4B5), bk: Color(0xFF673AB7), br: Color(0xFFFF8A65), bg2: Color(0xFFFFB74D), by: Color(0xFFFFF176), bb: Color(0xFFFF5252), bm: Color(0xFFF06292), bc: Color(0xFFFF8A50)),
    _t('forest', 'Forest', bg: Color(0xFF0F2027), fg: Color(0xFFA8E6CF), cursor: Color(0xFF7FFFD4), bw: Color(0xFFFFFFFF), k: Color(0xFF0F2027), r: Color(0xFFD2691E), g: Color(0xFF228B22), y: Color(0xFFDAA520), b: Color(0xFF4682B4), m: Color(0xFF8B4513), c: Color(0xFF20B2AA), w: Color(0xFFA8E6CF), bk: Color(0xFF2F4F4F), br: Color(0xFFCD853F), bg2: Color(0xFF32CD32), by: Color(0xFFFFD700), bb: Color(0xFF87CEEB), bm: Color(0xFFD2B48C), bc: Color(0xFFAFEEEE)),
    _t('neon', 'Neon', bg: Color(0xFF0C0C0C), fg: Color(0xFFE0E0E0), cursor: Color(0xFFFF073A), bw: Color(0xFFFFFFFF), k: Color(0xFF0C0C0C), r: Color(0xFFFF073A), g: Color(0xFF39FF14), y: Color(0xFFFFFF33), b: Color(0xFF0066FF), m: Color(0xFFFF00FF), c: Color(0xFF00FFFF), w: Color(0xFFE0E0E0), bk: Color(0xFF333333), br: Color(0xFFFF4D6D), bg2: Color(0xFF66FF66), by: Color(0xFFFFFF66), bb: Color(0xFF3399FF), bm: Color(0xFFFF66FF), bc: Color(0xFF66FFFF)),
    _t('cherry', 'Cherry', bg: Color(0xFF1A0B1A), fg: Color(0xFFFFB6C1), cursor: Color(0xFFFF1493), bw: Color(0xFFFFFFFF), k: Color(0xFF1A0B1A), r: Color(0xFFDC143C), g: Color(0xFFFF69B4), y: Color(0xFFFFB6C1), b: Color(0xFFDA70D6), m: Color(0xFFFF1493), c: Color(0xFFFF6347), w: Color(0xFFFFB6C1), bk: Color(0xFF8B008B), br: Color(0xFFFF69B4), bg2: Color(0xFFFFB6C1), by: Color(0xFFFFCCCB), bb: Color(0xFFDDA0DD), bm: Color(0xFFFF69B4), bc: Color(0xFFFF7F50)),
    _t('matrix', 'Matrix', bg: Color(0xFF000000), fg: Color(0xFF00FF00), cursor: Color(0xFF00FF00), bw: Color(0xFFFFFFFF), k: Color(0xFF000000), r: Color(0xFF008000), g: Color(0xFF00FF00), y: Color(0xFFADFF2F), b: Color(0xFF32CD32), m: Color(0xFF90EE90), c: Color(0xFF98FB98), w: Color(0xFF00FF00), bk: Color(0xFF006400), br: Color(0xFF228B22), bg2: Color(0xFF7FFF00), by: Color(0xFFCCFF99), bb: Color(0xFF66FF66), bm: Color(0xFFB3FFB3), bc: Color(0xFFE0FFE0)),
  ];

  static TerminalColorTheme getById(String id) =>
      all.firstWhere((t) => t.id == id, orElse: () => all.first);
}

class TerminalSettings extends ChangeNotifier {
  static const String _fontSizeKey = 'terminal_fontSize';
  static const String _toolbarGroupsKey = 'terminal_toolbarGroups';
  static const String _toolbarOrderKey = 'terminal_toolbarOrder';
  static const String _themeKey = 'terminal_theme';

  static const List<ToolbarGroup> defaultOrder = ToolbarGroup.values;
  static const Map<ToolbarGroup, bool> defaultEnabled = {
    ToolbarGroup.modifiers: true,
    ToolbarGroup.signals: true,
    ToolbarGroup.arrows: true,
    ToolbarGroup.navigation: true,
    ToolbarGroup.functionKeys: false,
  };

  double _fontSize;
  Map<ToolbarGroup, bool> _groupEnabled;
  List<ToolbarGroup> _groupOrder;
  String _themeId;

  double get fontSize => _fontSize;
  Map<ToolbarGroup, bool> get groupEnabled => Map.unmodifiable(_groupEnabled);
  List<ToolbarGroup> get groupOrder => List.unmodifiable(_groupOrder);
  String get themeId => _themeId;
  TerminalColorTheme get colorTheme => TerminalThemes.getById(_themeId);

  bool isGroupEnabled(ToolbarGroup group) => _groupEnabled[group] ?? false;

  TerminalSettings._({
    required double fontSize,
    required Map<ToolbarGroup, bool> groupEnabled,
    required List<ToolbarGroup> groupOrder,
    required String themeId,
  })  : _fontSize = fontSize,
        _groupEnabled = groupEnabled,
        _groupOrder = groupOrder,
        _themeId = themeId;

  static Future<TerminalSettings> load() async {
    final prefs = await SharedPreferences.getInstance();

    final groupEnabled = Map<ToolbarGroup, bool>.from(defaultEnabled);
    final groupsJson = prefs.getString(_toolbarGroupsKey);
    if (groupsJson != null) {
      final Map<String, dynamic> saved = jsonDecode(groupsJson);
      for (final group in ToolbarGroup.values) {
        if (saved.containsKey(group.name)) {
          groupEnabled[group] = saved[group.name] as bool;
        }
      }
    }

    List<ToolbarGroup> groupOrder = List.from(defaultOrder);
    final orderJson = prefs.getString(_toolbarOrderKey);
    if (orderJson != null) {
      final List<dynamic> saved = jsonDecode(orderJson);
      final parsed = saved
          .map((name) => ToolbarGroup.values.where((g) => g.name == name).firstOrNull)
          .whereType<ToolbarGroup>()
          .toList();
      if (parsed.length == ToolbarGroup.values.length) {
        groupOrder = parsed;
      }
    }

    return TerminalSettings._(
      fontSize: prefs.getDouble(_fontSizeKey) ?? 13.0,
      groupEnabled: groupEnabled,
      groupOrder: groupOrder,
      themeId: prefs.getString(_themeKey) ?? 'default',
    );
  }

  Future<void> setFontSize(double size) async {
    _fontSize = size.clamp(8.0, 24.0);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_fontSizeKey, _fontSize);
    notifyListeners();
  }

  Future<void> setGroupEnabled(ToolbarGroup group, bool value) async {
    _groupEnabled[group] = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _toolbarGroupsKey,
      jsonEncode({for (final g in ToolbarGroup.values) g.name: _groupEnabled[g] ?? false}),
    );
    notifyListeners();
  }

  Future<void> setGroupOrder(List<ToolbarGroup> order) async {
    _groupOrder = order;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _toolbarOrderKey,
      jsonEncode(order.map((g) => g.name).toList()),
    );
    notifyListeners();
  }

  Future<void> setTheme(String id) async {
    _themeId = id;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, id);
    notifyListeners();
  }

}
