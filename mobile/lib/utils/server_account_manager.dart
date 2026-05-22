import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/server_account.dart';
import '../services/api_config.dart';

class ServerAccountManager extends ChangeNotifier {
  static const _accountsKey = 'server_accounts';
  static const _activeKey = 'active_account_id';

  List<ServerAccount> _accounts = [];
  String? _activeAccountId;

  List<ServerAccount> get accounts => List.unmodifiable(_accounts);
  String? get activeAccountId => _activeAccountId;
  bool get hasAccounts => _accounts.isNotEmpty;

  ServerAccount? get activeAccount {
    if (_activeAccountId == null) return _accounts.isNotEmpty ? _accounts.first : null;
    return _accounts.cast<ServerAccount?>().firstWhere((a) => a!.id == _activeAccountId, orElse: () => _accounts.isNotEmpty ? _accounts.first : null);
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_accountsKey);
    _activeAccountId = prefs.getString(_activeKey);
    if (json != null) {
      _accounts = ServerAccount.decodeList(json);
    }
    final active = activeAccount;
    if (active != null) ApiConfig.setBaseUrlSync(active.baseUrl);
    notifyListeners();
  }

  Future<void> addAccount(ServerAccount account) async {
    _accounts.add(account);
    await _save();
  }

  Future<void> removeAccount(String id) async {
    _accounts.removeWhere((a) => a.id == id);
    if (_activeAccountId == id) {
      _activeAccountId = _accounts.isNotEmpty ? _accounts.first.id : null;
      final active = activeAccount;
      if (active != null) ApiConfig.setBaseUrlSync(active.baseUrl);
    }
    await _save();
    notifyListeners();
  }

  Future<void> switchAccount(String id) async {
    _activeAccountId = id;
    final account = _accounts.firstWhere((a) => a.id == id);
    ApiConfig.setBaseUrlSync(account.baseUrl);
    await _save();
    notifyListeners();
  }

  Future<void> updateAccount(ServerAccount updated) async {
    final i = _accounts.indexWhere((a) => a.id == updated.id);
    if (i != -1) { _accounts[i] = updated; await _save(); notifyListeners(); }
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accountsKey, ServerAccount.encodeList(_accounts));
    if (_activeAccountId != null) {
      await prefs.setString(_activeKey, _activeAccountId!);
    } else {
      await prefs.remove(_activeKey);
    }
  }
}
