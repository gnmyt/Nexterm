import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_file_dialog/flutter_file_dialog.dart';
import 'package:flutter_material_design_icons/flutter_material_design_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../widgets/connection_loader.dart';
import 'package:http/http.dart' as http;

import '../../models/sftp_entry.dart';
import '../../services/api_config.dart';
import '../../services/connection_service.dart';
import '../../services/session_manager.dart';
import '../../utils/api_client.dart';
import '../../utils/sftp_edit.dart';
import '../../utils/sftp_settings.dart';

class _SftpOps {
  static const int ready = 0x0;
  static const int listFiles = 0x1;
  static const int createFolder = 0x5;
  static const int deleteFile = 0x6;
  static const int deleteFolder = 0x7;
  static const int renameFile = 0x8;
  static const int error = 0x9;
  static const int pathSync = 0x12;
}

class _PendingEdit {
  final String sessionId;
  final String remotePath;
  final String tempPath;
  final String fileName;
  final int size;
  final int mtimeMs;
  final String hash;

  const _PendingEdit({
    required this.sessionId,
    required this.remotePath,
    required this.tempPath,
    required this.fileName,
    required this.size,
    required this.mtimeMs,
    required this.hash,
  });
}

class SftpRenderer extends StatefulWidget {
  final AppSession session;
  final String token;
  final SessionManager sessionManager;
  final SftpSettings sftpSettings;
  final VoidCallback? onDisconnected;

  const SftpRenderer({
    super.key,
    required this.session,
    required this.token,
    required this.sessionManager,
    required this.sftpSettings,
    this.onDisconnected,
  });

  @override
  State<SftpRenderer> createState() => _SftpRendererState();
}

class _SftpRendererState extends State<SftpRenderer> with WidgetsBindingObserver {
  static const int _maxOpenBytes = 25 * 1024 * 1024;
  static const MethodChannel _editChannel = MethodChannel('nexterm/edit');
  List<SftpEntry> _entries = [];
  String _currentPath = '/';
  String _rootPath = '/';
  List<String> _history = ['/'];
  int _historyIndex = 0;
  bool _loading = true;
  bool _connected = false;
  String? _errorMessage;
  final Set<int> _selectedIndices = {};
  bool _selectionMode = false;
  bool _uploading = false;
  bool _initialized = false;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  int _aliveResets = 0;
  static const int _maxAliveResets = 3;
  int _pickerDepth = 0;
  bool _reconnectActive = false;
  bool _quietLoop = false;
  bool _connectionLostWhilePicking = false;
  bool _quietReadyOnce = false;
  final Map<String, _PendingEdit> _pendingEdits = {};
  final Set<String> _openingPaths = {};
  final Set<String> _uploadingPaths = {};
  int _activeUploads = 0;
  int _busyCount = 0;

  String _upKey(String sessionId, String remotePath) => '$sessionId|$remotePath';

  void _setBusy(bool busy) {
    if (!mounted) return;
    setState(() {
      _busyCount += busy ? 1 : -1;
      if (_busyCount < 0) _busyCount = 0;
      _uploading = _busyCount > 0;
    });
  }
  final ScrollController _scrollController = ScrollController();

  bool get _pickerOpen => _pickerDepth > 0;

  void _enterPicker() {
    _pickerDepth++;
  }

  void _exitPicker() {
    if (_pickerDepth > 0) _pickerDepth--;
  }

  bool _lastShowHiddenFiles = false;
  bool _lastSortFoldersFirst = true;

  String get _sessionId => widget.session.sessionId;

  String _normalizeRoot(String path) =>
      path == '/' || RegExp(r'^[a-z]:/$', caseSensitive: false).hasMatch(path)
          ? path
          : path.replaceFirst(RegExp(r'/$'), '');

  List<String> _pathSegments([String? path]) {
    final value = path ?? _currentPath;
    final root = _normalizeRoot(_rootPath);
    final prefix = root.endsWith('/') ? root : '$root/';
    final relative = root != '/' && (value == root || value.startsWith(prefix))
        ? value.substring(root.length).replaceFirst(RegExp(r'^/'), '')
        : value;
    return relative.split('/').where((part) => part.isNotEmpty).toList();
  }

  String _joinPath(List<String> segments) {
    final root = _normalizeRoot(_rootPath);
    if (segments.isEmpty) return root;
    if (root == '/') return '/${segments.join('/')}';
    final prefix = root.endsWith('/') ? root : '$root/';
    return '$prefix${segments.join('/')}';
  }

  String _remotePath(String name) {
    return _remotePathIn(_currentPath, name);
  }

  String _remotePathIn(String base, String name) {
    final b = base.endsWith('/') ? base : '$base/';
    return '$b$name';
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_sweepStaleEditTemps());
    _currentPath = widget.session.sftpPath ?? '/';
    _rootPath = widget.session.sftpRootPath ?? '/';
    _lastShowHiddenFiles = widget.sftpSettings.showHiddenFiles;
    _lastSortFoldersFirst = widget.sftpSettings.sortFoldersFirst;
    widget.sftpSettings.addListener(_onSftpSettingsChanged);
    _setupConnection();
  }

  void _setupConnection() {
    if (_initialized) return;
    _initialized = true;

    final channel = widget.session.sftpChannel;
    if (channel == null) {
      setState(() {
        _errorMessage = 'No SFTP channel available';
        _loading = false;
        _connected = false;
        _listBusyQueue.clear();
      });
      return;
    }

    if (widget.session.sftpSubscription == null) {
      widget.session.sftpSubscription = channel.stream.listen(
        _processMessage,
        onError: (error) {
          if (_pickerOpen) {
            _connectionLostWhilePicking = true;
            _listBusyQueue.clear();
            if (mounted) {
              setState(() {});
            }
            return;
          }
          if (mounted) {
            setState(() {
              _errorMessage = 'Connection error: $error';
              _connected = false;
              _listBusyQueue.clear();
            });
          }
          widget.session.isConnected = false;
          _attemptReconnect();
        },
        onDone: () {
          if (_pickerOpen) {
            _connectionLostWhilePicking = true;
            _listBusyQueue.clear();
            if (mounted) {
              setState(() {});
            }
            return;
          }
          if (mounted) {
            setState(() {
              _connected = false;
              _listBusyQueue.clear();
            });
          }
          widget.session.isConnected = false;
          _attemptReconnect();
        },
      );
    } else {
      _connected = widget.session.isConnected;
      if (_connected) {
        _listDirectory(_currentPath, keepOffset: true);
      } else {
        _attemptReconnect();
      }
    }
  }

  Future<void> _attemptReconnect({bool quiet = false}) async {
    if (_reconnectActive) return;
    _quietLoop = quiet;
    _reconnectActive = true;
    try {
      while (mounted) {
        try {
          if (_pickerOpen) {
            _connectionLostWhilePicking = true;
            _quietReadyOnce = false;
            return;
          }
          if (_reconnectAttempts >= _maxReconnectAttempts) {
            final alive = await _serverSessionAlive();
            if (!mounted) return;
            if (_pickerOpen) {
              _connectionLostWhilePicking = true;
              _quietReadyOnce = false;
              return;
            }
            if (alive && _aliveResets < _maxAliveResets) {
              _aliveResets++;
              _reconnectAttempts = 0;
            } else {
              _quietReadyOnce = false;
              widget.onDisconnected?.call();
              return;
            }
          }
          _reconnectAttempts++;
          final delay = Duration(seconds: _reconnectAttempts.clamp(1, 5));
          await Future.delayed(delay);
          if (!mounted) return;
          if (_pickerOpen) {
            _connectionLostWhilePicking = true;
            _quietReadyOnce = false;
            return;
          }
          if (await _reconnectNow()) return;
        } catch (_) {
          await Future.delayed(const Duration(seconds: 2));
        }
      }
    } catch (_) {
    } finally {
      _reconnectActive = false;
      _quietLoop = false;
    }
  }

  Future<bool> _reconnectNow() async {
    final quiet = _quietLoop;
    final success = await widget.sessionManager.reconnectSftpSession(
      token: widget.token,
      session: widget.session,
    );
    if (!mounted || !success) return false;
    _quietReadyOnce = quiet;
    _reconnectAttempts = 0;
    _aliveResets = 0;
    _initialized = false;
    try {
      await widget.session.sftpSubscription?.cancel();
    } catch (_) {}
    widget.session.sftpSubscription = null;
    setState(() {
      _errorMessage = null;
    });
    _setupConnection();
    return true;
  }

  Future<bool> _serverSessionAlive() async {
    try {
      final sessions = await ConnectionService.listSessions(token: widget.token)
          .timeout(const Duration(seconds: 10));
      return sessions.any((s) => s['sessionId'] == _sessionId);
    } catch (_) {
      return true;
    }
  }

  Future<void> _recoverAfterPicker() async {
    if (!mounted || _pickerOpen) return;
    if (!_connectionLostWhilePicking) return;
    _connectionLostWhilePicking = false;
    _attemptReconnect(quiet: true);
  }

  void _processMessage(dynamic data) {
    Uint8List bytes;
    if (data is Uint8List) {
      bytes = data;
    } else if (data is List<int>) {
      bytes = Uint8List.fromList(data);
    } else if (data is String) {
      bytes = Uint8List.fromList(utf8.encode(data));
    } else {
      return;
    }
    if (bytes.isEmpty) return;

    final operation = bytes[0];
    String jsonPayload = '';
    if (bytes.length > 1) {
      try {
        jsonPayload = utf8.decode(bytes.sublist(1));
      } catch (_) {
        return;
      }
    }

    switch (operation) {
      case _SftpOps.ready:
        Map<String, dynamic> ready = {};
        try {
          ready = json.decode(jsonPayload) as Map<String, dynamic>;
        } catch (_) {}
        final readyRoot = ready['rootPath'] is String ? ready['rootPath'] as String : '/';
        final readyPath = ready['path'] is String ? ready['path'] as String : readyRoot;
        final samePath = !mounted || readyPath == _currentPath;
        final quiet = _quietReadyOnce;
        _quietReadyOnce = false;
        if (mounted) {
          final newRoot = readyRoot;
          final initialPath = readyPath;
          setState(() {
            _connected = true;
            _errorMessage = null;
            _rootPath = newRoot;
            _currentPath = initialPath;
            widget.session.sftpPath = initialPath;
            widget.session.sftpRootPath = _rootPath;
            if (!quiet || !samePath) {
              _history = [initialPath];
              _historyIndex = 0;
            }
            _selectedIndices.clear();
            _selectionMode = false;
          });
        }
        widget.session.isConnected = true;
        _reconnectAttempts = 0;
        _listDirectory(readyPath, silent: quiet, keepOffset: samePath);
        break;
      case _SftpOps.listFiles:
        _handleDirectoryListed(jsonPayload);
        break;
      case _SftpOps.error:
        var listFailed = _listBusyQueue.isNotEmpty;
        try {
          final decoded = json.decode(jsonPayload);
          if (decoded is Map<String, dynamic> && decoded.containsKey('op')) {
            listFailed = (decoded['op'] as num?)?.toInt() == _SftpOps.listFiles;
          }
          if (mounted) {
            setState(() {
              _errorMessage = decoded is Map<String, dynamic>
                  ? decoded['message'] ?? 'Unknown error'
                  : 'Unknown error';
              if (listFailed) {
                _loading = false;
              }
            });
          }
        } catch (_) {
          listFailed = _listBusyQueue.isNotEmpty;
          if (mounted) {
            setState(() {
              _errorMessage = jsonPayload.isNotEmpty ? jsonPayload : 'Unknown error';
              if (listFailed) {
                _loading = false;
              }
            });
          }
        }
        if (listFailed) {
          _endListBusy();
        }
        break;
      case _SftpOps.pathSync:
        try {
          final payload = json.decode(jsonPayload) as Map<String, dynamic>;
          final path = payload['path'] as String?;
          if (path != null && path != _currentPath && mounted) {
            setState(() {
              _currentPath = path;
              widget.session.sftpPath = path;
              _history = [..._history.take(_historyIndex + 1), path];
              _historyIndex = _history.length - 1;
              _selectedIndices.clear();
              _selectionMode = false;
            });
            _listDirectory(path);
          }
        } catch (_) {}
        break;
      default:
        _listDirectory(_currentPath, silent: true);
        break;
    }
  }

  void _handleDirectoryListed(String jsonPayload) {
    if (!mounted) return;
    if (_currentPath != _lastRequestedPath) {
      _endListBusy();
      return;
    }
    try {
      final decoded = json.decode(jsonPayload);
      if (decoded is Map<String, dynamic>) {
        final echoed = decoded['path'];
        if (echoed is String &&
            echoed.isNotEmpty &&
            echoed != _currentPath) {
          _endListBusy();
          return;
        }
        final message = decoded['message'] ?? decoded['error'];
        if (message is String && message.isNotEmpty) {
          setState(() {
            _errorMessage = message;
            _loading = false;
          });
          _endListBusy();
          return;
        }
        if (!decoded.containsKey('files') &&
            (decoded.containsKey('message') || decoded.containsKey('error'))) {
          setState(() {
            _errorMessage = 'Failed to load directory';
            _loading = false;
          });
          _endListBusy();
          return;
        }
      }
      final List<dynamic> files =
          decoded is List ? decoded : (decoded['files'] ?? []);
      var entries = files
          .map((e) => SftpEntry.fromJson(e as Map<String, dynamic>))
          .toList();

      if (!widget.sftpSettings.showHiddenFiles) {
        entries = entries.where((e) => !e.name.startsWith('.')).toList();
      }

      entries.sort((a, b) {
        if (widget.sftpSettings.sortFoldersFirst) {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
        }
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });
      setState(() {
        _entries = entries;
        _loading = false;
        _errorMessage = null;
        _selectedIndices.clear();
        _selectionMode = false;
      });
      _endListBusy();
      if (_savedOffset != null) {
        final target = _savedOffset!;
        _savedOffset = null;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_scrollController.hasClients) return;
          final max = _scrollController.position.maxScrollExtent;
          if (max <= 0) return;
          _scrollController.jumpTo(target.clamp(0.0, max).toDouble());
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to parse directory listing: $e';
        _loading = false;
      });
      _endListBusy();
    }
  }

  void _sendOperation(int operation, Map<String, dynamic> payload) {
    final channel = widget.session.sftpChannel;
    if (channel == null) return;
    try {
      final jsonStr = json.encode(payload);
      final jsonBytes = utf8.encode(jsonStr);
      final message = Uint8List(1 + jsonBytes.length);
      message[0] = operation;
      message.setRange(1, message.length, jsonBytes);
      channel.sink.add(message);
    } catch (_) {}
  }

  String _lastRequestedPath = '/';
  double? _savedOffset;
  final List<bool> _listBusyQueue = [];

  void _endListBusy() {
    if (_listBusyQueue.isNotEmpty) {
      _listBusyQueue.removeAt(0);
    }
  }

  bool get _showProgress =>
      _uploading || _listBusyQueue.any((counted) => counted);

  void _listDirectory(String path, {bool silent = false, bool keepOffset = false}) {
    if (!mounted) return;
    if (widget.session.sftpChannel == null) {
      _lastRequestedPath = path;
      setState(() {
        _errorMessage = 'No SFTP channel available';
        _loading = false;
      });
      return;
    }
    _lastRequestedPath = path;
    if (_entries.isEmpty) {
      _savedOffset = null;
      _listBusyQueue.add(false);
      if (!silent) {
        setState(() => _loading = true);
      }
    } else {
      if (keepOffset && _scrollController.hasClients) {
        _savedOffset = _scrollController.offset;
      } else {
        _savedOffset = null;
      }
      _listBusyQueue.add(!silent);
    }
    _sendOperation(_SftpOps.listFiles, {'path': path});
  }

  void _navigateTo(String path) {
    setState(() {
      _currentPath = path;
      widget.session.sftpPath = path;
      _errorMessage = null;
      _selectedIndices.clear();
      _selectionMode = false;
      if (_historyIndex < _history.length - 1) {
        _history.removeRange(_historyIndex + 1, _history.length);
      }
      _history.add(path);
      _historyIndex = _history.length - 1;
    });
    _listDirectory(path);
    _sendOperation(_SftpOps.pathSync, {'path': path});
  }

  void _goBack() {
    if (_historyIndex > 0) {
      _historyIndex--;
      final path = _history[_historyIndex];
      setState(() {
        _currentPath = path;
        _selectedIndices.clear();
        _selectionMode = false;
      });
      widget.session.sftpPath = path;
      _listDirectory(path);
      _sendOperation(_SftpOps.pathSync, {'path': path});
    }
  }

  void _goUp() {
    final parts = _pathSegments();
    if (parts.isEmpty) return;
    parts.removeLast();
    _navigateTo(_joinPath(parts));
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
      final newPath = _remotePath(entry.name);
      _navigateTo(newPath);
    }
  }

  void _onEntryLongPress(int index) {
    setState(() {
      _selectionMode = true;
      _selectedIndices.add(index);
    });
  }

  void _refresh() => _listDirectory(_currentPath, silent: true, keepOffset: true);

  void _onSftpSettingsChanged() {
    final settings = widget.sftpSettings;
    if (settings.showHiddenFiles != _lastShowHiddenFiles ||
        settings.sortFoldersFirst != _lastSortFoldersFirst) {
      _lastShowHiddenFiles = settings.showHiddenFiles;
      _lastSortFoldersFirst = settings.sortFoldersFirst;
      _refresh();
    } else if (mounted) {
      setState(() {});
    }
  }

  void _showRenameDialog(SftpEntry entry, [String? base, String? sheetSid]) {
    final controller = TextEditingController(text: entry.name);
    final dialogBase = base ?? _currentPath;
    final dialogSid = sheetSid ?? _sessionId;
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
              Navigator.pop(ctx);
              if (newName.isEmpty || newName == entry.name) return;
              if (dialogSid != _sessionId) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Session changed, please retry')),
                );
                _refresh();
                return;
              }
              if (dialogBase != _currentPath) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Directory changed, please retry')),
                );
                _refresh();
                return;
              }
              final oldPath = _remotePathIn(dialogBase, entry.name);
              final newPath = _remotePathIn(dialogBase, newName);
              if (_hasUploadingFor(oldPath, dialogSid) || _hasUploadingFor(newPath, dialogSid)) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Upload in progress, please retry shortly')),
                );
                return;
              }
              _dropPendingFor(oldPath, dialogSid);
              _dropPendingFor(newPath, dialogSid);
              _sendOperation(_SftpOps.renameFile, {
                'path': oldPath,
                'newPath': newPath,
              });
            },
            child: const Text('Rename'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(List<SftpEntry> entries, [String? base, String? sheetSid]) {
    if (!widget.sftpSettings.confirmBeforeDelete) {
      _performDelete(entries, base, sheetSid);
      return;
    }
    final count = entries.length;
    final dialogBase = base ?? _currentPath;
    final dialogSid = sheetSid ?? _sessionId;
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
              Navigator.pop(ctx);
              _performDelete(entries, dialogBase, dialogSid);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _performDelete(List<SftpEntry> entries, [String? base, String? sheetSid]) {
    final snapshot = base ?? _currentPath;
    final actionSid = sheetSid ?? _sessionId;
    if (actionSid != _sessionId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session changed, please retry')),
      );
      _refresh();
      return;
    }
    if (base != null && base != _currentPath) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Directory changed, please retry')),
      );
      _refresh();
      return;
    }
    for (final entry in entries) {
      final path = _remotePathIn(snapshot, entry.name);
      if (_hasUploadingFor(path, actionSid)) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload in progress, please retry shortly')),
        );
        return;
      }
      if (_hasPendingFor(path, actionSid)) {
        _dropPendingFor(path, actionSid);
      }
    }
    for (final entry in entries) {
      final path = _remotePathIn(snapshot, entry.name);
      _dropPendingFor(path, actionSid);
      _sendOperation(
        entry.isDir ? _SftpOps.deleteFolder : _SftpOps.deleteFile,
        {'path': path},
      );
    }
  }

  void _showCreateFolderDialog([String? base, String? sheetSid]) {
    final controller = TextEditingController();
    final dialogBase = base ?? _currentPath;
    final dialogSid = sheetSid ?? _sessionId;
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
              Navigator.pop(ctx);
              if (name.isEmpty) return;
              if (dialogSid != _sessionId) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Session changed, please retry')),
                );
                _refresh();
                return;
              }
              if (dialogBase != _currentPath) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Directory changed, please retry')),
                );
                _refresh();
                return;
              }
              final target = _remotePathIn(dialogBase, name);
              if (_hasUploadingFor(target, dialogSid)) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Upload in progress, please retry shortly')),
                );
                return;
              }
              if (_hasPendingFor(target, dialogSid)) {
                _dropPendingFor(target, dialogSid);
              }
              _sendOperation(_SftpOps.createFolder, {'path': target});
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  Future<void> _uploadFile([String? base, String? sheetSid]) async {
    final pickBase = base ?? _currentPath;
    final pickSid = sheetSid ?? _sessionId;
    _enterPicker();
    FilePickerResult? result;
    try {
      result = await FilePicker.platform.pickFiles(allowMultiple: true);
    } catch (_) {
      result = null;
    } finally {
      _exitPicker();
      await _recoverAfterPicker();
    }
    if (!mounted) return;
    if (result == null || result.files.isEmpty) return;
    if (pickBase != _currentPath || pickSid != _sessionId) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            pickSid != _sessionId
                ? 'Session changed, please retry'
                : 'Directory changed, please retry',
          ),
        ),
      );
      _refresh();
      return;
    }
    if (_activeUploads > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload in progress, please retry shortly')),
      );
      return;
    }

    _activeUploads++;
    _setBusy(true);
    int uploaded = 0, failed = 0;
    final targetBase = _currentPath;
    final sid = _sessionId;
    final batchFiles =
        result.files.where((pickedFile) => pickedFile.path != null).toList();
    if (batchFiles.isEmpty) {
      _activeUploads--;
      _setBusy(false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No files selected')),
        );
      }
      return;
    }
    final batchPaths = <String>[];
    for (final pickedFile in batchFiles) {
      batchPaths.add(_upKey(sid, _remotePathIn(targetBase, pickedFile.name)));
    }
    _uploadingPaths.addAll(batchPaths);
    var dirChanged = false;
    var sessionChanged = false;
    final succeeded = <String>[];
    try {
      for (final pickedFile in batchFiles) {
        if (sid != _sessionId || targetBase != _currentPath) {
          dirChanged = targetBase != _currentPath;
          sessionChanged = sid != _sessionId;
          failed += batchFiles.length - uploaded - failed;
          break;
        }
        final file = File(pickedFile.path!);
        final remotePath = _remotePathIn(targetBase, pickedFile.name);
        _dropPendingFor(remotePath, sid);

        try {
          final uploadUrl = Uri.parse(
            '${ApiConfig.baseUrl}/entries/sftp/upload'
        '?sessionId=${Uri.encodeComponent(sid)}'
            '&path=${Uri.encodeComponent(remotePath)}'
            '&sessionToken=${Uri.encodeComponent(widget.token)}',
          );

        final request = http.StreamedRequest('POST', uploadUrl);
        request.headers['User-Agent'] = ApiClient.userAgent;
        request.contentLength = await file.length();
        var readFailed = false;
        file.openRead().listen(
          request.sink.add,
          onDone: request.sink.close,
          onError: (e) {
            readFailed = true;
            request.sink.close();
          },
        );

        final response = await request.send().timeout(const Duration(minutes: 10));
        await response.stream.drain();
        if (!readFailed &&
            (response.statusCode == 200 || response.statusCode == 201)) {
          succeeded.add(remotePath);
          uploaded++;
        } else {
          failed++;
        }
      } catch (_) {
        failed++;
      }
    }
    } finally {
      for (final p in batchPaths) {
        _uploadingPaths.remove(p);
      }
      for (final remotePath in succeeded) {
        _dropPendingFor(remotePath, sid);
      }
      if (_activeUploads > 0) _activeUploads--;
      _setBusy(false);
    }

    if (mounted) {
      final msg = sessionChanged
          ? 'Session changed, upload stopped (uploaded $uploaded, failed $failed)'
          : dirChanged
              ? 'Directory changed, upload stopped (uploaded $uploaded, failed $failed)'
              : failed == 0
                  ? 'Uploaded $uploaded file${uploaded != 1 ? 's' : ''}'
                  : 'Uploaded $uploaded, failed $failed';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      _refresh();
    }
  }

  Uri _downloadUri(String remotePath, [String? sessionId]) {
    final sid = sessionId ?? _sessionId;
    return Uri.parse(
      '${ApiConfig.baseUrl}/entries/sftp'
      '?sessionId=${Uri.encodeComponent(sid)}'
      '&path=${Uri.encodeComponent(remotePath)}'
      '&sessionToken=${Uri.encodeComponent(widget.token)}',
    );
  }

  static const MethodChannel _revealChannel =
      MethodChannel('nexterm/downloads');

  Uri _multiDownloadUri([String? sessionId]) {
    final sid = sessionId ?? _sessionId;
    return Uri.parse(
      '${ApiConfig.baseUrl}/entries/sftp/multi'
      '?sessionId=${Uri.encodeComponent(sid)}'
      '&sessionToken=${Uri.encodeComponent(widget.token)}',
    );
  }

  String _safeFileName(String name) {
    var s = name.replaceAll(RegExp(r'[\x00-\x1F\x7F<>:"/\\|?*]'), '_').trim();
    s = s.replaceAll(RegExp(r'[. ]+$'), '');
    if (s.isEmpty ||
        s == '.' ||
        s == '..' ||
        RegExp(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$',
                caseSensitive: false)
            .hasMatch(s)) {
      s = 'download';
    }
    if (s.length > 100) {
      final dot = s.lastIndexOf('.');
      if (dot > 0 && s.length - dot <= 12) {
        s = '${s.substring(0, 100 - (s.length - dot))}${s.substring(dot)}';
      } else {
        s = s.substring(0, 100);
      }
    }
    return s;
  }

  Future<File> _streamToTemp(String remotePath, String fileName, [String? sessionId]) async {
    final client = http.Client();
    File? tempFile;
    try {
      final request = http.Request('GET', _downloadUri(remotePath, sessionId));
      request.headers['User-Agent'] = ApiClient.userAgent;
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 60));
      if (streamed.statusCode != 200) {
        throw Exception('HTTP ${streamed.statusCode}');
      }
      final tempDir = await getTemporaryDirectory();
      final safeName = _safeFileName(fileName);
      tempFile = File(
        '${tempDir.path}/nexterm_dl_${DateTime.now().microsecondsSinceEpoch}_$safeName',
      );
      final sink = tempFile.openWrite();
      try {
        await streamed.stream
            .pipe(sink)
            .timeout(const Duration(minutes: 10));
      } catch (_) {
        try {
          await sink.close();
        } catch (_) {}
        await _deleteQuietly(tempFile);
        tempFile = null;
        rethrow;
      }
      return tempFile;
    } catch (_) {
      await _deleteQuietly(tempFile);
      rethrow;
    } finally {
      client.close();
    }
  }

  Future<void> _deleteQuietly(File? file) async {
    if (file == null) return;
    try {
      if (await file.exists()) await file.delete();
    } catch (_) {}
  }

  Future<File> _streamPostToTemp(
    Uri url,
    Map<String, dynamic> body,
    String fileName,
  ) async {
    final client = http.Client();
    File? tempFile;
    try {
      final request = http.Request('POST', url);
      request.headers['User-Agent'] = ApiClient.userAgent;
      request.headers['Content-Type'] = 'application/json';
      request.body = json.encode(body);
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 60));
      if (streamed.statusCode != 200) {
        throw Exception('HTTP ${streamed.statusCode}');
      }
      final tempDir = await getTemporaryDirectory();
      final safeName = _safeFileName(fileName);
      tempFile = File(
        '${tempDir.path}/nexterm_dl_${DateTime.now().microsecondsSinceEpoch}_$safeName',
      );
      final sink = tempFile.openWrite();
      try {
        await streamed.stream
            .pipe(sink)
            .timeout(const Duration(minutes: 10));
      } catch (_) {
        try {
          await sink.close();
        } catch (_) {}
        await _deleteQuietly(tempFile);
        tempFile = null;
        rethrow;
      }
      return tempFile;
    } catch (_) {
      await _deleteQuietly(tempFile);
      rethrow;
    } finally {
      client.close();
    }
  }

  Future<String?> _saveTempOnce(File temp, String suggestedName) async {
    _enterPicker();
    try {
      return await FlutterFileDialog.saveFile(
        params: SaveFileDialogParams(
          sourceFilePath: temp.path,
          fileName: suggestedName,
        ),
      );
    } finally {
      _exitPicker();
      await _deleteQuietly(temp);
      await _recoverAfterPicker();
    }
  }

  Future<void> _showSavedLocation(String? savedValue) async {
    if (savedValue == null || savedValue.isEmpty) return;
    if (Platform.isIOS) {
      try {
        await launchUrl(
          Uri.parse('shareddocuments://'),
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {}
      return;
    }
    try {
      await _revealChannel.invokeMethod(
        'showSavedDocument',
        {'value': savedValue},
      );
    } catch (_) {}
  }

  void _showDownloadedMessage(String? savedValue) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('File(s)/Folder(s) downloaded'),
        action: SnackBarAction(
          label: 'Show',
          onPressed: () => _showSavedLocation(savedValue),
        ),
      ),
    );
  }

  Future<void> _downloadSingle(String remotePath, String suggestedName, String base) async {
    final sid = _sessionId;
    if (!mounted) return;
    _setBusy(true);
    File? temp;
    try {
      temp = await _streamToTemp(remotePath, suggestedName, sid);
      if (!mounted || sid != _sessionId || base != _currentPath) {
        await _deleteQuietly(temp);
        temp = null;
        if (mounted && (sid != _sessionId || base != _currentPath)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                sid != _sessionId
                    ? 'Session changed, please retry'
                    : 'Directory changed, please retry',
              ),
            ),
          );
          _refresh();
        }
        return;
      }
      final saved = await _saveTempOnce(temp, suggestedName);
      temp = null;
      if (!mounted) return;
      if (saved == null) return;
      _showDownloadedMessage(saved);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    } finally {
      await _deleteQuietly(temp);
      _setBusy(false);
    }
  }

  Future<void> _downloadFile(SftpEntry entry, String base, [String? sheetSid]) async {
    final actionSid = sheetSid ?? _sessionId;
    if (actionSid != _sessionId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session changed, please retry')),
      );
      _refresh();
      return;
    }
    if (base != _currentPath) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Directory changed, please retry')),
      );
      _refresh();
      return;
    }
    await _downloadSingle(_remotePathIn(base, entry.name), _safeFileName(entry.name), base);
  }

  Future<void> _downloadFolder(SftpEntry entry, String base, [String? sheetSid]) async {
    final actionSid = sheetSid ?? _sessionId;
    if (actionSid != _sessionId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session changed, please retry')),
      );
      _refresh();
      return;
    }
    if (base != _currentPath) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Directory changed, please retry')),
      );
      _refresh();
      return;
    }
    await _downloadSingle(
      _remotePathIn(base, entry.name),
      '${_safeFileName(entry.name)}.zip',
      base,
    );
  }

  Future<void> _downloadMultiple(List<SftpEntry> entries) async {
    if (entries.isEmpty) return;
    final base = _currentPath;
    final sid = _sessionId;
    if (entries.length == 1) {
      final single = entries.first;
      if (single.isDir) {
        await _downloadFolder(single, base, sid);
      } else {
        await _downloadFile(single, base, sid);
      }
      return;
    }
    if (!mounted) return;
    _setBusy(true);
    File? temp;
    try {
      final paths = entries.map((e) => _remotePathIn(base, e.name)).toList();
      temp = await _streamPostToTemp(
        _multiDownloadUri(sid),
        {'paths': paths},
        'files.zip',
      );
      if (!mounted || sid != _sessionId || base != _currentPath) {
        await _deleteQuietly(temp);
        temp = null;
        if (mounted && (sid != _sessionId || base != _currentPath)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                sid != _sessionId
                    ? 'Session changed, please retry'
                    : 'Directory changed, please retry',
              ),
            ),
          );
          _refresh();
        }
        return;
      }
      final saved = await _saveTempOnce(temp, 'files.zip');
      temp = null;
      if (!mounted) return;
      if (saved == null) return;
      _showDownloadedMessage(saved);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    } finally {
      await _deleteQuietly(temp);
      _setBusy(false);
    }
  }

  void _cancelSelection() {
    setState(() {
      _selectedIndices.clear();
      _selectionMode = false;
    });
  }

  List<SftpEntry> _selectedEntries() {
    final entries = <SftpEntry>[];
    for (final i in _selectedIndices) {
      if (i >= 0 && i < _entries.length) {
        entries.add(_entries[i]);
      }
    }
    return entries;
  }

  void _deleteSelected() {
    _showDeleteConfirmation(_selectedEntries(), _currentPath, _sessionId);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _flushPendingUploads();
    }
  }

  bool _hasPendingFor(String remotePath, [String? sessionId]) {
    final full = _upKey(sessionId ?? _sessionId, remotePath);
    final prefix = full.endsWith('/') ? full : '$full/';
    for (final key in _pendingEdits.keys) {
      if (key == full || key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  bool _hasUploadingFor(String remotePath, [String? sessionId]) {
    final sid = sessionId ?? _sessionId;
    final full = _upKey(sid, remotePath);
    if (_uploadingPaths.contains(full)) {
      return true;
    }
    final childPrefix = full.endsWith('/') ? full : '$full/';
    for (final key in _uploadingPaths) {
      if (key.startsWith(childPrefix)) {
        return true;
      }
    }
    return false;
  }

  void _dropPendingFor(String remotePath, [String? sessionId]) {
    final full = _upKey(sessionId ?? _sessionId, remotePath);
    final prefix = full.endsWith('/') ? full : '$full/';
    for (final key in _pendingEdits.keys.toList()) {
      if (key == full || key.startsWith(prefix)) {
        final stale = _pendingEdits[key];
        if (stale != null &&
            _uploadingPaths.contains(_upKey(stale.sessionId, stale.remotePath))) {
          continue;
        }
        _pendingEdits.remove(key);
        if (stale != null) {
          unawaited(_deleteQuietly(File(stale.tempPath)));
        }
      }
    }
  }

  void _dropAllPendingEdits(String sessionId) {
    for (final key in _pendingEdits.keys.toList()) {
      final stale = _pendingEdits[key];
      if (stale == null || stale.sessionId != sessionId) {
        continue;
      }
      if (_uploadingPaths.contains(key)) {
        continue;
      }
      _pendingEdits.remove(key);
      unawaited(_deleteQuietly(File(stale.tempPath)));
    }
  }

  Future<bool> _confirmDiscardOpenEdits() async {
    if (!widget.sftpSettings.warnBeforeDiscardEdit) return true;
    if (!mounted) return false;
    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Offene Datei verwerfen?'),
        content: const Text(
          'Die geöffnete Datei enthält möglicherweise ungespeicherte Änderungen, die beim Öffnen verloren gehen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Fortfahren'),
          ),
        ],
      ),
    );
    return proceed == true;
  }

  @override
  void didUpdateWidget(SftpRenderer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.sessionId != widget.session.sessionId) {
      final oldSid = oldWidget.session.sessionId;
      for (final key in _pendingEdits.keys.toList()) {
        final current = _pendingEdits[key];
        if (current == null || current.sessionId != oldSid) {
          continue;
        }
        if (_uploadingPaths.contains(key)) {
          continue;
        }
        final pending = _pendingEdits.remove(key);
        if (pending != null) {
          unawaited(_deleteQuietly(File(pending.tempPath)));
        }
      }
      _openingPaths.removeWhere((k) => k.startsWith('$oldSid|'));
      _uploadingPaths.removeWhere((k) => k.startsWith('$oldSid|'));
      _entries = [];
      _currentPath = widget.session.sftpPath ?? '/';
      _rootPath = widget.session.sftpRootPath ?? '/';
      _lastRequestedPath = _currentPath;
      _savedOffset = null;
      _listBusyQueue.clear();
      _history = [_currentPath];
      _historyIndex = 0;
      _selectedIndices.clear();
      _selectionMode = false;
      _loading = true;
      _errorMessage = null;
      _connected = false;
      _reconnectAttempts = 0;
      _aliveResets = 0;
      _connectionLostWhilePicking = false;
      _quietReadyOnce = false;
      _initialized = false;
      if (!identical(oldWidget.session, widget.session)) {
        try {
          oldWidget.session.sftpSubscription?.cancel();
        } catch (_) {}
        oldWidget.session.sftpSubscription = null;
      }
      _setupConnection();
    }
  }

  Future<_PendingEdit?> _snapshotEdit(
      File file, String remotePath, String fileName, String sessionId) async {
    try {
      final stat = await file.stat();
      final hash = await hashEditFile(file);
      return _PendingEdit(
        sessionId: sessionId,
        remotePath: remotePath,
        tempPath: file.path,
        fileName: fileName,
        size: stat.size,
        mtimeMs: stat.modified.millisecondsSinceEpoch,
        hash: hash,
      );
    } catch (_) {
      return null;
    }
  }

  Future<bool> _editChanged(_PendingEdit pending) async {
    try {
      final file = File(pending.tempPath);
      if (!await file.exists()) return false;
      final stat = await file.stat();
      final hash = await hashEditFile(file);
      return pendingEditChanged(
        oldSize: pending.size,
        oldMtimeMs: pending.mtimeMs,
        oldHash: pending.hash,
        newSize: stat.size,
        newMtimeMs: stat.modified.millisecondsSinceEpoch,
        newHash: hash,
      );
    } catch (_) {
      try {
        if (!await File(pending.tempPath).exists()) return false;
      } catch (_) {}
      return true;
    }
  }

  Future<File> _streamToEditTemp(String remotePath, String fileName, String sessionId) async {
    final client = http.Client();
    File? tempFile;
    try {
      final request = http.Request('GET', _downloadUri(remotePath, sessionId));
      request.headers['User-Agent'] = ApiClient.userAgent;
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 60));
      if (streamed.statusCode != 200) {
        throw Exception('HTTP ${streamed.statusCode}');
      }
      final tempDir = await getTemporaryDirectory();
      final editDir = Directory('${tempDir.path}/nexterm_edit/$sessionId');
      await editDir.create(recursive: true);
      final safeName = _safeFileName(fileName);
      tempFile = File(
        '${editDir.path}/${DateTime.now().microsecondsSinceEpoch}_$safeName',
      );
      final sink = tempFile.openWrite();
      try {
        var received = 0;
        await streamed.stream
            .map((chunk) {
              received += chunk.length;
              if (received > _maxOpenBytes) {
                throw Exception('File is too large to open');
              }
              return chunk;
            })
            .pipe(sink)
            .timeout(const Duration(minutes: 10));
      } catch (_) {
        try {
          await sink.close();
        } catch (_) {}
        await _deleteQuietly(tempFile);
        tempFile = null;
        rethrow;
      }
      return tempFile;
    } catch (_) {
      await _deleteQuietly(tempFile);
      rethrow;
    } finally {
      client.close();
    }
  }

  Future<void> _sweepStaleEditTemps() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final editRoot = Directory('${tempDir.path}/nexterm_edit');
      if (!await editRoot.exists()) return;
      final cutoff = DateTime.now().subtract(const Duration(hours: 24));
      await for (final entity in editRoot.list(recursive: true)) {
        if (entity is File) {
          try {
            final stat = await entity.stat();
            if (stat.modified.isBefore(cutoff)) {
              await entity.delete();
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  Future<bool> _invokeNativeOpen(String tempPath) async {
    try {
      final result = await _editChannel.invokeMethod<bool>(
        'open',
        {'path': tempPath},
      );
      return result ?? true;
    } on MissingPluginException catch (_) {
      return false;
    } on PlatformException catch (_) {
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> _openEntry(SftpEntry entry, String base, [String? sheetSid]) async {
    if (entry.isDir) return;
    final actionSid = sheetSid ?? _sessionId;
    if (actionSid != _sessionId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session changed, please retry')),
      );
      _refresh();
      return;
    }
    if (base != _currentPath) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Directory changed, please retry')),
      );
      _refresh();
      return;
    }
    if (entry.size > _maxOpenBytes) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File is too large to open')),
      );
      return;
    }
    final remotePath = _remotePathIn(base, entry.name);
    final fileName = _safeFileName(entry.name);
    final openSessionId = _sessionId;
    final pkey = _upKey(openSessionId, remotePath);
    if (!mounted || _openingPaths.contains(pkey)) return;
    if (_uploadingPaths.contains(_upKey(openSessionId, remotePath))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload in progress, please retry shortly')),
      );
      return;
    }
    _openingPaths.add(pkey);
    _setBusy(true);
    File? temp;
    _PendingEdit? snapshot;
    try {
      temp = await _streamToEditTemp(remotePath, fileName, openSessionId);
      if (!mounted || openSessionId != _sessionId || base != _currentPath) {
        await _deleteQuietly(temp);
        temp = null;
        if (mounted && (openSessionId != _sessionId || base != _currentPath)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                openSessionId != _sessionId
                    ? 'Session changed, please retry'
                    : 'Directory changed, please retry',
              ),
            ),
          );
          _refresh();
        }
        return;
      }
      snapshot = await _snapshotEdit(temp, remotePath, fileName, openSessionId);
      if (!mounted || openSessionId != _sessionId) {
        await _deleteQuietly(temp);
        temp = null;
        return;
      }
      if (snapshot == null) {
        await _deleteQuietly(temp);
        temp = null;
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Open failed')),
          );
        }
        return;
      }
      if (_uploadingPaths.contains(_upKey(openSessionId, remotePath))) {
        await _deleteQuietly(temp);
        temp = null;
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Upload in progress, please retry shortly')),
          );
        }
        return;
      }
      if (_pendingEdits.isNotEmpty) {
        final proceed = await _confirmDiscardOpenEdits();
        if (!mounted ||
            openSessionId != _sessionId ||
            base != _currentPath ||
            _uploadingPaths.contains(_upKey(openSessionId, remotePath))) {
          await _deleteQuietly(temp);
          temp = null;
          return;
        }
        if (!proceed) {
          await _deleteQuietly(temp);
          temp = null;
          return;
        }
        _dropAllPendingEdits(openSessionId);
      }
      _dropPendingFor(remotePath, openSessionId);
      _pendingEdits[pkey] = snapshot;
      _enterPicker();
      bool opened = false;
      try {
        opened = await _invokeNativeOpen(temp.path);
      } finally {
        _exitPicker();
        await _recoverAfterPicker();
      }
      if (!mounted) {
        if (opened) {
          temp = null;
        } else if (identical(_pendingEdits[pkey], snapshot)) {
          _pendingEdits.remove(pkey);
        }
        return;
      }
      if (!opened) {
        final saved = await _saveTempOnce(temp, fileName);
        temp = null;
        if (identical(_pendingEdits[pkey], snapshot)) {
          _pendingEdits.remove(pkey);
        }
        if (saved == null) return;
        _showDownloadedMessage(saved);
        return;
      }
      temp = null;
      await _flushPendingUpload(pkey);
    } catch (e) {
      await _deleteQuietly(temp);
      if (snapshot != null &&
          identical(_pendingEdits[pkey], snapshot)) {
        try {
          if (!await File(snapshot.tempPath).exists()) {
            _pendingEdits.remove(pkey);
          }
        } catch (_) {}
      }
      if (snapshot != null &&
          !identical(_pendingEdits[pkey], snapshot)) {
        await _deleteQuietly(File(snapshot.tempPath));
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Open failed: $e')),
        );
      }
    } finally {
      _openingPaths.remove(pkey);
      await _deleteQuietly(temp);
      _setBusy(false);
    }
  }

  Future<void> _flushPendingUploads() async {
    if (!mounted || _pendingEdits.isEmpty) return;
    for (final key in _pendingEdits.keys.toList()) {
      await _flushPendingUpload(key);
    }
  }

  Future<void> _flushPendingUpload(String pkey) async {
    final pending = _pendingEdits[pkey];
    if (pending == null || !mounted) return;
    final remotePath = pending.remotePath;
    if (_uploadingPaths.contains(pkey)) return;
    if (pending.sessionId != _sessionId) {
      if (identical(_pendingEdits[pkey], pending)) {
        _pendingEdits.remove(pkey);
      }
      await _deleteQuietly(File(pending.tempPath));
      return;
    }
    if (!await File(pending.tempPath).exists()) {
      if (identical(_pendingEdits[pkey], pending)) {
        _pendingEdits.remove(pkey);
      }
      return;
    }
    final changed = await _editChanged(pending);
    if (!changed || !mounted) return;
    if (!identical(_pendingEdits[pkey], pending)) return;
    await _uploadEditedFile(pending);
  }

  Future<void> _uploadEditedFile(_PendingEdit pending) async {
    final file = File(pending.tempPath);
    final pkey = _upKey(pending.sessionId, pending.remotePath);
    final remotePath = pending.remotePath;
    if (!mounted) {
      if (identical(_pendingEdits[pkey], pending)) {
        _pendingEdits.remove(pkey);
      }
      await _deleteQuietly(file);
      return;
    }
    final sid = pending.sessionId;
    if (sid != _sessionId) {
      if (identical(_pendingEdits[pkey], pending)) {
        _pendingEdits.remove(pkey);
      }
      await _deleteQuietly(file);
      return;
    }
    if (_uploadingPaths.contains(pkey)) {
      return;
    }
    if (_activeUploads > 0) {
      return;
    }
    _activeUploads++;
    _setBusy(true);
    _uploadingPaths.add(pkey);
    try {
      final editedSize = await file.length();
      if (editedSize > _maxOpenBytes) {
        return;
      }
      final uploadUrl = Uri.parse(
        '${ApiConfig.baseUrl}/entries/sftp/upload'
        '?sessionId=${Uri.encodeComponent(sid)}'
        '&path=${Uri.encodeComponent(remotePath)}'
        '&sessionToken=${Uri.encodeComponent(widget.token)}',
      );
      final request = http.StreamedRequest('POST', uploadUrl);
      request.headers['User-Agent'] = ApiClient.userAgent;
      request.contentLength = editedSize;
      var readFailed = false;
      file.openRead().listen(
        request.sink.add,
        onDone: request.sink.close,
        onError: (e) {
          readFailed = true;
          request.sink.close();
        },
      );
      final response = await request.send().timeout(const Duration(minutes: 10));
      await response.stream.drain();
      if (!mounted) {
        if (identical(_pendingEdits[pkey], pending)) {
          _pendingEdits.remove(pkey);
        }
        await _deleteQuietly(file);
        return;
      }
      if (sid != _sessionId) {
        if (identical(_pendingEdits[pkey], pending)) {
          _pendingEdits.remove(pkey);
        }
        await _deleteQuietly(file);
        return;
      }
      if (!identical(_pendingEdits[pkey], pending)) {
        await _deleteQuietly(file);
        return;
      }
      if (!readFailed &&
          (response.statusCode == 200 || response.statusCode == 201)) {
        _pendingEdits.remove(pkey);
        await _deleteQuietly(file);
        _refresh();
      }
    } catch (_) {
    } finally {
      _uploadingPaths.remove(pkey);
      if (_activeUploads > 0) _activeUploads--;
      _setBusy(false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    try {
      widget.session.sftpSubscription?.cancel();
    } catch (_) {}
    widget.session.sftpSubscription = null;
    for (final key in _pendingEdits.keys.toList()) {
      if (_uploadingPaths.contains(key)) {
        continue;
      }
      final pending = _pendingEdits.remove(key);
      if (pending != null) {
        unawaited(_deleteQuietly(File(pending.tempPath)));
      }
    }
    _openingPaths.clear();
    _scrollController.dispose();
    widget.sftpSettings.removeListener(_onSftpSettingsChanged);
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
        if (_showProgress) const LinearProgressIndicator(),
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
        if (_showProgress) const LinearProgressIndicator(),
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
                    final entries = _selectedEntries();
                    if (entries.isEmpty) return;
                    _downloadMultiple(entries);
                    _cancelSelection();
                  }
                : null,
            tooltip: 'Download',
          ),
          IconButton(
            icon: Icon(MdiIcons.pencilOutline),
            onPressed: _selectedIndices.length == 1
                ? () {
                    final entries = _selectedEntries();
                    if (entries.isEmpty) return;
                    _showRenameDialog(entries.first, _currentPath, _sessionId);
                  }
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
    final segments = _pathSegments();

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
            onPressed: segments.isNotEmpty ? _goUp : null,
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
                  _buildBreadcrumb('/', _rootPath),
                  for (int i = 0; i < segments.length; i++) ...[
                    Icon(MdiIcons.chevronRight, size: 16, color: theme.colorScheme.outline),
                    _buildBreadcrumb(
                      segments[i],
                      _joinPath(segments.sublist(0, i + 1)),
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
      return ConnectionLoader(
        visible: true,
        backgroundColor: Theme.of(context).colorScheme.surface,
      );
    }

    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_entries.isEmpty) {
      return LayoutBuilder(
        builder: (_, constraints) => RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Center(
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
              ),
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => _refresh(),
      child: ListView.builder(
        key: PageStorageKey<String>('sftp-list-$_sessionId-$_currentPath'),
        controller: _scrollController,
        itemCount: _entries.length,
        itemBuilder: (ctx, index) => _buildEntryTile(index),
      ),
    );
  }

  Widget _buildEntryTile(int index) {
    final entry = _entries[index];
    final theme = Theme.of(context);
    final isSelected = _selectedIndices.contains(index);
    final isDimmed = entry.name.startsWith('.') &&
        widget.sftpSettings.dimHiddenFiles;

    return Material(
      color: isSelected
          ? theme.colorScheme.primaryContainer.withValues(alpha: 0.3)
          : Colors.transparent,
      child: InkWell(
        onTap: () => _onEntryTap(entry, index),
        onLongPress: () => _onEntryLongPress(index),
        child: Opacity(
          opacity: isDimmed ? 0.55 : 1.0,
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
      ),
    );
  }

  void _showEntryActions(SftpEntry entry) {
    final base = _currentPath;
    final sheetSid = _sessionId;
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
                leading: Icon(MdiIcons.openInNew),
                title: const Text('Open'),
                onTap: () {
                  Navigator.pop(ctx);
                  _openEntry(entry, base, sheetSid);
                },
              ),
            ListTile(
              leading: Icon(MdiIcons.downloadOutline),
              title: const Text('Download'),
              onTap: () {
                Navigator.pop(ctx);
                if (entry.isDir) {
                  _downloadFolder(entry, base, sheetSid);
                } else {
                  _downloadFile(entry, base, sheetSid);
                }
              },
            ),
            ListTile(
              leading: Icon(MdiIcons.pencilOutline),
              title: const Text('Rename'),
              onTap: () { Navigator.pop(ctx); _showRenameDialog(entry, base, sheetSid); },
            ),
            ListTile(
              leading: Icon(MdiIcons.deleteOutline, color: Theme.of(ctx).colorScheme.error),
              title: Text('Delete', style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
              onTap: () { Navigator.pop(ctx); _showDeleteConfirmation([entry], base, sheetSid); },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showAddMenu() {
    final base = _currentPath;
    final menuSid = _sessionId;
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
              onTap: () { Navigator.pop(ctx); _showCreateFolderDialog(base, menuSid); },
            ),
            ListTile(
              leading: Icon(MdiIcons.uploadOutline),
              title: const Text('Upload File'),
              onTap: () { Navigator.pop(ctx); _uploadFile(base, menuSid); },
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
