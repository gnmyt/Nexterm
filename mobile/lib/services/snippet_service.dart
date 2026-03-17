import 'dart:convert';
import '../models/snippet.dart';
import '../utils/api_client.dart';

class SnippetService {
  static Future<List<Snippet>> getSnippetList(String token) async {
    final response = await ApiClient.get('/snippets/all', token: token);
    if (response.statusCode == 200) {
      return (jsonDecode(response.body) as List).map((json) => Snippet.fromJson(json)).toList();
    }
    throw Exception('Failed to load snippets: ${response.statusCode}');
  }
}
