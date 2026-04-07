class ApiConfig {
  static const String defaultBaseUrl = 'http://localhost:8080';
  static String _baseUrl = defaultBaseUrl;

  static String get baseUrl => _baseUrl;
  static void setBaseUrlSync(String url) => _baseUrl = url;

  static const String logout = '/auth/logout';
  static const String me = '/accounts/me';
  static const String isFirstTimeSetup = '/service/is-fts';
  static const String sessionList = '/sessions/list';
  static String sessionRevoke(String id) => '/sessions/$id';
}
