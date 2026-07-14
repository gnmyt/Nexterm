import 'package:flutter/foundation.dart';
import '../services/ai_service.dart';

class AIManager extends ChangeNotifier {
  AISettings? _settings;
  bool _loading = false;
  String? _error;

  AISettings? get settings => _settings;
  bool get isLoading => _loading;
  String? get error => _error;
  bool get isAvailable => _settings?.isAvailable ?? false;

  Future<void> loadSettings(String token) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _settings = await AIService.getSettings(token);
    } catch (e) {
      _error = e.toString();
      _settings = null;
    }

    _loading = false;
    notifyListeners();
  }

  void clear() {
    _settings = null;
    _error = null;
    _loading = false;
    notifyListeners();
  }
}
