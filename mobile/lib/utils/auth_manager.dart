import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../models/server_account.dart';
import 'server_account_manager.dart';

class AuthManager extends ChangeNotifier {
  final ServerAccountManager _accountManager;
  final _authService = AuthService();

  bool get isAuthenticated => _accountManager.activeAccount != null;
  String? get sessionToken => _accountManager.activeAccount?.token;
  ServerAccountManager get accountManager => _accountManager;

  AuthManager(this._accountManager) {
    _accountManager.addListener(_onAccountChanged);
  }

  void _onAccountChanged() => notifyListeners();

  Future<void> loginWithToken(String token, {required String baseUrl, required String label}) async {
    final userInfo = await _authService.getCurrentUser(token);
    final account = ServerAccount(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      label: label, baseUrl: baseUrl, token: token,
      username: userInfo?.username, fullName: userInfo?.fullName,
    );
    await _accountManager.addAccount(account);
    await _accountManager.switchAccount(account.id);
    notifyListeners();
  }

  Future<void> logout() async => removeAccount(_accountManager.activeAccountId!);

  Future<void> removeAccount(String id) async {
    final account = _accountManager.accounts.firstWhere((a) => a.id == id);
    try { await _authService.logout(account.token); } catch (_) {}
    await _accountManager.removeAccount(id);
    notifyListeners();
  }

  Future<void> switchAccount(String id) async => _accountManager.switchAccount(id);

  String? getUsername() => _accountManager.activeAccount?.username;
  String getFullName() => _accountManager.activeAccount?.fullName ?? _accountManager.activeAccount?.username ?? 'User';

  @override
  void dispose() {
    _accountManager.removeListener(_onAccountChanged);
    super.dispose();
  }
}
