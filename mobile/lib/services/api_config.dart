import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String prefKeyBaseUrl = 'api_base_url';
  static const String defaultBaseUrl = 'http://localhost:8080';
  static String _baseUrl = defaultBaseUrl;

  static String get baseUrl => _baseUrl;

  static Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString(prefKeyBaseUrl) ?? defaultBaseUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(prefKeyBaseUrl, url);
    _baseUrl = url;
  }

  static const String logout = '/auth/logout';
  static const String me = '/accounts/me';
  static const String isFirstTimeSetup = '/service/is-fts';
  static const String sessionList = '/sessions/list';
  static String sessionRevoke(String id) => '/sessions/$id';

  static Map<String, String> get headers => {'Content-Type': 'application/json', 'Accept': 'application/json'};
  static Map<String, String> authHeaders(String token) => {...headers, 'Authorization': 'Bearer $token'};
}
