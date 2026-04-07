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
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
      child: Row(children: [
        ReorderableDragStartListener(
          index: index,
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Icon(MdiIcons.dragHorizontalVariant, color: cs.outline, size: 20),
          ),
        ),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(group.label, style: const TextStyle(fontSize: 14)),
          Text(group.description, style: TextStyle(fontSize: 12, color: cs.outline)),
        ])),
        Switch(value: enabled, onChanged: onToggle),
      ]),
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
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Logout')),
        ],
      ),
    );
    if (shouldLogout == true && mounted) await widget.authManager.logout();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final server = ApiConfig.baseUrl.replaceAll(RegExp(r'https?://'), '').replaceAll('/api', '');

    return Scaffold(
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Text('Settings', style: tt.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),

          if (_username != null) Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(14)),
                  child: Icon(MdiIcons.account, color: cs.onPrimaryContainer, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_fullName ?? _username!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  Padding(padding: const EdgeInsets.only(top: 2),
                    child: Text(server, style: TextStyle(fontSize: 12, color: cs.outline))),
                ])),
                FilledButton.tonal(
                  onPressed: _handleLogout,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Logout', style: TextStyle(fontSize: 13)),
                ),
              ]),
            ),
          ),

          const SizedBox(height: 8),
          _section(cs, children: [
            _navTile(MdiIcons.serverNetwork, 'Connections',
              '${widget.authManager.accountManager.accounts.length} server(s)', cs,
              () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => ServerAccountsScreen(authManager: widget.authManager)))),
            Divider(height: 1, indent: 56, color: cs.outlineVariant.withValues(alpha: 0.3)),
            _navTile(MdiIcons.monitor, 'Sessions', 'Manage active sessions', cs,
              () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => SessionsScreen(authManager: widget.authManager)))),
          ]),

          _sectionHeader('Appearance', cs),
          _section(cs, children: [
            ListenableBuilder(
              listenable: widget.themeManager,
              builder: (_, __) {
                final mode = widget.themeManager.themeMode;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                      child: Icon(MdiIcons.themeLightDark, color: cs.onPrimaryContainer, size: 18),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(child: Text('Theme', style: TextStyle(fontSize: 15))),
                    SegmentedButton<ThemeMode>(
                      segments: const [
                        ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.settings_suggest, size: 18)),
                        ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode, size: 18)),
                        ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode, size: 18)),
                      ],
                      selected: {mode},
                      onSelectionChanged: (s) => widget.themeManager.setThemeMode(s.first),
                      style: ButtonStyle(visualDensity: VisualDensity.compact),
                    ),
                  ]),
                );
              },
            ),
            Divider(height: 1, indent: 56, color: cs.outlineVariant.withValues(alpha: 0.3)),
            ListenableBuilder(
              listenable: widget.themeManager,
              builder: (_, __) => SwitchListTile(
                contentPadding: const EdgeInsets.only(left: 16, right: 12),
                secondary: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                  child: Icon(MdiIcons.palette, color: cs.onPrimaryContainer, size: 18),
                ),
                title: const Text('Dynamic Color', style: TextStyle(fontSize: 15)),
                subtitle: Text('Use system accent color', style: TextStyle(fontSize: 12, color: cs.outline)),
                value: widget.themeManager.useDynamicColor,
                onChanged: (v) => widget.themeManager.setUseDynamicColor(v),
              ),
            ),
            ListenableBuilder(
              listenable: widget.themeManager,
              builder: (_, __) {
                if (widget.themeManager.useDynamicColor) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Accent Color', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.outline)),
                    const SizedBox(height: 10),
                    Wrap(spacing: 10, runSpacing: 10, children: ThemeManager.accentColorOptions.map((color) {
                      final sel = widget.themeManager.accentColor.toARGB32() == color.toARGB32();
                      return GestureDetector(
                        onTap: () => widget.themeManager.setAccentColor(color),
                        child: Container(
                          width: 38, height: 38,
                          decoration: BoxDecoration(
                            color: color, shape: BoxShape.circle,
                            border: sel ? Border.all(color: cs.onSurface, width: 2.5) : null,
                          ),
                          child: sel ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
                        ),
                      );
                    }).toList()),
                  ]),
                );
              },
            ),
          ]),

          _sectionHeader('Terminal', cs),
          _section(cs, children: [
            ListenableBuilder(
              listenable: widget.terminalSettings,
              builder: (_, __) {
                final ts = widget.terminalSettings;
                return Column(children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(children: [
                      Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                        child: Icon(MdiIcons.formatSize, color: cs.onPrimaryContainer, size: 18),
                      ),
                      const SizedBox(width: 12),
                      const Text('Font Size', style: TextStyle(fontSize: 15)),
                      const Spacer(),
                      Text('${ts.fontSize.toInt()} pt', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.outline)),
                    ]),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(children: [
                      IconButton(icon: Icon(MdiIcons.minus, size: 18), onPressed: ts.fontSize > 8 ? () => ts.setFontSize(ts.fontSize - 1) : null),
                      Expanded(child: Slider(value: ts.fontSize, min: 8, max: 24, divisions: 16, onChanged: (v) => ts.setFontSize(v))),
                      IconButton(icon: Icon(MdiIcons.plus, size: 18), onPressed: ts.fontSize < 24 ? () => ts.setFontSize(ts.fontSize + 1) : null),
                    ]),
                  ),
                  Divider(height: 1, indent: 16, endIndent: 16, color: cs.outlineVariant.withValues(alpha: 0.3)),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Align(alignment: Alignment.centerLeft,
                      child: Text('Color Theme', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.outline))),
                  ),
                  SizedBox(
                    height: 72,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      itemCount: TerminalThemes.all.length,
                      itemBuilder: (_, i) {
                        final t = TerminalThemes.all[i];
                        final sel = ts.themeId == t.id;
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: GestureDetector(
                            onTap: () => ts.setTheme(t.id),
                            child: Container(
                              width: 80,
                              decoration: BoxDecoration(
                                color: t.background, borderRadius: BorderRadius.circular(10),
                                border: sel
                                    ? Border.all(color: cs.primary, width: 2.5)
                                    : Border.all(color: cs.outlineVariant, width: 1),
                              ),
                              padding: const EdgeInsets.all(6),
                              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  _colorDot(t.theme.red), _colorDot(t.theme.green),
                                  _colorDot(t.theme.yellow), _colorDot(t.theme.blue),
                                ]),
                                const SizedBox(height: 4),
                                Text(t.name, style: TextStyle(color: t.foreground, fontSize: 10, fontWeight: FontWeight.w600),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              ]),
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
          ]),
          const SizedBox(height: 4),
          _section(cs, children: [
            ListenableBuilder(
              listenable: widget.terminalSettings,
              builder: (_, __) {
                final ts = widget.terminalSettings;
                final order = ts.groupOrder.toList();
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: Text('Keyboard Toolbar', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.outline)),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                    child: Text('Toggle and drag to reorder', style: TextStyle(fontSize: 12, color: cs.outline.withValues(alpha: 0.7))),
                  ),
                  ReorderableListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    buildDefaultDragHandles: false,
                    itemCount: order.length,
                    proxyDecorator: (child, _, __) => Material(elevation: 4, borderRadius: BorderRadius.circular(12), child: child),
                    onReorder: (o, n) {
                      if (n > o) n--;
                      final item = order.removeAt(o);
                      order.insert(n, item);
                      ts.setGroupOrder(order);
                    },
                    itemBuilder: (_, i) {
                      final g = order[i];
                      return _ToolbarGroupTile(key: ValueKey(g), index: i, group: g, enabled: ts.isGroupEnabled(g), onToggle: (v) => ts.setGroupEnabled(g, v));
                    },
                  ),
                ]);
              },
            ),
          ]),

          _sectionHeader('File Browser', cs),
          _section(cs, children: [
            ListenableBuilder(
              listenable: widget.sftpSettings,
              builder: (_, __) {
                final sf = widget.sftpSettings;
                return Column(children: [
                  SwitchListTile(
                    contentPadding: const EdgeInsets.only(left: 16, right: 12),
                    secondary: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                      child: Icon(MdiIcons.fileHidden, color: cs.onPrimaryContainer, size: 18),
                    ),
                    title: const Text('Show Hidden Files', style: TextStyle(fontSize: 15)),
                    subtitle: Text('Show files starting with .', style: TextStyle(fontSize: 12, color: cs.outline)),
                    value: sf.showHiddenFiles,
                    onChanged: (v) => sf.setShowHiddenFiles(v),
                  ),
                  Divider(height: 1, indent: 56, color: cs.outlineVariant.withValues(alpha: 0.3)),
                  SwitchListTile(
                    contentPadding: const EdgeInsets.only(left: 16, right: 12),
                    secondary: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                      child: Icon(MdiIcons.deleteAlert, color: cs.onPrimaryContainer, size: 18),
                    ),
                    title: const Text('Confirm Before Delete', style: TextStyle(fontSize: 15)),
                    value: sf.confirmBeforeDelete,
                    onChanged: (v) => sf.setConfirmBeforeDelete(v),
                  ),
                  Divider(height: 1, indent: 56, color: cs.outlineVariant.withValues(alpha: 0.3)),
                  SwitchListTile(
                    contentPadding: const EdgeInsets.only(left: 16, right: 12),
                    secondary: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                      child: Icon(MdiIcons.folderArrowUp, color: cs.onPrimaryContainer, size: 18),
                    ),
                    title: const Text('Sort Folders First', style: TextStyle(fontSize: 15)),
                    value: sf.sortFoldersFirst,
                    onChanged: (v) => sf.setSortFoldersFirst(v),
                  ),
                ]);
              },
            ),
          ]),
        ]),
      ),
    );
  }

  Widget _section(ColorScheme cs, {required List<Widget> children}) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    child: Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(16)),
      child: Column(children: children),
    ),
  );

  Widget _navTile(IconData icon, String title, String sub, ColorScheme cs, VoidCallback onTap) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: cs.onPrimaryContainer, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 15)),
            Padding(padding: const EdgeInsets.only(top: 2),
              child: Text(sub, style: TextStyle(fontSize: 12, color: cs.outline))),
          ])),
          Icon(MdiIcons.chevronRight, color: cs.outlineVariant, size: 18),
        ]),
      ),
    ),
  );

  Widget _colorDot(Color color) => Container(
    width: 10, height: 10, margin: const EdgeInsets.symmetric(horizontal: 1),
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );

  Widget _sectionHeader(String title, ColorScheme cs) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
    child: Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: cs.primary)),
  );
}
