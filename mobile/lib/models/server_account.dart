import 'dart:convert';

class ServerAccount {
  final String id, baseUrl, token;
  String label;
  final String? username, fullName;

  ServerAccount({required this.id, required this.label, required this.baseUrl, required this.token, this.username, this.fullName});

  String get displayUrl => baseUrl.replaceAll(RegExp(r'https?://'), '').replaceAll('/api', '');

  Map<String, dynamic> toJson() => {'id': id, 'label': label, 'baseUrl': baseUrl, 'token': token, 'username': username, 'fullName': fullName};

  factory ServerAccount.fromJson(Map<String, dynamic> j) => ServerAccount(
    id: j['id'], label: j['label'], baseUrl: j['baseUrl'], token: j['token'], username: j['username'], fullName: j['fullName'],
  );

  static List<ServerAccount> decodeList(String s) => (jsonDecode(s) as List).map((e) => ServerAccount.fromJson(e)).toList();
  static String encodeList(List<ServerAccount> l) => jsonEncode(l.map((a) => a.toJson()).toList());
}
