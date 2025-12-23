import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/api_client.dart';

class ConnectionService {
  static String? _deviceId;
  static String? _appInstanceId;

  static Future<String> _getDeviceId() async {
    if (_deviceId != null) return _deviceId!;
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString('nexterm_device_id');
    if (_deviceId == null) {
      _deviceId = 'device_${DateTime.now().millisecondsSinceEpoch}_${_randomString(9)}';
      await prefs.setString('nexterm_device_id', _deviceId!);
    }
    return _deviceId!;
  }

  static String _getAppInstanceId() =>
      _appInstanceId ??= 'app_${DateTime.now().millisecondsSinceEpoch}_${_randomString(9)}';

  static String _randomString(int length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final now = DateTime.now().millisecondsSinceEpoch;
    return String.fromCharCodes(List.generate(length, (i) => chars.codeUnitAt((now + i * 37) % chars.length)));
  }

  static Future<ConnectionSession> createSession({
    required String token, required int entryId, int? identityId, String? connectionReason, String? type,
  }) async {
    final body = <String, dynamic>{
      'entryId': entryId,
      'tabId': _getAppInstanceId(),
      'browserId': await _getDeviceId(),
      if (identityId != null && identityId > 0) 'identityId': identityId,
      if (connectionReason != null) 'connectionReason': connectionReason,
      if (type != null) 'type': type,
    };

    final response = await ApiClient.post('/connections', body: body, token: token);
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return ConnectionSession(sessionId: data['sessionId'] as String, entryId: entryId, identityId: identityId);
    }
    throw Exception('Failed to create session: ${response.statusCode} - ${response.body}');
  }

  static Future<void> deleteSession({required String token, required String sessionId}) async {
    try {
      await ApiClient.delete('/connections/$sessionId', token: token);
    } catch (_) {}
  }

  static Future<void> hibernateSession({required String token, required String sessionId}) async {
    final response = await ApiClient.post('/connections/$sessionId/hibernate', token: token);
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to hibernate session: ${response.statusCode}');
    }
  }

  static Future<void> resumeSession({required String token, required String sessionId}) async {
    final response = await ApiClient.post(
      '/connections/$sessionId/resume',
      body: {'tabId': _getAppInstanceId(), 'browserId': await _getDeviceId()},
      token: token,
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to resume session: ${response.statusCode}');
    }
  }
}

class ConnectionSession {
  final String sessionId;
  final int entryId;
  final int? identityId;

  const ConnectionSession({required this.sessionId, required this.entryId, this.identityId});
}
