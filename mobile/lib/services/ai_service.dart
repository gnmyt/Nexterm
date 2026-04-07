import 'dart:convert';
import '../utils/api_client.dart';

class AISettings {
  final bool enabled;
  final String? provider;
  final String? model;
  final bool hasApiKey;

  AISettings({
    required this.enabled,
    this.provider,
    this.model,
    this.hasApiKey = false,
  });

  factory AISettings.fromJson(Map<String, dynamic> json) => AISettings(
    enabled: json['enabled'] == true,
    provider: json['provider'] as String?,
    model: json['model'] as String?,
    hasApiKey: json['hasApiKey'] == true,
  );

  bool get isAvailable {
    if (!enabled || provider == null || model == null) return false;
    if (provider == 'openai' && !hasApiKey) return false;
    return true;
  }
}

class AIService {
  static Future<AISettings> getSettings(String token) async {
    final response = await ApiClient.get('/ai', token: token);
    if (response.statusCode == 200) {
      return AISettings.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to load AI settings: ${response.statusCode}');
  }

  static Future<String> generateCommand({
    required String token,
    required String prompt,
    int? entryId,
    String? recentOutput,
  }) async {
    final body = <String, dynamic>{'prompt': prompt};
    if (entryId != null) body['entryId'] = entryId;
    if (recentOutput != null && recentOutput.isNotEmpty) {
      body['recentOutput'] = recentOutput.length > 5000
          ? recentOutput.substring(recentOutput.length - 5000)
          : recentOutput;
    }

    final response = await ApiClient.post(
      '/ai/generate',
      token: token,
      body: body,
      timeout: const Duration(seconds: 60),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['command'] as String;
    }
    throw Exception('AI generation failed: ${response.statusCode}');
  }
}
