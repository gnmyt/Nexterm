import 'package:flutter/material.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/device_setup_screen.dart';
import 'screens/main_navigation_page.dart';
import 'services/session_manager.dart';
import 'utils/theme_manager.dart';
import 'utils/auth_manager.dart';
import 'utils/ai_manager.dart';
import 'utils/snippet_manager.dart';
import 'utils/server_account_manager.dart';
import 'utils/terminal_settings.dart';
import 'utils/sftp_settings.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final themeMode = ThemeManager.parseStoredThemeMode(
    prefs.getString('themeMode'),
  );
  final accentSettings = await ThemeManager.loadAccentSettings();
  final terminalSettings = await TerminalSettings.load();
  final sftpSettings = await SftpSettings.load();

  final accountManager = ServerAccountManager();
  await accountManager.load();

  runApp(MyApp(
    themeMode: themeMode,
    accountManager: accountManager,
    accentColor: accentSettings.accentColor,
    useDynamicColor: accentSettings.useDynamicColor,
    terminalSettings: terminalSettings,
    sftpSettings: sftpSettings,
  ));
}

class MyApp extends StatefulWidget {
  final ThemeMode themeMode;
  final ServerAccountManager accountManager;
  final Color accentColor;
  final bool useDynamicColor;
  final TerminalSettings terminalSettings;
  final SftpSettings sftpSettings;

  const MyApp({
    super.key,
    required this.themeMode,
    required this.accountManager,
    required this.accentColor,
    required this.useDynamicColor,
    required this.terminalSettings,
    required this.sftpSettings,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  late ThemeManager _themeManager;
  late AuthManager _authManager;
  late SnippetManager _snippetManager;
  late AIManager _aiManager;
  late SessionManager _sessionManager;
  late TerminalSettings _terminalSettings;
  late SftpSettings _sftpSettings;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _themeManager = ThemeManager(
      widget.themeMode,
      accentColor: widget.accentColor,
      useDynamicColor: widget.useDynamicColor,
    );
    _authManager = AuthManager(widget.accountManager);
    _snippetManager = SnippetManager();
    _aiManager = AIManager();
    _sessionManager = SessionManager();
    _terminalSettings = widget.terminalSettings;
    _sftpSettings = widget.sftpSettings;

    _authManager.addListener(_onAuthChanged);

    if (_authManager.isAuthenticated) {
      _loadSnippets();
      _loadAISettings();
      _restoreSessions();
    }
  }

  Future<void> _loadSnippets() async {
    final token = _authManager.sessionToken;
    if (token != null) {
      await _snippetManager.loadSnippets(token);
    }
  }

  Future<void> _loadAISettings() async {
    final token = _authManager.sessionToken;
    if (token != null) {
      await _aiManager.loadSettings(token);
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
    _aiManager.dispose();
    _sessionManager.dispose();
    _terminalSettings.dispose();
    _sftpSettings.dispose();
    super.dispose();
  }

  void _onAuthChanged() {
    if (_authManager.isAuthenticated) {
      _loadSnippets();
      _loadAISettings();
      _restoreSessions();
    } else {
      _snippetManager.clear();
      _aiManager.clear();
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
              theme: _themeManager.lightTheme(dynamicColorScheme: lightDynamic),
              darkTheme: _themeManager.darkTheme(dynamicColorScheme: darkDynamic),
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
            aiManager: _aiManager,
            sessionManager: _sessionManager,
            terminalSettings: _terminalSettings,
            sftpSettings: _sftpSettings,
          )
        : DeviceSetupScreen(authManager: _authManager);
  }
}
