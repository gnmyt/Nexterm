import 'package:flutter/material.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/device_setup_screen.dart';
import 'screens/main_navigation_page.dart';
import 'services/api_config.dart';
import 'services/session_manager.dart';
import 'utils/theme_manager.dart';
import 'utils/auth_manager.dart';
import 'utils/snippet_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final themeMode = ThemeManager.parseStoredThemeMode(
    prefs.getString('themeMode'),
  );
  final isLoggedIn = prefs.getBool('isLoggedIn') ?? false;

  await ApiConfig.loadFromPrefs();

  runApp(MyApp(themeMode: themeMode, isLoggedIn: isLoggedIn));
}

class MyApp extends StatefulWidget {
  final ThemeMode themeMode;
  final bool isLoggedIn;

  const MyApp({super.key, required this.themeMode, required this.isLoggedIn});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  late ThemeManager _themeManager;
  late AuthManager _authManager;
  late SnippetManager _snippetManager;
  late SessionManager _sessionManager;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _themeManager = ThemeManager(widget.themeMode);
    _authManager = AuthManager(widget.isLoggedIn);
    _snippetManager = SnippetManager();
    _sessionManager = SessionManager();

    _authManager.addListener(_onAuthChanged);

    if (widget.isLoggedIn) {
      _loadSnippets();
      _restoreSessions();
    }
  }

  Future<void> _loadSnippets() async {
    final token = _authManager.sessionToken;
    if (token != null) {
      await _snippetManager.loadSnippets(token);
    }
  }

  Future<void> _restoreSessions() async {
    final token = _authManager.sessionToken;
    if (token != null) {
      await _sessionManager.restoreSessions(token: token);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _authManager.isAuthenticated) {
      _restoreSessions();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _authManager.removeListener(_onAuthChanged);
    _themeManager.dispose();
    _authManager.dispose();
    _snippetManager.dispose();
    _sessionManager.dispose();
    super.dispose();
  }

  void _onAuthChanged() {
    if (_authManager.isAuthenticated) {
      _loadSnippets();
      _restoreSessions();
    } else {
      _snippetManager.clear();
      final token = _authManager.sessionToken;
      if (token != null) {
        _sessionManager.closeAll(token);
      }
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _themeManager,
      builder: (context, child) {
        return DynamicColorBuilder(
          builder: (lightDynamic, darkDynamic) {
            return MaterialApp(
              title: 'Nexterm',
              theme: ThemeManager.lightTheme(colorScheme: lightDynamic),
              darkTheme: ThemeManager.darkTheme(colorScheme: darkDynamic),
              themeMode: _themeManager.themeMode,
              home: _determineInitialScreen(),
            );
          },
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
            sessionManager: _sessionManager,
          )
        : DeviceSetupScreen(authManager: _authManager);
  }
}
