import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:web_socket_channel/io.dart';
import '../models/sftp_entry.dart';
import '../utils/api_client.dart';
import 'connection_service.dart';

class SftpOperations {
  static const int ready = 0x0;
  static const int listFiles = 0x1;
  static const int createFile = 0x4;
  static const int createFolder = 0x5;
  static const int deleteFile = 0x6;
  static const int deleteFolder = 0x7;
  static const int renameFile = 0x8;
  static const int error = 0x9;
}

class SftpService {
  IOWebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _isReady = false;
  String _currentPath = '/';

  final void Function(List<SftpEntry> entries)? onDirectoryListed;
  final void Function(String error)? onError;
  final void Function()? onReady;
  final void Function()? onDisconnected;

  SftpService({
    this.onDirectoryListed,
    this.onError,
    this.onReady,
    this.onDisconnected,
  });

  bool get isReady => _isReady;
  String get currentPath => _currentPath;

  Future<String> connect({
    required String token,
    required int entryId,
    int? identityId,
  }) async {
    final session = await ConnectionService.createSession(
      token: token,
      entryId: entryId,
      identityId: identityId,
      type: 'sftp',
    );

    final queryParams = <String, String>{
      'sessionToken': token,
      'sessionId': session.sessionId,
    };

    _channel = IOWebSocketChannel.connect(
      Uri.parse(ApiClient.buildWebSocketUrl('/ws/sftp', queryParams: queryParams)),
      headers: {'User-Agent': ApiClient.userAgent},
    );

    _subscription = _channel!.stream.listen(
      _processMessage,
      onError: (error) {
        onError?.call('Connection error: $error');
        _isReady = false;
      },
      onDone: () {
        _isReady = false;
        onDisconnected?.call();
      },
    );

    return session.sessionId;
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
      case SftpOperations.ready:
        _isReady = true;
        onReady?.call();
        break;
      case SftpOperations.listFiles:
        try {
          final decoded = json.decode(jsonPayload);
          final List<dynamic> files =
              decoded is List ? decoded : (decoded['files'] ?? []);
          final entries = files
              .map((e) => SftpEntry.fromJson(e as Map<String, dynamic>))
              .toList();
          onDirectoryListed?.call(entries);
        } catch (e) {
          onError?.call('Failed to parse directory listing: $e');
        }
        break;
      case SftpOperations.error:
        try {
          final decoded = json.decode(jsonPayload);
          onError?.call(decoded['message'] ?? 'Unknown error');
        } catch (_) {
          onError?.call(jsonPayload.isNotEmpty ? jsonPayload : 'Unknown error');
        }
        break;
      default:
        listDirectory(_currentPath);
        break;
    }
  }

  void _sendOperation(int operation, Map<String, dynamic> payload) {
    if (_channel == null) return;
    final jsonStr = json.encode(payload);
    final jsonBytes = utf8.encode(jsonStr);
    final message = Uint8List(1 + jsonBytes.length);
    message[0] = operation;
    message.setRange(1, message.length, jsonBytes);
    _channel!.sink.add(message);
  }

  void listDirectory(String path) {
    _currentPath = path;
    _sendOperation(SftpOperations.listFiles, {'path': path});
  }

  void createFolder(String path) {
    _sendOperation(SftpOperations.createFolder, {'path': path});
  }

  void deleteFile(String path) {
    _sendOperation(SftpOperations.deleteFile, {'path': path});
  }

  void deleteFolder(String path) {
    _sendOperation(SftpOperations.deleteFolder, {'path': path});
  }

  void renameFile(String oldPath, String newPath) {
    _sendOperation(SftpOperations.renameFile, {
      'path': oldPath,
      'newPath': newPath,
    });
  }

  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _isReady = false;
  }
}
