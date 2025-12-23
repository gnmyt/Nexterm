import 'package:flutter/foundation.dart';
import '../models/snippet.dart';
import '../services/snippet_service.dart';

class SnippetManager extends ChangeNotifier {
  List<Snippet> _snippets = [];
  bool _isLoaded = false;
  bool _isLoading = false;
  String? _error;

  List<Snippet> get snippets => _snippets;
  bool get isLoaded => _isLoaded;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadSnippets(String token, {bool forceRefresh = false}) async {
    if (!forceRefresh && (_isLoaded || _isLoading)) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _snippets = await SnippetService.getSnippetList(token);
      _isLoaded = true;
    } catch (e) {
      _error = e.toString();
      _isLoaded = false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> reloadSnippets(String token) => loadSnippets(token, forceRefresh: true);

  void clear() {
    _snippets = [];
    _isLoaded = false;
    _error = null;
    notifyListeners();
  }
}
