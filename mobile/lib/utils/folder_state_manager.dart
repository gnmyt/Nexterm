import 'package:shared_preferences/shared_preferences.dart';

class FolderStateManager {
  static const String _prefix = 'folder_expanded_';
  final SharedPreferences _prefs;

  FolderStateManager._(this._prefs);

  static Future<FolderStateManager> create() async => FolderStateManager._(await SharedPreferences.getInstance());

  bool isFolderExpanded(dynamic folderId) => folderId != null && (_prefs.getBool('$_prefix$folderId') ?? false);

  Future<void> setFolderExpanded(dynamic folderId, bool isExpanded) async {
    if (folderId != null) await _prefs.setBool('$_prefix$folderId', isExpanded);
  }

  Future<void> clearAllStates() async {
    for (final key in _prefs.getKeys().where((k) => k.startsWith(_prefix))) {
      await _prefs.remove(key);
    }
  }

  Set<String> getAllExpandedFolderIds() => _prefs.getKeys()
      .where((k) => k.startsWith(_prefix) && (_prefs.getBool(k) ?? false))
      .map((k) => k.substring(_prefix.length))
      .toSet();
}
