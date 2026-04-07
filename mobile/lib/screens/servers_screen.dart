import 'dart:async';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/server.dart';
import '../models/server_folder.dart';
import '../services/server_service.dart';
import '../services/session_manager.dart';
import '../utils/auth_manager.dart';
import '../utils/snippet_manager.dart';
import '../utils/folder_state_manager.dart';

class ServersScreen extends StatefulWidget {
  final AuthManager authManager;
  final SnippetManager snippetManager;
  final SessionManager sessionManager;
  final VoidCallback? onSwitchToSessions;

  const ServersScreen({super.key, required this.authManager, required this.snippetManager, required this.sessionManager, this.onSwitchToSessions});

  @override
  State<ServersScreen> createState() => _ServersScreenState();
}

class _ServersScreenState extends State<ServersScreen> {
  List<ServerFolder> folders = [];
  List<ServerFolder> filteredFolders = [];
  bool isLoading = true;
  String? errorMessage;
  FolderStateManager? _folderState;
  final Set<dynamic> _expanded = {};
  final _search = TextEditingController();
  String _query = '';
  Timer? _debounce;
  bool _searchFocused = false;

  int get _totalServers => folders.fold(0, (sum, f) => sum + _countServers(f));
  int _countServers(ServerFolder f) => f.allServers.length + f.allFolders.fold(0, (sum, sf) => sum + _countServers(sf));
  int get _onlineServers => folders.fold(0, (sum, f) => sum + _countOnline(f));
  int _countOnline(ServerFolder f) => f.allServers.where((s) => s.isRunning).length + f.allFolders.fold(0, (sum, sf) => sum + _countOnline(sf));

  @override
  void initState() {
    super.initState();
    _search.addListener(_onSearch);
    _initStateManager();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.removeListener(_onSearch);
    _search.dispose();
    super.dispose();
  }

  void _onSearch() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() { _query = _search.text; _filterFolders(); });
    });
  }

  Future<void> _initStateManager() async {
    _folderState = await FolderStateManager.create();
    await _loadData();
  }

  Future<void> _loadData() async {
    try {
      await Future.delayed(const Duration(milliseconds: 100));
      final token = widget.authManager.sessionToken;
      if (token == null) { setState(() { errorMessage = 'Not authenticated'; isLoading = false; }); return; }
      final data = await ServerService.getServerList(token);
      _expanded.clear();
      if (_folderState != null) _restoreStates(data);
      setState(() { folders = data; isLoading = false; errorMessage = null; });
      _filterFolders();
    } catch (e) {
      setState(() { errorMessage = 'Failed to load servers: $e'; isLoading = false; });
    }
  }

  void _filterFolders() {
    if (_query.isEmpty) { filteredFolders = List.from(folders); return; }
    filteredFolders = folders.map(_filterFolder).whereType<ServerFolder>().toList();
  }

  ServerFolder? _filterFolder(ServerFolder folder) {
    final q = _query.toLowerCase();
    final matchServers = folder.allServers.where((s) => s.name.toLowerCase().contains(q) || s.ip.toLowerCase().contains(q)).toList();
    final matchFolders = folder.allFolders.map(_filterFolder).whereType<ServerFolder>().toList();
    if (folder.name.toLowerCase().contains(q) || matchServers.isNotEmpty || matchFolders.isNotEmpty) {
      return ServerFolder(
        id: folder.id, name: folder.name, type: folder.type, position: folder.position,
        organizationId: folder.organizationId, requireConnectionReason: folder.requireConnectionReason,
        entries: [...matchServers.map((s) => s.toJson()), ...matchFolders.map((f) => f.toJson())],
        ip: folder.ip, icon: folder.icon, folderType: folder.folderType,
      );
    }
    return null;
  }

  Future<void> _refreshData() async {
    try {
      final token = widget.authManager.sessionToken;
      if (token == null) return;
      final data = await ServerService.getServerList(token);
      _expanded.clear();
      if (_folderState != null) _restoreStates(data);
      setState(() { folders = data; errorMessage = null; });
      _filterFolders();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to refresh: $e'), behavior: SnackBarBehavior.floating));
    }
  }

  void _restoreStates(List<ServerFolder> list) {
    for (final f in list) {
      if (_folderState != null && f.id != null && _folderState!.isFolderExpanded(f.id)) _expanded.add(f.id);
      if (f.allFolders.isNotEmpty) _restoreStates(f.allFolders);
    }
  }

  Future<void> _toggleFolder(dynamic id) async {
    _expanded.contains(id) ? _expanded.remove(id) : _expanded.add(id);
    if (_folderState != null && id != null) await _folderState!.setFolderExpanded(id, _expanded.contains(id));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          _buildHeader(cs, tt),
          Expanded(
            child: isLoading
                ? const Center(child: CircularProgressIndicator())
                : errorMessage != null ? _buildError(cs, tt) : filteredFolders.isEmpty ? _buildEmpty(cs, tt) : _buildList(cs),
          ),
        ]),
      ),
    );
  }

  Widget _buildHeader(ColorScheme cs, TextTheme tt) {
    final sessions = widget.sessionManager.sessionCount;
    final total = _totalServers;
    final online = _onlineServers;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Servers', style: tt.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
            if (!isLoading && errorMessage == null && total > 0)
              Padding(padding: const EdgeInsets.only(top: 2),
                child: Text('$online of $total online', style: tt.bodySmall?.copyWith(color: cs.outline))),
          ])),
          if (sessions > 0)
            ListenableBuilder(listenable: widget.sessionManager, builder: (_, __) {
              final count = widget.sessionManager.sessionCount;
              if (count == 0) return const SizedBox.shrink();
              return GestureDetector(
                onTap: () => widget.onSwitchToSessions?.call(),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(12)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(MdiIcons.monitorMultiple, size: 16, color: cs.onPrimaryContainer),
                    const SizedBox(width: 6),
                    Text('$count', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: cs.onPrimaryContainer)),
                  ]),
                ),
              );
            }),
        ]),
        const SizedBox(height: 16),
        Focus(
          onFocusChange: (f) => setState(() => _searchFocused = f),
          child: TextField(
            controller: _search,
            decoration: InputDecoration(
              hintText: 'Search servers...',
              prefixIcon: Icon(MdiIcons.magnify, size: 22),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(icon: Icon(MdiIcons.close, size: 20), onPressed: () => _search.clear())
                  : null,
              filled: true,
              fillColor: _searchFocused ? cs.surfaceContainerHighest : cs.surfaceContainerHigh,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: cs.primary, width: 1.5)),
              contentPadding: EdgeInsets.zero,
              isDense: true,
            ),
          ),
        ),
        const SizedBox(height: 8),
      ]),
    );
  }

  Widget _buildError(ColorScheme cs, TextTheme tt) => Center(
    child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: cs.errorContainer, shape: BoxShape.circle),
        child: Icon(MdiIcons.alertCircleOutline, size: 32, color: cs.onErrorContainer),
      ),
      const SizedBox(height: 20),
      Text('Something went wrong', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      Text(errorMessage!, style: tt.bodySmall?.copyWith(color: cs.outline), textAlign: TextAlign.center),
      const SizedBox(height: 24),
      FilledButton.icon(onPressed: _loadData, icon: Icon(MdiIcons.refresh, size: 18), label: const Text('Retry'),
        style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
    ])),
  );

  Widget _buildEmpty(ColorScheme cs, TextTheme tt) => RefreshIndicator(
    onRefresh: _refreshData,
    child: ListView(children: [SizedBox(
      height: MediaQuery.of(context).size.height * 0.5,
      child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: cs.surfaceContainerHigh, shape: BoxShape.circle),
          child: Icon(MdiIcons.serverOff, size: 32, color: cs.outline),
        ),
        const SizedBox(height: 20),
        Text(_query.isEmpty ? 'No servers yet' : 'No results', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(_query.isEmpty ? 'Add servers from the web dashboard' : 'Try a different search term',
          style: tt.bodySmall?.copyWith(color: cs.outline)),
      ])),
    )]),
  );

  Widget _buildList(ColorScheme cs) => RefreshIndicator(
    onRefresh: _refreshData,
    child: ListView.builder(
      padding: const EdgeInsets.only(left: 8, right: 8, bottom: 16, top: 4),
      itemCount: filteredFolders.length,
      itemBuilder: (_, i) => _buildEntry(filteredFolders[i], 0),
    ),
  );

  Widget _buildEntry(dynamic entry, int depth) {
    if (entry is ServerFolder) return _buildFolder(entry, depth);
    if (entry is Server) return _buildServer(entry, depth);
    return const SizedBox.shrink();
  }

  Widget _buildFolder(ServerFolder folder, int depth) {
    final cs = Theme.of(context).colorScheme;
    final hasEntries = folder.entries.isNotEmpty;
    final open = _expanded.contains(folder.id);
    final serverCount = folder.allServers.length + folder.allFolders.fold(0, (sum, f) => sum + _countServers(f));

    final (icon, color) = folder.isOrganization
        ? (open ? MdiIcons.domain : MdiIcons.domainOff, cs.primary)
        : folder.isPveNode
            ? (MdiIcons.server, cs.tertiary)
            : (open ? MdiIcons.folderOpen : MdiIcons.folder, cs.primary);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: EdgeInsets.only(left: 12.0 + depth * 16, right: 12, top: depth == 0 ? 4 : 0),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: hasEntries ? () => _toggleFolder(folder.id) : null,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              child: Row(children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, color: color, size: 17),
                ),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(folder.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                  if (serverCount > 0) Text('$serverCount server${serverCount == 1 ? '' : 's'}',
                    style: TextStyle(fontSize: 11, color: cs.outline)),
                ])),
                if (hasEntries)
                  AnimatedRotation(turns: open ? 0.5 : 0, duration: const Duration(milliseconds: 200),
                    child: Icon(MdiIcons.chevronDown, color: cs.outline, size: 20)),
              ]),
            ),
          ),
        ),
      ),
      AnimatedCrossFade(
        firstChild: const SizedBox(width: double.infinity),
        secondChild: Column(children: [
          for (final s in folder.allServers) _buildServer(s, depth + 1),
          for (final f in folder.allFolders) _buildFolder(f, depth + 1),
        ]),
        crossFadeState: open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
        duration: const Duration(milliseconds: 200),
        sizeCurve: Curves.easeInOut,
      ),
    ]);
  }

  Widget _buildServer(Server server, int depth) {
    final cs = Theme.of(context).colorScheme;
    final offline = server.isStopped;
    final pve = server.isPve;
    final icon = _serverIcon(server);

    final (bg, fg) = offline
        ? (cs.surfaceContainerHighest, cs.outline)
        : pve ? (cs.tertiaryContainer, cs.onTertiaryContainer) : (cs.primaryContainer, cs.onPrimaryContainer);

    String? sub;
    if (pve && server.status != null) {
      sub = server.ip.isNotEmpty && server.ip != 'N/A' ? '${server.status} · ${server.ip}' : server.status;
    } else if (server.ip.isNotEmpty && server.ip != 'N/A') {
      sub = server.ip;
    }

    return Padding(
      padding: EdgeInsets.only(left: 12.0 + depth * 16, right: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _connectToServer(server),
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
                child: Center(child: Icon(icon, color: fg, size: 20)),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(server.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: offline ? cs.outline : cs.onSurface), overflow: TextOverflow.ellipsis),
                if (sub != null) Padding(padding: const EdgeInsets.only(top: 2),
                  child: Text(sub, style: TextStyle(fontSize: 12, color: cs.outline), overflow: TextOverflow.ellipsis)),
              ])),
              if (server.tags?.isNotEmpty == true)
                Padding(padding: const EdgeInsets.only(right: 4),
                  child: Row(mainAxisSize: MainAxisSize.min, children: server.tags!.take(3).map((t) => Container(
                    width: 8, height: 8, margin: const EdgeInsets.only(left: 4),
                    decoration: BoxDecoration(color: _parseColor(t.color), shape: BoxShape.circle),
                  )).toList())),
              Icon(MdiIcons.chevronRight, color: cs.outlineVariant, size: 18),
            ]),
          ),
        ),
      ),
    );
  }

  Future<void> _connectGuacamole(Server server) async {
    final token = widget.authManager.sessionToken;
    if (token == null) return;
    try {
      await widget.sessionManager.createGuacSession(token: token, server: server);
      if (mounted) widget.onSwitchToSessions?.call();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to connect: $e'), behavior: SnackBarBehavior.floating));
    }
  }

  Future<void> _connectTerminal(Server server) async {
    final token = widget.authManager.sessionToken;
    if (token == null) return;
    try {
      await widget.sessionManager.createTerminalSession(token: token, server: server);
      if (mounted) widget.onSwitchToSessions?.call();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to connect: $e'), behavior: SnackBarBehavior.floating));
    }
  }

  Future<void> _connectSftp(Server server) async {
    final token = widget.authManager.sessionToken;
    if (token == null) return;
    try {
      await widget.sessionManager.createSftpSession(token: token, server: server);
      if (mounted) widget.onSwitchToSessions?.call();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to connect: $e'), behavior: SnackBarBehavior.floating));
    }
  }

  void _connectToServer(Server server) {
    final cs = Theme.of(context).colorScheme;
    if (server.isStopped) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${server.name} is ${server.isPve ? "not running" : "offline"}'), behavior: SnackBarBehavior.floating));
      return;
    }
    if (ServerService.isGuacamoleProtocol(server.protocol) || server.type == 'pve-qemu') {
      _connectGuacamole(server);
      return;
    }
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Center(child: Container(
          margin: const EdgeInsets.only(top: 12, bottom: 4), width: 36, height: 4,
          decoration: BoxDecoration(color: cs.outlineVariant, borderRadius: BorderRadius.circular(2)),
        )),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
              child: Icon(_serverIcon(server), color: cs.onPrimaryContainer, size: 18),
            ),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(server.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              if (server.ip.isNotEmpty && server.ip != 'N/A')
                Text(server.ip, style: TextStyle(fontSize: 12, color: cs.outline)),
            ]),
          ]),
        ),
        const SizedBox(height: 8),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
          Expanded(child: _connectionOption(ctx, MdiIcons.consoleLine, 'Terminal', 'SSH session', cs, () {
            Navigator.pop(ctx); _connectTerminal(server);
          })),
          const SizedBox(width: 10),
          Expanded(child: _connectionOption(ctx, MdiIcons.folderOutline, 'SFTP', 'File manager', cs, () {
            Navigator.pop(ctx); _connectSftp(server);
          })),
        ])),
        const SizedBox(height: 16),
      ])),
    );
  }

  Widget _connectionOption(BuildContext ctx, IconData icon, String title, String sub, ColorScheme cs, VoidCallback onTap) =>
    Material(
      color: cs.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
          child: Column(children: [
            Icon(icon, color: cs.primary, size: 28),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(sub, style: TextStyle(fontSize: 11, color: cs.outline)),
          ]),
        ),
      ),
    );

  IconData _serverIcon(Server server) {
    if (server.type == 'pve-lxc') return MdiIcons.cubeOutline;
    if (server.type == 'pve-qemu') return MdiIcons.monitor;
    if (server.type == 'pve-shell') return MdiIcons.console;
    final p = server.protocol?.toLowerCase();
    if (p == 'rdp') return MdiIcons.microsoftWindows;
    if (p == 'vnc') return MdiIcons.remoteDesktop;
    final icon = server.icon;
    if (icon == null || !icon.startsWith('mdi')) return MdiIcons.server;
    return MdiIcons.fromString(icon.substring(3, 4).toLowerCase() + icon.substring(4)) ?? MdiIcons.server;
  }

  Color _parseColor(String c) {
    if (c.startsWith('#')) { try { return Color(int.parse('FF${c.substring(1)}', radix: 16)); } catch (_) {} }
    return Theme.of(context).colorScheme.primary;
  }
}
