import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:native_glass_navbar/native_glass_navbar.dart';
import '../services/session_manager.dart';
import '../utils/theme_manager.dart';
import '../utils/auth_manager.dart';
import '../utils/snippet_manager.dart';
import 'servers_screen.dart';
import 'active_sessions_screen.dart';
import 'monitoring_screen.dart';
import 'settings_screen.dart';

class MainNavigationPage extends StatefulWidget {
  final ThemeManager themeManager;
  final AuthManager authManager;
  final SnippetManager snippetManager;
  final SessionManager sessionManager;

  const MainNavigationPage({
    super.key,
    required this.themeManager,
    required this.authManager,
    required this.snippetManager,
    required this.sessionManager,
  });

  @override
  State<MainNavigationPage> createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _selectedIndex = 0;
  final _monitoringKey = GlobalKey<MonitoringScreenState>();

  @override
  void initState() {
    super.initState();
    widget.sessionManager.addListener(_onSessionsChanged);
  }

  @override
  void dispose() {
    widget.sessionManager.removeListener(_onSessionsChanged);
    super.dispose();
  }

  void _onSessionsChanged() {
    if (!mounted) return;

    if (!widget.sessionManager.hasActiveSessions && _selectedIndex == 1) {
      _selectedIndex = 0;
    }
    setState(() {});
  }

  bool get _hasSessions => widget.sessionManager.hasActiveSessions;

  @override
  Widget build(BuildContext context) {
    final hasSessions = _hasSessions;

    if (!hasSessions && _selectedIndex > 0) {
      if (_selectedIndex > 2) _selectedIndex = 0;
    }

    final List<Widget> pages = [
      ServersScreen(
        authManager: widget.authManager,
        snippetManager: widget.snippetManager,
        sessionManager: widget.sessionManager,
        onSwitchToSessions: () {
          if (_hasSessions) setState(() => _selectedIndex = 1);
        },
      ),
      if (hasSessions)
        ActiveSessionsScreen(
          sessionManager: widget.sessionManager,
          authManager: widget.authManager,
          snippetManager: widget.snippetManager,
          onExitFullscreen: () => setState(() => _selectedIndex = 0),
        ),
      MonitoringScreen(key: _monitoringKey, authManager: widget.authManager),
      SettingsScreen(
        themeManager: widget.themeManager,
        authManager: widget.authManager,
      ),
    ];

    if (_selectedIndex >= pages.length) _selectedIndex = 0;

    final isOnSessionsTab = hasSessions && _selectedIndex == 1;
    final monitoringIndex = hasSessions ? 2 : 1;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;

        if (isOnSessionsTab) {
          setState(() => _selectedIndex = 0);
          return;
        }

        if (_selectedIndex == monitoringIndex) {
          final handled = _monitoringKey.currentState?.goBack() ?? false;
          if (handled) return;
        }

        if (_selectedIndex != 0) {
          setState(() => _selectedIndex = 0);
          return;
        }

        SystemNavigator.pop();
      },
      child: Scaffold(
        body: IndexedStack(
          index: _selectedIndex,
          children: pages,
        ),
        bottomNavigationBar: isOnSessionsTab
            ? null
            : _buildBottomNavigationBar(context, hasSessions),
      ),
    );
  }

  Widget _buildBottomNavigationBar(BuildContext context, bool hasSessions) {
    final materialNavigationBar = _buildMaterialNavigationBar(hasSessions);

    if (!Platform.isIOS) {
      return materialNavigationBar;
    }

    return NativeGlassNavBar(
      currentIndex: _selectedIndex,
      onTap: (index) => setState(() => _selectedIndex = index),
      tintColor: Theme.of(context).colorScheme.primary,
      fallback: materialNavigationBar,
      tabs: [
        const NativeGlassNavBarItem(label: 'Servers', symbol: 'network'),
        if (hasSessions)
          const NativeGlassNavBarItem(label: 'Sessions', symbol: 'display'),
        const NativeGlassNavBarItem(label: 'Monitoring', symbol: 'chart.bar'),
        const NativeGlassNavBarItem(label: 'Settings', symbol: 'gear'),
      ],
    );
  }

  Widget _buildMaterialNavigationBar(bool hasSessions) {
    final sessionCount = widget.sessionManager.sessionCount;
    return NavigationBar(
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) => setState(() => _selectedIndex = index),
      destinations: [
        NavigationDestination(
          icon: Icon(Icons.dns_outlined),
          selectedIcon: Icon(Icons.dns),
          label: 'Servers',
        ),
        if (hasSessions)
          NavigationDestination(
            icon: Badge(
              label: Text('$sessionCount'),
              child: Icon(MdiIcons.monitorMultiple),
            ),
            selectedIcon: Badge(
              label: Text('$sessionCount'),
              child: Icon(MdiIcons.monitorMultiple),
            ),
            label: 'Sessions',
          ),
        NavigationDestination(
          icon: Icon(MdiIcons.chartBoxOutline),
          selectedIcon: Icon(MdiIcons.chartBox),
          label: 'Monitoring',
        ),
        NavigationDestination(
          icon: Icon(MdiIcons.cogOutline),
          selectedIcon: Icon(MdiIcons.cog),
          label: 'Settings',
        ),
      ],
    );
  }
}
