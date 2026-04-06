import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeManager extends ChangeNotifier {
  static const Color fallbackSeedColor = Colors.deepPurple;
  static const String _themeModeKey = 'themeMode';

  ThemeMode _themeMode;

  ThemeMode get themeMode => _themeMode;
  bool get isUsingSystemTheme => _themeMode == ThemeMode.system;
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  ThemeManager(ThemeMode themeMode) : _themeMode = themeMode;

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

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setString(
      _themeModeKey,
      mode.name,
    );
  }

  void toggleTheme(bool isDark) async {
    await setThemeMode(isDark ? ThemeMode.dark : ThemeMode.light);
  }

  static ThemeData lightTheme({ColorScheme? colorScheme}) => ThemeData(
    colorScheme:
        colorScheme ?? ColorScheme.fromSeed(seedColor: fallbackSeedColor),
    useMaterial3: true,
  );

  static ThemeData darkTheme({ColorScheme? colorScheme}) => ThemeData(
    colorScheme:
        colorScheme ??
        ColorScheme.fromSeed(
          seedColor: fallbackSeedColor,
          brightness: Brightness.dark,
        ),
    useMaterial3: true,
  );
}
