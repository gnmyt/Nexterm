import 'dart:io';

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:native_glass_navbar/native_glass_navbar.dart';
import '../utils/theme_manager.dart';
import '../utils/auth_manager.dart';
import '../utils/snippet_manager.dart';
import 'servers_screen.dart';
import 'monitoring_screen.dart';
import 'settings_screen.dart';

class MainNavigationPage extends StatefulWidget {
  final ThemeManager themeManager;
  final AuthManager authManager;
  final SnippetManager snippetManager;

  const MainNavigationPage({
    super.key,
    required this.themeManager,
    required this.authManager,
    required this.snippetManager,
  });

  @override
  State<MainNavigationPage> createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      ServersScreen(
        authManager: widget.authManager,
        snippetManager: widget.snippetManager,
      ),
      MonitoringScreen(authManager: widget.authManager),
      SettingsScreen(
        themeManager: widget.themeManager,
        authManager: widget.authManager,
      ),
    ];

    return Scaffold(
      body: pages[_selectedIndex],
      bottomNavigationBar: _buildBottomNavigationBar(context),
    );
  }

  Widget _buildBottomNavigationBar(BuildContext context) {
    final materialNavigationBar = _buildMaterialNavigationBar();

    if (!Platform.isIOS) {
      return materialNavigationBar;
    }

    return NativeGlassNavBar(
      currentIndex: _selectedIndex,
      onTap: (index) => setState(() => _selectedIndex = index),
      tintColor: Theme.of(context).colorScheme.primary,
      fallback: materialNavigationBar,
      tabs: const [
        NativeGlassNavBarItem(label: 'Servers', symbol: 'network'),
        NativeGlassNavBarItem(label: 'Monitoring', symbol: 'chart.bar'),
        NativeGlassNavBarItem(label: 'Settings', symbol: 'gear'),
      ],
    );
  }

  Widget _buildMaterialNavigationBar() {
    return NavigationBar(
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) => setState(() => _selectedIndex = index),
      destinations: [
        NavigationDestination(
          icon: Icon(Icons.dns_outlined),
          selectedIcon: Icon(Icons.dns),
          label: 'Servers',
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
