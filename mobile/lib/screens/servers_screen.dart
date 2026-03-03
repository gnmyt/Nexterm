import 'dart:async';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/server.dart';
import '../models/server_folder.dart';
import '../services/server_service.dart';
import '../utils/auth_manager.dart';
import '../utils/snippet_manager.dart';
import '../utils/folder_state_manager.dart';
import 'terminal_screen.dart';

class ServersScreen extends StatefulWidget {
  final AuthManager authManager;
  final SnippetManager snippetManager;

  const ServersScreen({super.key, required this.authManager, required this.snippetManager});

  @override
  State<ServersScreen> createState() => _ServersScreenState();
}

class _ServersScreenState extends State<ServersScreen> {
  List<ServerFolder> folders = [];
  List<ServerFolder> filteredFolders = [];
  bool isLoading = true;
  String? errorMessage;
  FolderStateManager? _folderStateManager;
  final Set<dynamic> _expandedFolderIds = <dynamic>{};
  final _searchController = TextEditingController();
  String _searchQuery = '';
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _initStateManager();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() { _searchQuery = _searchController.text; _filterFolders(); });
    });
  }

  Future<void> _initStateManager() async {
    _folderStateManager = await FolderStateManager.create();
    await _loadData();
  }

  Future<void> _loadData() async {
    try {
      await Future.delayed(const Duration(milliseconds: 100));
      final token = widget.authManager.sessionToken;
      if (token == null) {
        setState(() { errorMessage = 'Not authenticated'; isLoading = false; });
        return;
      }
      final data = await ServerService.getServerList(token);
      _expandedFolderIds.clear();
      if (_folderStateManager != null) _restoreExpansionStates(data);
      setState(() { folders = data; isLoading = false; errorMessage = null; });
      _filterFolders();
    } catch (e) {
      setState(() { errorMessage = 'Failed to load servers: $e'; isLoading = false; });
    }
  }

  void _filterFolders() {
    if (_searchQuery.isEmpty) {
      filteredFolders = List.from(folders);
    } else {
      filteredFolders = folders.map(_filterFolder).whereType<ServerFolder>().toList();
    }
  }

  ServerFolder? _filterFolder(ServerFolder folder) {
    final q = _searchQuery.toLowerCase();
    final folderMatches = folder.name.toLowerCase().contains(q);
    final matchingServers = folder.allServers.where((s) => s.name.toLowerCase().contains(q) || s.ip.toLowerCase().contains(q)).toList();
    final matchingSubfolders = folder.allFolders.map(_filterFolder).whereType<ServerFolder>().toList();

    if (folderMatches || matchingServers.isNotEmpty || matchingSubfolders.isNotEmpty) {
      return ServerFolder(
        id: folder.id, name: folder.name, type: folder.type, position: folder.position,
        organizationId: folder.organizationId, requireConnectionReason: folder.requireConnectionReason,
        entries: [...matchingServers.map((s) => s.toJson()), ...matchingSubfolders.map((f) => f.toJson())],
        ip: folder.ip, icon: folder.icon, folderType: folder.folderType,
      );
    }
    return null;
  }

  Future<void> _refreshData() async {
    try {
      final token = widget.authManager.sessionToken;
      if (token == null) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Not authenticated')));
        return;
      }
      final data = await ServerService.getServerList(token);
      _expandedFolderIds.clear();
      if (_folderStateManager != null) _restoreExpansionStates(data);
      setState(() { folders = data; errorMessage = null; });
      _filterFolders();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to refresh: $e')));
    }
  }

  void _restoreExpansionStates(List<ServerFolder> list) {
    for (final f in list) {
      if (_folderStateManager != null && f.id != null && _folderStateManager!.isFolderExpanded(f.id)) {
        _expandedFolderIds.add(f.id);
      }
      if (f.allFolders.isNotEmpty) _restoreExpansionStates(f.allFolders);
    }
  }

  Future<void> _toggleFolder(dynamic id) async {
    _expandedFolderIds.contains(id) ? _expandedFolderIds.remove(id) : _expandedFolderIds.add(id);
    if (_folderStateManager != null && id != null) await _folderStateManager!.setFolderExpanded(id, _expandedFolderIds.contains(id));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nexterm'), elevation: 0),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search servers...',
              prefixIcon: Icon(MdiIcons.magnify),
              suffixIcon: _searchQuery.isNotEmpty ? IconButton(icon: Icon(MdiIcons.close), onPressed: () => _searchController.clear()) : null,
              filled: true,
              fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
        Expanded(
          child: isLoading
              ? const Center(child: CircularProgressIndicator())
              : errorMessage != null ? _buildErrorState() : filteredFolders.isEmpty ? _buildEmptyState() : _buildServerList(),
        ),
      ]),
    );
  }

  Widget _buildErrorState() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(MdiIcons.alertCircleOutline, size: 48, color: Theme.of(context).colorScheme.error),
        const SizedBox(height: 16),
        Text(errorMessage!, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
        const SizedBox(height: 24),
        FilledButton.icon(onPressed: _loadData, icon: Icon(MdiIcons.refresh), label: const Text('Retry')),
      ]),
    ),
  );

  Widget _buildEmptyState() => RefreshIndicator(
    onRefresh: _refreshData,
    child: ListView(children: [
      SizedBox(
        height: MediaQuery.of(context).size.height * 0.6,
        child: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(MdiIcons.server, size: 48, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 16),
            Text(_searchQuery.isEmpty ? 'No servers found' : 'No servers match your search',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.outline)),
          ]),
        ),
      ),
    ]),
  );

  Widget _buildServerList() => RefreshIndicator(
    onRefresh: _refreshData,
    child: ListView.builder(
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 16),
      itemCount: filteredFolders.length,
      itemBuilder: (_, i) => _buildEntry(filteredFolders[i], 0),
    ),
  );

  Widget _buildEntry(dynamic entry, int depth) {
    if (entry is ServerFolder) return _buildFolderTile(entry, depth);
    if (entry is Server) return _buildServerTile(entry, depth);
    return const SizedBox.shrink();
  }

  Widget _buildFolderTile(ServerFolder folder, int depth) {
    final hasEntries = folder.entries.isNotEmpty;
    final isExpanded = _expandedFolderIds.contains(folder.id);
    final theme = Theme.of(context);

    IconData folderIcon;
    Color iconColor;
    if (folder.isOrganization) {
      folderIcon = isExpanded ? MdiIcons.domain : MdiIcons.domainOff;
      iconColor = theme.colorScheme.primary;
    } else if (folder.isPveNode) {
      folderIcon = MdiIcons.server;
      iconColor = theme.colorScheme.tertiary;
    } else {
      folderIcon = isExpanded ? MdiIcons.folderOpen : MdiIcons.folder;
      iconColor = theme.colorScheme.primary;
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: hasEntries ? () => _toggleFolder(folder.id) : null,
          child: Padding(
            padding: EdgeInsets.only(left: 16 + (depth * 20), right: 16, top: 12, bottom: 12),
            child: Row(children: [
              Icon(folderIcon, color: iconColor, size: 22),
              const SizedBox(width: 12),
              Expanded(child: Text(folder.name, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
              if (hasEntries) Icon(isExpanded ? MdiIcons.chevronUp : MdiIcons.chevronDown, color: theme.colorScheme.outline, size: 22),
            ]),
          ),
        ),
      ),
      if (isExpanded && hasEntries) ...[
        for (final s in folder.allServers) _buildServerTile(s, depth + 1),
        for (final f in folder.allFolders) _buildFolderTile(f, depth + 1),
      ],
    ]);
  }

  Widget _buildServerTile(Server server, int depth) {
    final theme = Theme.of(context);
    final isPve = server.isPve;
    final isOffline = server.isStopped;
    final icon = _getServerIcon(server);

    final (bgColor, fgColor) = isPve
        ? (isOffline ? (theme.colorScheme.surfaceContainerHighest, theme.colorScheme.outline) : (theme.colorScheme.tertiaryContainer, theme.colorScheme.onTertiaryContainer))
        : (isOffline ? (theme.colorScheme.surfaceContainerHighest, theme.colorScheme.outline) : (theme.colorScheme.primaryContainer, theme.colorScheme.onPrimaryContainer));

    String? subtitle;
    if (isPve && server.status != null) {
      subtitle = server.ip.isNotEmpty && server.ip != 'N/A' ? '${server.status} • ${server.ip}' : server.status;
    } else if (server.ip.isNotEmpty && server.ip != 'N/A') {
      subtitle = server.ip;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _connectToServer(server),
        child: Padding(
          padding: EdgeInsets.only(left: 16 + (depth * 20), right: 16, top: 10, bottom: 10),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: fgColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(server.name, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
              if (subtitle != null) ...[const SizedBox(height: 2), Text(subtitle, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline), overflow: TextOverflow.ellipsis)],
            ])),
            if (server.tags?.isNotEmpty == true)
              Row(mainAxisSize: MainAxisSize.min, children: server.tags!.take(3).map((t) => Container(
                width: 8, height: 8, margin: const EdgeInsets.only(left: 4),
                decoration: BoxDecoration(color: _parseColor(t.color), shape: BoxShape.circle),
              )).toList()),
            const SizedBox(width: 8),
            Icon(MdiIcons.chevronRight, color: theme.colorScheme.outline, size: 20),
          ]),
        ),
      ),
    );
  }

  void _connectToServer(Server server) {
    if (server.isStopped) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${server.name} is ${server.isPve ? "not running" : "offline"}'), behavior: SnackBarBehavior.floating));
      return;
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => TerminalScreen(server: server, authManager: widget.authManager, snippetManager: widget.snippetManager)));
  }

  IconData _getServerIcon(Server server) {
    if (server.type == 'pve-lxc') return MdiIcons.cubeOutline;
    if (server.type == 'pve-qemu') return MdiIcons.monitor;
    if (server.type == 'pve-shell') return MdiIcons.console;
    final icon = server.icon;
    if (icon == null || !icon.startsWith('mdi')) return MdiIcons.server;
    final camelName = icon.substring(3, 4).toLowerCase() + icon.substring(4);
    return MdiIcons.fromString(camelName) ?? MdiIcons.server;
  }

  Color _parseColor(String c) {
    if (c.startsWith('#')) {
      try { return Color(int.parse('FF${c.substring(1)}', radix: 16)); } catch (_) {}
    }
    return Theme.of(context).colorScheme.primary;
  }
}
