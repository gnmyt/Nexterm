import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/device_setup_screen.dart';
import 'screens/main_navigation_page.dart';
import 'services/api_config.dart';
import 'utils/theme_manager.dart';
import 'utils/auth_manager.dart';
import 'utils/snippet_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final isDarkMode = prefs.getBool('isDarkMode') ?? false;
  final isLoggedIn = prefs.getBool('isLoggedIn') ?? false;

  await ApiConfig.loadFromPrefs();

  runApp(MyApp(isDarkMode: isDarkMode, isLoggedIn: isLoggedIn));
}

class MyApp extends StatefulWidget {
  final bool isDarkMode;
  final bool isLoggedIn;

  const MyApp({super.key, required this.isDarkMode, required this.isLoggedIn});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late ThemeManager _themeManager;
  late AuthManager _authManager;
  late SnippetManager _snippetManager;

  @override
  void initState() {
    super.initState();
    _themeManager = ThemeManager(widget.isDarkMode);
    _authManager = AuthManager(widget.isLoggedIn);
    _snippetManager = SnippetManager();

    _authManager.addListener(_onAuthChanged);

    if (widget.isLoggedIn) {
      _loadSnippets();
    }
  }

  Future<void> _loadSnippets() async {
    final token = _authManager.sessionToken;
    if (token != null) {
      await _snippetManager.loadSnippets(token);
    }
  }

  @override
  void dispose() {
    _authManager.removeListener(_onAuthChanged);
    _themeManager.dispose();
    _authManager.dispose();
    _snippetManager.dispose();
    super.dispose();
  }

  void _onAuthChanged() {
    if (_authManager.isAuthenticated) {
      _loadSnippets();
    } else {
      _snippetManager.clear();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _themeManager,
      builder: (context, child) {
        return MaterialApp(
          title: 'Nexterm',
          theme: ThemeManager.lightTheme,
          darkTheme: ThemeManager.darkTheme,
          themeMode: _themeManager.themeMode,
          home: _determineInitialScreen(),
        );
      },
    );
  }

  Widget _determineInitialScreen() {
    return _authManager.isAuthenticated
        ? MainNavigationPage(
            themeManager: _themeManager,
            authManager: _authManager,
            snippetManager: _snippetManager,
          )
        : DeviceSetupScreen(authManager: _authManager);
  }
}
