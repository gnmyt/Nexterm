import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../utils/theme_manager.dart';
import '../utils/auth_manager.dart';
import '../utils/terminal_settings.dart';
import '../utils/sftp_settings.dart';
import '../services/api_config.dart';
import 'sessions_screen.dart';
import 'server_accounts_screen.dart';

class _ToolbarGroupTile extends StatelessWidget {
  final int index;
  final ToolbarGroup group;
  final bool enabled;
  final ValueChanged<bool> onToggle;

  const _ToolbarGroupTile({
    super.key,
    required this.index,
    required this.group,
    required this.enabled,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
      child: Row(
        children: [
          ReorderableDragStartListener(
            index: index,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Icon(MdiIcons.dragHorizontalVariant, color: theme.colorScheme.outline, size: 20),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(group.label, style: theme.textTheme.bodyLarge),
                Text(group.description, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline)),
              ],
            ),
          ),
          Switch(
            value: enabled,
            onChanged: onToggle,
          ),
        ],
      ),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  final ThemeManager themeManager;
  final AuthManager authManager;
  final TerminalSettings terminalSettings;
  final SftpSettings sftpSettings;

  const SettingsScreen({
    super.key,
    required this.themeManager,
    required this.authManager,
    required this.terminalSettings,
    required this.sftpSettings,
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

  void _loadUserInfo() {
    setState(() {
      _username = widget.authManager.getUsername();
      _fullName = widget.authManager.getFullName();
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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(8.0),
        children: [
          if (_username != null)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
              child: ListTile(
                leading: CircleAvatar(child: Icon(MdiIcons.account)),
                title: Text(_fullName ?? _username!),
                subtitle: Text(
                  '@${ApiConfig.baseUrl.replaceAll(RegExp(r'https?://'), '').replaceAll('/api', '')}',
                ),
                trailing: TextButton(
                  onPressed: _handleLogout,
                  child: const Text('Logout'),
                ),
              ),
            ),

          Card(
            margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
            child: Column(children: [
              ListTile(
                leading: Icon(MdiIcons.serverNetwork),
                title: const Text('Connections'),
                subtitle: Text(
                  '${widget.authManager.accountManager.accounts.length} server(s)',
                ),
                trailing: Icon(MdiIcons.chevronRight),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ServerAccountsScreen(
                        authManager: widget.authManager,
                      ),
                    ),
                  );
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(MdiIcons.monitor),
                title: const Text('Sessions'),
                subtitle: const Text('Manage active sessions'),
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
            ]),
          ),

          _sectionHeader('Appearance'),
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
            child: Column(children: [
              ListenableBuilder(
                listenable: widget.themeManager,
                builder: (context, child) {
                  final selectedMode = widget.themeManager.themeMode;
                  return ListTile(
                    leading: Icon(MdiIcons.themeLightDark),
                    title: const Text('Theme'),
                    trailing: SegmentedButton<ThemeMode>(
                      segments: const <ButtonSegment<ThemeMode>>[
                        ButtonSegment<ThemeMode>(
                          value: ThemeMode.system,
                          icon: Icon(Icons.settings_suggest),
                        ),
                        ButtonSegment<ThemeMode>(
                          value: ThemeMode.light,
                          icon: Icon(Icons.light_mode),
                        ),
                        ButtonSegment<ThemeMode>(
                          value: ThemeMode.dark,
                          icon: Icon(Icons.dark_mode),
                        ),
                      ],
                      selected: <ThemeMode>{selectedMode},
                      onSelectionChanged: (Set<ThemeMode> newSelection) {
                        widget.themeManager.setThemeMode(newSelection.first);
                      },
                    ),
                  );
                },
              ),
              const Divider(height: 1),
              ListenableBuilder(
                listenable: widget.themeManager,
                builder: (context, child) {
                  return SwitchListTile(
                    secondary: Icon(MdiIcons.palette),
                    title: const Text('Dynamic Color'),
                    subtitle: const Text('Use system accent color'),
                    value: widget.themeManager.useDynamicColor,
                    onChanged: (value) {
                      widget.themeManager.setUseDynamicColor(value);
                    },
                  );
                },
              ),
              const Divider(height: 1),
              ListenableBuilder(
                listenable: widget.themeManager,
                builder: (context, child) {
                  if (widget.themeManager.useDynamicColor) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Accent Color', style: theme.textTheme.titleSmall),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: ThemeManager.accentColorOptions.map((color) {
                            final isSelected = widget.themeManager.accentColor.toARGB32() == color.toARGB32();
                            return GestureDetector(
                              onTap: () => widget.themeManager.setAccentColor(color),
                              child: Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: color,
                                  shape: BoxShape.circle,
                                  border: isSelected
                                      ? Border.all(color: theme.colorScheme.onSurface, width: 3)
                                      : null,
                                ),
                                child: isSelected
                                    ? Icon(Icons.check, color: Colors.white, size: 20)
                                    : null,
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ]),
          ),

          _sectionHeader('Terminal'),
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
            child: ListenableBuilder(
              listenable: widget.terminalSettings,
              builder: (context, child) {
                final ts = widget.terminalSettings;
                return Column(children: [
                  ListTile(
                    leading: Icon(MdiIcons.formatSize),
                    title: const Text('Font Size'),
                    subtitle: Text('${ts.fontSize.toInt()} pt'),
                    trailing: SizedBox(
                      width: 180,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(MdiIcons.minus),
                            onPressed: ts.fontSize > 8
                                ? () => ts.setFontSize(ts.fontSize - 1)
                                : null,
                          ),
                          Expanded(
                            child: Slider(
                              value: ts.fontSize,
                              min: 8,
                              max: 24,
                              divisions: 16,
                              onChanged: (v) => ts.setFontSize(v),
                            ),
                          ),
                          IconButton(
                            icon: Icon(MdiIcons.plus),
                            onPressed: ts.fontSize < 24
                                ? () => ts.setFontSize(ts.fontSize + 1)
                                : null,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16.0, 12.0, 16.0, 4.0),
                    child: Text('Color Theme', style: theme.textTheme.titleSmall),
                  ),
                  SizedBox(
                    height: 72,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 4.0),
                      itemCount: TerminalThemes.all.length,
                      itemBuilder: (context, index) {
                        final t = TerminalThemes.all[index];
                        final isSelected = ts.themeId == t.id;
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4.0),
                          child: GestureDetector(
                            onTap: () => ts.setTheme(t.id),
                            child: Container(
                              width: 80,
                              decoration: BoxDecoration(
                                color: t.background,
                                borderRadius: BorderRadius.circular(10),
                                border: isSelected
                                    ? Border.all(color: theme.colorScheme.primary, width: 2.5)
                                    : Border.all(color: theme.colorScheme.outlineVariant, width: 1),
                              ),
                              padding: const EdgeInsets.all(6),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      _colorDot(t.theme.red), _colorDot(t.theme.green),
                                      _colorDot(t.theme.yellow), _colorDot(t.theme.blue),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    t.name,
                                    style: TextStyle(color: t.foreground, fontSize: 10, fontWeight: FontWeight.w600),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 8),
                ]);
              },
            ),
          ),
          const SizedBox(height: 4),
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
            child: ListenableBuilder(
              listenable: widget.terminalSettings,
              builder: (context, child) {
                final ts = widget.terminalSettings;
                final order = ts.groupOrder.toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16.0, 12.0, 16.0, 4.0),
                      child: Text('Keyboard Toolbar', style: theme.textTheme.titleSmall),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16.0, 0, 16.0, 8.0),
                      child: Text(
                        'Toggle and drag to reorder key groups',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ),
                    ReorderableListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      buildDefaultDragHandles: false,
                      itemCount: order.length,
                      proxyDecorator: (child, index, animation) {
                        return Material(
                          elevation: 4,
                          borderRadius: BorderRadius.circular(12),
                          child: child,
                        );
                      },
                      onReorder: (oldIndex, newIndex) {
                        if (newIndex > oldIndex) newIndex--;
                        final item = order.removeAt(oldIndex);
                        order.insert(newIndex, item);
                        ts.setGroupOrder(order);
                      },
                      itemBuilder: (context, index) {
                        final group = order[index];
                        final enabled = ts.isGroupEnabled(group);
                        return _ToolbarGroupTile(
                          key: ValueKey(group),
                          index: index,
                          group: group,
                          enabled: enabled,
                          onToggle: (v) => ts.setGroupEnabled(group, v),
                        );
                      },
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          _sectionHeader('File Browser'),
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
            child: ListenableBuilder(
              listenable: widget.sftpSettings,
              builder: (context, child) {
                final sf = widget.sftpSettings;
                return Column(children: [
                  SwitchListTile(
                    secondary: Icon(MdiIcons.fileHidden),
                    title: const Text('Show Hidden Files'),
                    subtitle: const Text('Show files starting with .'),
                    value: sf.showHiddenFiles,
                    onChanged: (v) => sf.setShowHiddenFiles(v),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    secondary: Icon(MdiIcons.deleteAlert),
                    title: const Text('Confirm Before Delete'),
                    value: sf.confirmBeforeDelete,
                    onChanged: (v) => sf.setConfirmBeforeDelete(v),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    secondary: Icon(MdiIcons.folderArrowUp),
                    title: const Text('Sort Folders First'),
                    value: sf.sortFoldersFirst,
                    onChanged: (v) => sf.setSortFoldersFirst(v),
                  ),
                ]);
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _colorDot(Color color) {
    return Container(
      width: 10,
      height: 10,
      margin: const EdgeInsets.symmetric(horizontal: 1),
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 4.0),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
