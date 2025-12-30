import 'dart:convert';
import '../models/auth_models.dart';
import '../models/session_model.dart';
import '../utils/api_client.dart';
import 'api_config.dart';

class AuthService {
  Future<bool> register(RegisterRequest request) async {
    try {
      final response = await ApiClient.post(ApiConfig.register, body: request.toJson());
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> logout(String token) async {
    try {
      final response = await ApiClient.post(ApiConfig.logout, body: LogoutRequest(token: token).toJson());
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<UserInfo?> getCurrentUser(String token) async {
    try {
      final response = await ApiClient.get(ApiConfig.me, token: token);
      return response.statusCode == 200 ? UserInfo.fromJson(jsonDecode(response.body)) : null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> isFirstTimeSetup() async {
    try {
      final response = await ApiClient.get(ApiConfig.isFirstTimeSetup);
      return response.statusCode == 200 ? jsonDecode(response.body) as bool : false;
    } catch (_) {
      return false;
    }
  }

  Future<List<SessionModel>> listSessions(String token) async {
    try {
      final response = await ApiClient.get(ApiConfig.sessionList, token: token);
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as List).map((json) => SessionModel.fromJson(json)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<bool> revokeSession(String token, String sessionId) async {
    try {
      final response = await ApiClient.delete(ApiConfig.sessionRevoke(sessionId), token: token);
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
