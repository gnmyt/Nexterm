import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../utils/theme_manager.dart';
import '../utils/auth_manager.dart';
import '../services/api_config.dart';
import 'sessions_screen.dart';

class SettingsScreen extends StatefulWidget {
  final ThemeManager themeManager;
  final AuthManager authManager;

  const SettingsScreen({
    super.key,
    required this.themeManager,
    required this.authManager,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _username;
  String? _fullName;

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
  }

  Future<void> _loadUserInfo() async {
    final username = await widget.authManager.getUsername();
    final fullName = await widget.authManager.getFullName();
    setState(() {
      _username = username;
      _fullName = fullName;
    });
  }

  Future<void> _handleLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (shouldLogout == true && mounted) {
      await widget.authManager.logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(8.0),
        children: [
          if (_username != null)
            Card(
              margin: const EdgeInsets.symmetric(
                vertical: 4.0,
                horizontal: 8.0,
              ),
              child: ListTile(
                leading: CircleAvatar(child: Icon(MdiIcons.account)),
                title: Text(_fullName ?? _username!),
                subtitle: Text('@${ApiConfig.baseUrl.replaceAll(RegExp(r'https?://'), '').replaceAll('/api', '')}'),
                trailing: TextButton(
                  onPressed: _handleLogout,
                  child: const Text('Logout'),
                ),
              ),
            ),
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
            child: Column(
              children: [
                ListenableBuilder(
                  listenable: widget.themeManager,
                  builder: (context, child) {
                    return ListTile(
                      leading: Icon(MdiIcons.themeLightDark),
                      title: const Text('Dark Mode'),
                      trailing: Switch(
                        value: widget.themeManager.isDarkMode,
                        onChanged: (bool value) {
                          widget.themeManager.toggleTheme(value);
                        },
                      ),
                    );
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(MdiIcons.monitor),
                  title: const Text('Sessions'),
                  trailing: Icon(MdiIcons.chevronRight),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            SessionsScreen(authManager: widget.authManager),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
