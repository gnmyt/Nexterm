import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../models/auth_models.dart';

class AuthManager extends ChangeNotifier {
  bool _isAuthenticated;
  String? _sessionToken;
  UserInfo? _userInfo;
  final _authService = AuthService();

  bool get isAuthenticated => _isAuthenticated;
  String? get sessionToken => _sessionToken;
  UserInfo? get userInfo => _userInfo;

  AuthManager(bool isAuthenticated) : _isAuthenticated = isAuthenticated {
    if (isAuthenticated) _loadStoredToken();
  }

  Future<void> _loadStoredToken() async {
    final prefs = await SharedPreferences.getInstance();
    _sessionToken = prefs.getString('sessionToken');
    if (_sessionToken != null) {
      _userInfo = await _authService.getCurrentUser(_sessionToken!);
      notifyListeners();
    }
  }

  Future<void> loginWithToken(String token) async {
    _sessionToken = token;
    _isAuthenticated = true;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isLoggedIn', true);
    await prefs.setString('sessionToken', token);

    _userInfo = await _authService.getCurrentUser(token);
    notifyListeners();
  }

  Future<void> logout() async {
    if (_sessionToken != null) await _authService.logout(_sessionToken!);
    _isAuthenticated = false;
    _sessionToken = null;
    _userInfo = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isLoggedIn', false);
    await prefs.remove('sessionToken');
    await prefs.remove('username');
    notifyListeners();
  }

  Future<String?> getUsername() async {
    if (_userInfo != null) return _userInfo!.username;
    return (await SharedPreferences.getInstance()).getString('username');
  }

  Future<String> getFullName() async => _userInfo?.fullName ?? await getUsername() ?? 'User';
}
