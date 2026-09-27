import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SftpSettings extends ChangeNotifier {
  static const String _showHiddenFilesKey = 'sftp_showHiddenFiles';
  static const String _dimHiddenFilesKey = 'sftp_dimHiddenFiles';
  static const String _confirmBeforeDeleteKey = 'sftp_confirmBeforeDelete';
  static const String _sortFoldersFirstKey = 'sftp_sortFoldersFirst';
  static const String _exposeToFilesAppKey = 'sftp_exposeToFilesApp';

  bool _showHiddenFiles;
  bool _dimHiddenFiles;
  bool _confirmBeforeDelete;
  bool _sortFoldersFirst;
  bool _exposeToFilesApp;

  bool get showHiddenFiles => _showHiddenFiles;
  bool get dimHiddenFiles => _dimHiddenFiles;
  bool get confirmBeforeDelete => _confirmBeforeDelete;
  bool get sortFoldersFirst => _sortFoldersFirst;
  bool get exposeToFilesApp => _exposeToFilesApp;

  SftpSettings._({
    required bool showHiddenFiles,
    required bool dimHiddenFiles,
    required bool confirmBeforeDelete,
    required bool sortFoldersFirst,
    required bool exposeToFilesApp,
  })  : _showHiddenFiles = showHiddenFiles,
        _dimHiddenFiles = dimHiddenFiles,
        _confirmBeforeDelete = confirmBeforeDelete,
        _sortFoldersFirst = sortFoldersFirst,
        _exposeToFilesApp = exposeToFilesApp;

  static Future<SftpSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return SftpSettings._(
      showHiddenFiles: prefs.getBool(_showHiddenFilesKey) ?? false,
      dimHiddenFiles: prefs.getBool(_dimHiddenFilesKey) ?? true,
      confirmBeforeDelete: prefs.getBool(_confirmBeforeDeleteKey) ?? true,
      sortFoldersFirst: prefs.getBool(_sortFoldersFirstKey) ?? true,
      exposeToFilesApp: prefs.getBool(_exposeToFilesAppKey) ?? false,
    );
  }

  Future<void> setShowHiddenFiles(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = await prefs.setBool(_showHiddenFilesKey, value);
    if (stored) {
      _showHiddenFiles = value;
      notifyListeners();
    }
  }

  Future<void> setDimHiddenFiles(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = await prefs.setBool(_dimHiddenFilesKey, value);
    if (stored) {
      _dimHiddenFiles = value;
      notifyListeners();
    }
  }

  Future<void> setConfirmBeforeDelete(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = await prefs.setBool(_confirmBeforeDeleteKey, value);
    if (stored) {
      _confirmBeforeDelete = value;
      notifyListeners();
    }
  }

  Future<void> setSortFoldersFirst(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = await prefs.setBool(_sortFoldersFirstKey, value);
    if (stored) {
      _sortFoldersFirst = value;
      notifyListeners();
    }
  }

  Future<void> setExposeToFilesApp(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = await prefs.setBool(_exposeToFilesAppKey, value);
    if (stored) {
      _exposeToFilesApp = value;
      notifyListeners();
    }
  }
}
