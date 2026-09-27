import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/api_config.dart';
import '../utils/api_client.dart';

class SftpTextFileException implements Exception {
  final String message;
  final int? statusCode;
  SftpTextFileException(this.message, [this.statusCode]);
  @override
  String toString() => message;
}

class SftpTextFileService {
  static Uri downloadUri({
    required String sessionId,
    required String remotePath,
    required String token,
  }) {
    return Uri.parse(
        '${ApiConfig.baseUrl}/entries/sftp'
        '?sessionId=${Uri.encodeComponent(sessionId)}'
        '&path=${Uri.encodeComponent(remotePath)}'
        '&sessionToken=${Uri.encodeComponent(token)}'
        '&preview=true');
  }

  static Uri uploadUri({
    required String sessionId,
    required String remotePath,
    required String token,
  }) {
    return Uri.parse(
        '${ApiConfig.baseUrl}/entries/sftp/upload'
        '?sessionId=${Uri.encodeComponent(sessionId)}'
        '&path=${Uri.encodeComponent(remotePath)}'
        '&sessionToken=${Uri.encodeComponent(token)}');
  }

  static Future<String> loadText({
    required String sessionId,
    required String remotePath,
    required String token,
  }) async {
    final client = http.Client();
    try {
      final request = http.Request(
          'GET',
          downloadUri(
              sessionId: sessionId, remotePath: remotePath, token: token));
      request.headers['User-Agent'] = ApiClient.userAgent;
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 60));
      final announced = streamed.contentLength;
      if (announced != null && announced > 52428800) {
        throw SftpTextFileException('File too large');
      }
      final body = await streamed.stream.toBytes().timeout(
            const Duration(minutes: 5),
          );
      if (streamed.statusCode != 200) {
        String detail = '';
        try {
          detail = utf8.decode(body, allowMalformed: true);
        } catch (_) {}
        if (streamed.statusCode == 403) {
          throw SftpTextFileException(
              detail.isNotEmpty ? detail : 'Permission denied',
              streamed.statusCode);
        }
        if (streamed.statusCode == 404) {
          throw SftpTextFileException(
              detail.isNotEmpty ? detail : 'File not found',
              streamed.statusCode);
        }
        throw SftpTextFileException(
            detail.isNotEmpty
                ? detail
                : 'Load failed (HTTP ${streamed.statusCode})',
            streamed.statusCode);
      }
      return utf8.decode(body, allowMalformed: true);
    } finally {
      client.close();
    }
  }

  static Future<void> saveText({
    required String sessionId,
    required String remotePath,
    required String token,
    required String content,
  }) async {
    final client = http.Client();
    try {
      final body = utf8.encode(content);
      final response = await client
          .post(
            uploadUri(
                sessionId: sessionId, remotePath: remotePath, token: token),
            headers: {
              'User-Agent': ApiClient.userAgent,
              'Content-Type': 'application/octet-stream',
              'Content-Length': body.length.toString(),
            },
            body: body,
          )
          .timeout(const Duration(minutes: 2));
      if (response.statusCode != 200 && response.statusCode != 201) {
        String detail = '';
        try {
          final decoded = json.decode(response.body);
          if (decoded is Map && decoded['error'] is String) {
            detail = decoded['error'] as String;
          }
        } catch (_) {
          detail = response.body;
        }
        if (response.statusCode == 403) {
          throw SftpTextFileException(
              detail.isNotEmpty ? detail : 'Permission denied',
              response.statusCode);
        }
        throw SftpTextFileException(
            detail.isNotEmpty
                ? detail
                : 'Save failed (HTTP ${response.statusCode})',
            response.statusCode);
      }
    } finally {
      client.close();
    }
  }
}
