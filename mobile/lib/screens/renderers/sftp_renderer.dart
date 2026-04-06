import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:http/http.dart' as http;

import '../../models/sftp_entry.dart';
import '../../services/api_config.dart';
import '../../services/session_manager.dart';
import '../../utils/api_client.dart';

class _SftpOps {
  static const int ready = 0x0;
  static const int listFiles = 0x1;
  static const int createFolder = 0x5;
  static const int deleteFile = 0x6;
  static const int deleteFolder = 0x7;
  static const int renameFile = 0x8;
  static const int error = 0x9;
}

class SftpRenderer extends StatefulWidget {
  final AppSession session;
  final String token;
  final VoidCallback? onDisconnected;

  const SftpRenderer({
    super.key,
    required this.session,
    required this.token,
    this.onDisconnected,
  });

  @override
  State<SftpRenderer> createState() => _SftpRendererState();
}

class _SftpRendererState extends State<SftpRenderer> {
  List<SftpEntry> _entries = [];
  String _currentPath = '/';
  final List<String> _history = ['/'];
  int _historyIndex = 0;
  bool _loading = true;
  bool _connected = false;
  String? _errorMessage;
  final Set<int> _selectedIndices = {};
  bool _selectionMode = false;
  bool _uploading = false;
  bool _initialized = false;

  String get _sessionId => widget.session.sessionId;

  String _remotePath(String name) =>
      _currentPath == '/' ? '/$name' : '$_currentPath/$name';

  @override
  void initState() {
    super.initState();
    _setupConnection();
  }

  void _setupConnection() {
    if (_initialized) return;
    _initialized = true;

    final channel = widget.session.sftpChannel;
    if (channel == null) {
      setState(() => _errorMessage = 'No SFTP channel available');
      return;
    }

    if (widget.session.sftpSubscription == null) {
      widget.session.sftpSubscription = channel.stream.listen(
        _processMessage,
        onError: (error) {
          if (mounted) {
            setState(() {
              _errorMessage = 'Connection error: $error';
              _connected = false;
            });
          }
          widget.session.isConnected = false;
          widget.onDisconnected?.call();
        },
        onDone: () {
          if (mounted) setState(() => _connected = false);
          widget.session.isConnected = false;
          widget.onDisconnected?.call();
        },
      );
    } else {
      _connected = widget.session.isConnected;
      if (_connected) {
        _listDirectory(_currentPath);
      }
    }
  }

  void _processMessage(dynamic data) {
    Uint8List bytes;
    if (data is Uint8List) {
      bytes = data;
    } else if (data is List<int>) {
      bytes = Uint8List.fromList(data);
    } else if (data is String) {
      bytes = Uint8List.fromList(data.codeUnits);
    } else {
      return;
    }
    if (bytes.isEmpty) return;

    final operation = bytes[0];
    String jsonPayload = '';
    if (bytes.length > 1) {
      jsonPayload = utf8.decode(bytes.sublist(1));
    }

    switch (operation) {
      case _SftpOps.ready:
        if (mounted) setState(() => _connected = true);
        widget.session.isConnected = true;
        _listDirectory(_currentPath);
        break;
      case _SftpOps.listFiles:
        _handleDirectoryListed(jsonPayload);
        break;
      case _SftpOps.error:
        try {
          final decoded = json.decode(jsonPayload);
          if (mounted) {
            setState(() {
              _errorMessage = decoded['message'] ?? 'Unknown error';
              _loading = false;
            });
          }
        } catch (_) {
          if (mounted) {
            setState(() {
              _errorMessage = jsonPayload.isNotEmpty ? jsonPayload : 'Unknown error';
              _loading = false;
            });
          }
        }
        break;
      default:
        _listDirectory(_currentPath);
        break;
    }
  }

  void _handleDirectoryListed(String jsonPayload) {
    if (!mounted) return;
    try {
      final decoded = json.decode(jsonPayload);
      final List<dynamic> files =
          decoded is List ? decoded : (decoded['files'] ?? []);
      final entries = files
          .map((e) => SftpEntry.fromJson(e as Map<String, dynamic>))
          .toList();
      entries.sort((a, b) {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });
      setState(() {
        _entries = entries;
        _loading = false;
        _selectedIndices.clear();
        _selectionMode = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to parse directory listing: $e';
        _loading = false;
      });
    }
  }

  void _sendOperation(int operation, Map<String, dynamic> payload) {
    final channel = widget.session.sftpChannel;
    if (channel == null) return;
    final jsonStr = json.encode(payload);
    final jsonBytes = utf8.encode(jsonStr);
    final message = Uint8List(1 + jsonBytes.length);
    message[0] = operation;
    message.setRange(1, message.length, jsonBytes);
    channel.sink.add(message);
  }

  void _listDirectory(String path) {
    setState(() => _loading = true);
    _sendOperation(_SftpOps.listFiles, {'path': path});
  }

  void _navigateTo(String path) {
    setState(() {
      _currentPath = path;
      _errorMessage = null;
      if (_historyIndex < _history.length - 1) {
        _history.removeRange(_historyIndex + 1, _history.length);
      }
      _history.add(path);
      _historyIndex = _history.length - 1;
    });
    _listDirectory(path);
  }

  void _goBack() {
    if (_historyIndex > 0) {
      _historyIndex--;
      final path = _history[_historyIndex];
      setState(() => _currentPath = path);
      _listDirectory(path);
    }
  }

  void _goUp() {
    if (_currentPath == '/') return;
    final parts = _currentPath.split('/');
    parts.removeLast();
    final parent = parts.isEmpty ? '/' : parts.join('/');
    _navigateTo(parent.isEmpty ? '/' : parent);
  }

  void _onEntryTap(SftpEntry entry, int index) {
    if (_selectionMode) {
      setState(() {
        if (_selectedIndices.contains(index)) {
          _selectedIndices.remove(index);
          if (_selectedIndices.isEmpty) _selectionMode = false;
        } else {
          _selectedIndices.add(index);
        }
      });
      return;
    }
    if (entry.isDir) {
      final newPath = _currentPath == '/'
          ? '/${entry.name}'
          : '$_currentPath/${entry.name}';
      _navigateTo(newPath);
    }
  }

  void _onEntryLongPress(int index) {
    setState(() {
      _selectionMode = true;
      _selectedIndices.add(index);
    });
  }

  void _refresh() => _listDirectory(_currentPath);

  void _showRenameDialog(SftpEntry entry) {
    final controller = TextEditingController(text: entry.name);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'New name',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final newName = controller.text.trim();
              if (newName.isNotEmpty && newName != entry.name) {
                _sendOperation(_SftpOps.renameFile, {
                  'path': _remotePath(entry.name),
                  'newPath': _remotePath(newName),
                });
              }
              Navigator.pop(ctx);
            },
            child: const Text('Rename'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(List<SftpEntry> entries) {
    final count = entries.length;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete'),
        content: Text(count == 1
            ? 'Delete "${entries.first.name}"?'
            : 'Delete $count items?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () {
              for (final entry in entries) {
                final path = _remotePath(entry.name);
                _sendOperation(
                  entry.isDir ? _SftpOps.deleteFolder : _SftpOps.deleteFile,
                  {'path': path},
                );
              }
              Navigator.pop(ctx);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showCreateFolderDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Folder'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Folder name',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final name = controller.text.trim();
              if (name.isNotEmpty) {
                _sendOperation(_SftpOps.createFolder, {'path': _remotePath(name)});
              }
              Navigator.pop(ctx);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  Future<void> _uploadFile() async {
    final result = await FilePicker.platform.pickFiles(allowMultiple: true);
    if (result == null || result.files.isEmpty) return;

    setState(() => _uploading = true);
    int uploaded = 0, failed = 0;

    for (final pickedFile in result.files) {
      if (pickedFile.path == null) { failed++; continue; }
      final file = File(pickedFile.path!);
      final remotePath = _remotePath(pickedFile.name);

      try {
        final uploadUrl = Uri.parse(
          '${ApiConfig.baseUrl}/entries/sftp/upload'
          '?sessionId=$_sessionId'
          '&path=${Uri.encodeComponent(remotePath)}'
          '&sessionToken=${Uri.encodeComponent(widget.token)}',
        );

        final request = http.StreamedRequest('POST', uploadUrl);
        request.headers['User-Agent'] = ApiClient.userAgent;
        request.contentLength = await file.length();
        file.openRead().listen(
          request.sink.add,
          onDone: request.sink.close,
          onError: (e) => request.sink.close(),
        );

        final response = await request.send();
        if (response.statusCode == 200 || response.statusCode == 201) {
          uploaded++;
        } else {
          failed++;
        }
      } catch (_) {
        failed++;
      }
    }

    if (mounted) {
      final msg = failed == 0
          ? 'Uploaded $uploaded file${uploaded != 1 ? 's' : ''}'
          : 'Uploaded $uploaded, failed $failed';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      setState(() => _uploading = false);
      _refresh();
    }
  }

  Future<http.Response?> _fetchFile(String remotePath) async {
    final url = Uri.parse(
      '${ApiConfig.baseUrl}/entries/sftp'
      '?sessionId=$_sessionId'
      '&path=${Uri.encodeComponent(remotePath)}'
      '&sessionToken=${Uri.encodeComponent(widget.token)}',
    );
    return http.get(url, headers: {'User-Agent': ApiClient.userAgent});
  }

  Future<void> _downloadFile(SftpEntry entry) async {
    setState(() => _uploading = true);
    try {
      final response = await _fetchFile(_remotePath(entry.name));
      if (response == null || response.statusCode != 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Download failed: ${response?.statusCode}')),
          );
        }
        return;
      }
      final cacheDir = await getTemporaryDirectory();
      final file = await File('${cacheDir.path}/${entry.name}')
          .writeAsBytes(response.bodyBytes);
      if (mounted) {
        await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _downloadMultiple(List<SftpEntry> entries) async {
    final fileEntries = entries.where((e) => !e.isDir).toList();
    if (fileEntries.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No files selected for download')),
        );
      }
      return;
    }

    setState(() => _uploading = true);
    final cacheDir = await getTemporaryDirectory();
    final xFiles = <XFile>[];
    int failed = 0;

    for (final entry in fileEntries) {
      try {
        final response = await _fetchFile(_remotePath(entry.name));
        if (response != null && response.statusCode == 200) {
          final file = await File('${cacheDir.path}/${entry.name}')
              .writeAsBytes(response.bodyBytes);
          xFiles.add(XFile(file.path));
        } else {
          failed++;
        }
      } catch (_) {
        failed++;
      }
    }

    if (mounted && xFiles.isNotEmpty) {
      await SharePlus.instance.share(ShareParams(files: xFiles));
    }
    if (mounted) {
      if (failed > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${xFiles.length} ready, $failed failed')),
        );
      }
      setState(() => _uploading = false);
    }
  }

  void _cancelSelection() {
    setState(() {
      _selectedIndices.clear();
      _selectionMode = false;
    });
  }

  void _deleteSelected() {
    final entries = _selectedIndices.map((i) => _entries[i]).toList();
    _showDeleteConfirmation(entries);
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: _selectionMode
              ? _buildWithSelectionBar()
              : _buildMainContent(),
        ),
        if (!_selectionMode && _connected)
          Positioned(
            right: 16,
            bottom: 16,
            child: FloatingActionButton(
              onPressed: _showAddMenu,
              child: Icon(MdiIcons.plus),
            ),
          ),
      ],
    );
  }

  Widget _buildMainContent() {
    return Column(
      children: [
        SizedBox(height: MediaQuery.of(context).padding.top),
        _buildHeader(),
        _buildPathBar(),
        if (_errorMessage != null) _buildErrorBanner(),
        if (_uploading) const LinearProgressIndicator(),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildWithSelectionBar() {
    return Column(
      children: [
        SizedBox(height: MediaQuery.of(context).padding.top),
        _buildSelectionBar(),
        _buildPathBar(),
        if (_errorMessage != null) _buildErrorBanner(),
        if (_uploading) const LinearProgressIndicator(),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildHeader() {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(bottom: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Row(
        children: [
          Icon(MdiIcons.folderOutline, color: cs.primary, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.session.server.name,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (_connected)
            IconButton(
              icon: Icon(MdiIcons.refresh, size: 20),
              onPressed: _refresh,
              visualDensity: VisualDensity.compact,
              tooltip: 'Refresh',
            ),
        ],
      ),
    );
  }

  Widget _buildSelectionBar() {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: cs.primaryContainer,
        border: Border(bottom: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Row(
        children: [
          IconButton(icon: Icon(MdiIcons.close), onPressed: _cancelSelection),
          Text('${_selectedIndices.length} selected',
              style: TextStyle(fontWeight: FontWeight.w600, color: cs.onPrimaryContainer)),
          const Spacer(),
          IconButton(
            icon: Icon(MdiIcons.downloadOutline),
            onPressed: _selectedIndices.isNotEmpty
                ? () {
                    final entries = _selectedIndices.map((i) => _entries[i]).toList();
                    _downloadMultiple(entries);
                    _cancelSelection();
                  }
                : null,
            tooltip: 'Download',
          ),
          IconButton(
            icon: Icon(MdiIcons.pencilOutline),
            onPressed: _selectedIndices.length == 1
                ? () => _showRenameDialog(_entries[_selectedIndices.first])
                : null,
            tooltip: 'Rename',
          ),
          IconButton(
            icon: Icon(MdiIcons.deleteOutline),
            onPressed: _selectedIndices.isNotEmpty ? _deleteSelected : null,
            tooltip: 'Delete',
            color: cs.error,
          ),
        ],
      ),
    );
  }

  Widget _buildPathBar() {
    final theme = Theme.of(context);
    final segments = _currentPath.split('/').where((s) => s.isNotEmpty).toList();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        border: Border(
          bottom: BorderSide(color: theme.colorScheme.outlineVariant, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(MdiIcons.arrowLeft, size: 20),
            onPressed: _historyIndex > 0 ? _goBack : null,
            visualDensity: VisualDensity.compact,
            tooltip: 'Back',
          ),
          IconButton(
            icon: Icon(MdiIcons.arrowUp, size: 20),
            onPressed: _currentPath != '/' ? _goUp : null,
            visualDensity: VisualDensity.compact,
            tooltip: 'Up',
          ),
          const SizedBox(width: 4),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              reverse: true,
              child: Row(
                children: [
                  _buildBreadcrumb('/', '/'),
                  for (int i = 0; i < segments.length; i++) ...[
                    Icon(MdiIcons.chevronRight, size: 16, color: theme.colorScheme.outline),
                    _buildBreadcrumb(
                      segments[i],
                      '/${segments.sublist(0, i + 1).join('/')}',
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreadcrumb(String label, String path) {
    final isActive = path == _currentPath;
    final theme = Theme.of(context);
    return InkWell(
      onTap: isActive ? null : () => _navigateTo(path),
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        child: Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: isActive ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      color: Theme.of(context).colorScheme.errorContainer,
      child: Row(
        children: [
          Icon(MdiIcons.alertCircleOutline,
              color: Theme.of(context).colorScheme.onErrorContainer, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMessage!,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                  fontSize: 13),
            ),
          ),
          IconButton(
            icon: Icon(MdiIcons.close, size: 18),
            onPressed: () => setState(() => _errorMessage = null),
            color: Theme.of(context).colorScheme.onErrorContainer,
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (!_connected && _loading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text('Connecting to ${widget.session.server.name}...',
                style: Theme.of(context).textTheme.bodyLarge),
          ],
        ),
      );
    }

    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_entries.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(MdiIcons.folderOpen,
                size: 64, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text('Empty directory',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => _refresh(),
      child: ListView.builder(
        itemCount: _entries.length,
        itemBuilder: (ctx, index) => _buildEntryTile(index),
      ),
    );
  }

  Widget _buildEntryTile(int index) {
    final entry = _entries[index];
    final theme = Theme.of(context);
    final isSelected = _selectedIndices.contains(index);

    return Material(
      color: isSelected
          ? theme.colorScheme.primaryContainer.withValues(alpha: 0.3)
          : Colors.transparent,
      child: InkWell(
        onTap: () => _onEntryTap(entry, index),
        onLongPress: () => _onEntryLongPress(index),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              if (_selectionMode)
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: Icon(
                    isSelected ? MdiIcons.checkboxMarked : MdiIcons.checkboxBlankOutline,
                    color: isSelected ? theme.colorScheme.primary : theme.colorScheme.outline,
                    size: 22,
                  ),
                ),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _getFileIconColor(entry, theme).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _getFileIcon(entry),
                  color: _getFileIconColor(entry, theme),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(entry.name,
                        style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (!entry.isDir) entry.formattedSize,
                        if (entry.mtime > 0) _formatDate(entry.modifiedDate),
                      ].join(' • '),
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ],
                ),
              ),
              if (!_selectionMode)
                IconButton(
                  icon: Icon(MdiIcons.dotsVertical, color: theme.colorScheme.outline, size: 20),
                  onPressed: () => _showEntryActions(entry),
                  visualDensity: VisualDensity.compact,
                ),
              if (!_selectionMode && entry.isDir)
                Icon(MdiIcons.chevronRight, color: theme.colorScheme.outline, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  void _showEntryActions(SftpEntry entry) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Theme.of(ctx).colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Icon(_getFileIcon(entry),
                    color: entry.isDir
                        ? Theme.of(ctx).colorScheme.primary
                        : Theme.of(ctx).colorScheme.onSurfaceVariant,
                    size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(entry.name,
                          style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis),
                      if (!entry.isDir)
                        Text(entry.formattedSize,
                            style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                                color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ]),
            ),
            const Divider(height: 1),
            if (!entry.isDir)
              ListTile(
                leading: Icon(MdiIcons.downloadOutline),
                title: const Text('Download'),
                onTap: () { Navigator.pop(ctx); _downloadFile(entry); },
              ),
            ListTile(
              leading: Icon(MdiIcons.pencilOutline),
              title: const Text('Rename'),
              onTap: () { Navigator.pop(ctx); _showRenameDialog(entry); },
            ),
            ListTile(
              leading: Icon(MdiIcons.deleteOutline, color: Theme.of(ctx).colorScheme.error),
              title: Text('Delete', style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
              onTap: () { Navigator.pop(ctx); _showDeleteConfirmation([entry]); },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showAddMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Theme.of(ctx).colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(MdiIcons.folderPlusOutline),
              title: const Text('New Folder'),
              onTap: () { Navigator.pop(ctx); _showCreateFolderDialog(); },
            ),
            ListTile(
              leading: Icon(MdiIcons.uploadOutline),
              title: const Text('Upload File'),
              onTap: () { Navigator.pop(ctx); _uploadFile(); },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  IconData _getFileIcon(SftpEntry entry) {
    if (entry.isDir) return MdiIcons.folder;
    if (entry.isSymlink) return MdiIcons.linkVariant;
    switch (entry.extension) {
      case 'txt': case 'md': case 'log': return MdiIcons.fileDocumentOutline;
      case 'pdf': return MdiIcons.filePdfBox;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg':
        return MdiIcons.fileImageOutline;
      case 'mp4': case 'avi': case 'mov': case 'mkv': return MdiIcons.fileVideoOutline;
      case 'mp3': case 'wav': case 'flac': case 'ogg': return MdiIcons.fileMusicOutline;
      case 'zip': case 'tar': case 'gz': case 'bz2': case 'xz': case '7z': case 'rar':
        return MdiIcons.zipBoxOutline;
      case 'json': case 'xml': case 'yaml': case 'yml': case 'toml': return MdiIcons.codeJson;
      case 'js': case 'ts': case 'py': case 'dart': case 'java': case 'c': case 'cpp':
      case 'h': case 'rs': case 'go': case 'rb': case 'php': case 'sh': case 'bash':
        return MdiIcons.fileCodeOutline;
      case 'conf': case 'cfg': case 'ini': case 'env': return MdiIcons.fileCogOutline;
      case 'db': case 'sqlite': case 'sql': return MdiIcons.databaseOutline;
      default: return MdiIcons.fileOutline;
    }
  }

  Color _getFileIconColor(SftpEntry entry, ThemeData theme) {
    if (entry.isDir) return theme.colorScheme.primary;
    if (entry.isSymlink) return theme.colorScheme.tertiary;
    switch (entry.extension) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg':
        return Colors.pink;
      case 'mp4': case 'avi': case 'mov': case 'mkv': return Colors.purple;
      case 'mp3': case 'wav': case 'flac': case 'ogg': return Colors.orange;
      case 'zip': case 'tar': case 'gz': case '7z': case 'rar': return Colors.amber;
      case 'pdf': return Colors.red;
      default: return theme.colorScheme.onSurfaceVariant;
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.day}/${date.month}/${date.year}';
  }
}
