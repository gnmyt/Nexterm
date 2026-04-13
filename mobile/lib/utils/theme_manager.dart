import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeManager extends ChangeNotifier {
  static const Color fallbackSeedColor = Colors.deepPurple;
  static const String _themeModeKey = 'themeMode';
  static const String _accentColorKey = 'accentColor';
  static const String _useDynamicColorKey = 'useDynamicColor';

  static const List<Color> accentColorOptions = [
    Colors.deepPurple,
    Colors.blue,
    Colors.teal,
    Colors.green,
    Colors.amber,
    Colors.orange,
    Colors.red,
    Colors.pink,
    Colors.indigo,
    Colors.cyan,
  ];

  ThemeMode _themeMode;
  Color _accentColor;
  bool _useDynamicColor;

  ThemeMode get themeMode => _themeMode;
  Color get accentColor => _accentColor;
  bool get useDynamicColor => _useDynamicColor;

  ThemeManager(ThemeMode themeMode, {Color? accentColor, bool? useDynamicColor})
      : _themeMode = themeMode,
        _accentColor = accentColor ?? fallbackSeedColor,
        _useDynamicColor = useDynamicColor ?? true;

  static ThemeMode parseStoredThemeMode(String? storedMode) {
    switch (storedMode) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      case 'system':
      default:
        return ThemeMode.system;
    }
  }

  static Future<({Color accentColor, bool useDynamicColor})> loadAccentSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final colorValue = prefs.getInt(_accentColorKey);
    final useDynamic = prefs.getBool(_useDynamicColorKey) ?? true;
    return (
      accentColor: colorValue != null ? Color(colorValue) : fallbackSeedColor,
      useDynamicColor: useDynamic,
    );
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setString(
      _themeModeKey,
      mode.name,
    );
  }

  Future<void> setAccentColor(Color color) async {
    _accentColor = color;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setInt(
      _accentColorKey,
      color.toARGB32(),
    );
  }

  Future<void> setUseDynamicColor(bool value) async {
    _useDynamicColor = value;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setBool(
      _useDynamicColorKey,
      value,
    );
  }

  void toggleTheme(bool isDark) async {
    await setThemeMode(isDark ? ThemeMode.dark : ThemeMode.light);
  }

  static const _pageTransitions = PageTransitionsTheme(
    builders: {
      TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
    },
  );

  ThemeData lightTheme({ColorScheme? dynamicColorScheme}) => ThemeData(
    colorScheme: (_useDynamicColor && dynamicColorScheme != null)
        ? dynamicColorScheme
        : ColorScheme.fromSeed(seedColor: _accentColor),
    useMaterial3: true,
    pageTransitionsTheme: _pageTransitions,
  );

  ThemeData darkTheme({ColorScheme? dynamicColorScheme}) => ThemeData(
    colorScheme: (_useDynamicColor && dynamicColorScheme != null)
        ? dynamicColorScheme
        : ColorScheme.fromSeed(seedColor: _accentColor, brightness: Brightness.dark),
    useMaterial3: true,
    pageTransitionsTheme: _pageTransitions,
  );
}
