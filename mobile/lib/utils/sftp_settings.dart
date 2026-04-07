import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SftpSettings extends ChangeNotifier {
  static const String _showHiddenFilesKey = 'sftp_showHiddenFiles';
  static const String _confirmBeforeDeleteKey = 'sftp_confirmBeforeDelete';
  static const String _sortFoldersFirstKey = 'sftp_sortFoldersFirst';

  bool _showHiddenFiles;
  bool _confirmBeforeDelete;
  bool _sortFoldersFirst;

  bool get showHiddenFiles => _showHiddenFiles;
  bool get confirmBeforeDelete => _confirmBeforeDelete;
  bool get sortFoldersFirst => _sortFoldersFirst;

  SftpSettings._({
    required bool showHiddenFiles,
    required bool confirmBeforeDelete,
    required bool sortFoldersFirst,
  })  : _showHiddenFiles = showHiddenFiles,
        _confirmBeforeDelete = confirmBeforeDelete,
        _sortFoldersFirst = sortFoldersFirst;

  static Future<SftpSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return SftpSettings._(
      showHiddenFiles: prefs.getBool(_showHiddenFilesKey) ?? false,
      confirmBeforeDelete: prefs.getBool(_confirmBeforeDeleteKey) ?? true,
      sortFoldersFirst: prefs.getBool(_sortFoldersFirstKey) ?? true,
    );
  }

  Future<void> setShowHiddenFiles(bool value) async {
    _showHiddenFiles = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_showHiddenFilesKey, value);
    notifyListeners();
  }

  Future<void> setConfirmBeforeDelete(bool value) async {
    _confirmBeforeDelete = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_confirmBeforeDeleteKey, value);
    notifyListeners();
  }

  Future<void> setSortFoldersFirst(bool value) async {
    _sortFoldersFirst = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_sortFoldersFirstKey, value);
    notifyListeners();
  }
}
