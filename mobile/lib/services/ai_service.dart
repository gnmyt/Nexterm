import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/io.dart';
import '../utils/api_client.dart';

class AISettings {
  final bool enabled;
  final String? provider;
  final String? model;
  final bool isConfigured;
  final bool requireConfirmation;

  AISettings({
    required this.enabled,
    this.provider,
    this.model,
    this.isConfigured = false,
    this.requireConfirmation = false,
  });

  factory AISettings.fromJson(Map<String, dynamic> json) => AISettings(
    enabled: json['enabled'] == true,
    provider: json['provider'] as String?,
    model: json['model'] as String?,
    isConfigured: json['isConfigured'] == true,
    requireConfirmation: json['requireConfirmation'] == true,
  );

  bool get isAvailable => isConfigured;
}

class AIService {
  static Future<AISettings> getSettings(String token) async {
    final response = await ApiClient.get('/ai', token: token);
    if (response.statusCode == 200) {
      return AISettings.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to load AI settings: ${response.statusCode}');
  }
}

class AIAssistantChannel {
  final String token;
  final String sessionId;
  final void Function(Map<String, dynamic> event) onEvent;
  final void Function(String? reason) onClosed;

  IOWebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _closedByUs = false;

  AIAssistantChannel({
    required this.token,
    required this.sessionId,
    required this.onEvent,
    required this.onClosed,
  });

  void connect() {
    final url = ApiClient.buildWebSocketUrl('/ws/ai', queryParams: {
      'sessionToken': token,
      'sessionId': sessionId,
    });

    final channel = IOWebSocketChannel.connect(
      Uri.parse(url),
      headers: {'User-Agent': ApiClient.userAgent},
    );
    _channel = channel;

    _subscription = channel.stream.listen(
      (data) {
        if (data is! String) return;
        try {
          final decoded = jsonDecode(data);
          if (decoded is Map<String, dynamic>) onEvent(decoded);
        } catch (_) {}
      },
      onError: (_) {
        if (!_closedByUs) onClosed(null);
      },
      onDone: () {
        if (_closedByUs) return;
        final code = channel.closeCode;
        final reason = channel.closeReason;
        final hasReason = code != null && code >= 4000 && reason != null && reason.isNotEmpty;
        onClosed(hasReason ? reason : null);
      },
    );
  }

  void _send(Map<String, dynamic> payload) {
    _channel?.sink.add(jsonEncode(payload));
  }

  void sendPrompt(String content) => _send({'type': 'prompt', 'content': content});

  void confirm(String callId, bool allow) => _send({'type': 'confirm', 'callId': callId, 'allow': allow});

  void abort() => _send({'type': 'abort'});

  void dispose() {
    _closedByUs = true;
    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
  }
}
