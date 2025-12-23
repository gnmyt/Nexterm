import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/api_config.dart';

class ApiClient {
  static const Duration _timeout = Duration(seconds: 30);

  static String normalizeBaseUrl(String url) {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://$url';
    url = url.replaceAll(RegExp(r'/+$'), '');
    if (!url.endsWith('/api')) url = '$url/api';
    return url;
  }

  static Map<String, String> _headers(Map<String, String>? headers, String? token) => {
    'Content-Type': 'application/json',
    ...?headers,
    if (token != null) 'Authorization': 'Bearer $token',
  };

  static Future<http.Response> get(String endpoint, {Map<String, String>? headers, String? token, Duration? timeout}) =>
      http.get(Uri.parse('${ApiConfig.baseUrl}$endpoint'), headers: _headers(headers, token)).timeout(timeout ?? _timeout);

  static Future<http.Response> post(String endpoint, {Map<String, dynamic>? body, Map<String, String>? headers, String? token, Duration? timeout}) =>
      http.post(Uri.parse('${ApiConfig.baseUrl}$endpoint'), headers: _headers(headers, token), body: body != null ? json.encode(body) : null).timeout(timeout ?? _timeout);

  static Future<http.Response> patch(String endpoint, {Map<String, dynamic>? body, Map<String, String>? headers, String? token, Duration? timeout}) =>
      http.patch(Uri.parse('${ApiConfig.baseUrl}$endpoint'), headers: _headers(headers, token), body: body != null ? json.encode(body) : null).timeout(timeout ?? _timeout);

  static Future<http.Response> delete(String endpoint, {Map<String, String>? headers, String? token, Duration? timeout}) =>
      http.delete(Uri.parse('${ApiConfig.baseUrl}$endpoint'), headers: _headers(headers, token)).timeout(timeout ?? _timeout);

  static String buildWebSocketUrl(String endpoint, {Map<String, String>? queryParams}) {
    final wsUrl = ApiConfig.baseUrl.replaceFirst('http://', 'ws://').replaceFirst('https://', 'wss://');
    if (queryParams == null || queryParams.isEmpty) return '$wsUrl$endpoint';
    final query = queryParams.entries.map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}').join('&');
    return '$wsUrl$endpoint?$query';
  }
}
