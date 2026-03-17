import 'dart:convert';
import '../models/server_folder.dart';
import '../utils/api_client.dart';

class ServerService {
  static Future<List<ServerFolder>> getServerList(String token) async {
    final response = await ApiClient.get('/entries/list', token: token);
    if (response.statusCode != 200) {
      throw Exception('Failed to load servers: ${response.statusCode} - ${response.body}');
    }

    final List<dynamic> jsonData = json.decode(response.body);
    final List<ServerFolder> folders = [];

    for (var item in jsonData) {
      if (item is! Map<String, dynamic>) continue;
      final type = item['type'] as String?;

      if (type == 'organization' || type == 'folder') {
        final filteredItem = Map<String, dynamic>.from(item);
        filteredItem['entries'] = _filterEntries(item['entries'] as List<dynamic>? ?? []);
        if ((filteredItem['entries'] as List).isNotEmpty) {
          folders.add(ServerFolder.fromJson(filteredItem));
        }
      } else if (type == 'server' || _isPveEntry(type)) {
        folders.add(ServerFolder(name: 'Servers', type: 'folder', entries: [item]));
      }
    }
    return folders;
  }

  static bool _isPveEntry(String? type) => type == 'pve-shell' || type == 'pve-lxc';

  static List<dynamic> _filterEntries(List<dynamic> entries) {
    final List<dynamic> filtered = [];
    for (var entry in entries) {
      if (entry is! Map<String, dynamic>) continue;
      final type = entry['type'] as String? ?? '';

      if (type == 'folder' || type == 'organization') {
        final filteredEntry = Map<String, dynamic>.from(entry);
        filteredEntry['entries'] = _filterEntries(entry['entries'] as List<dynamic>? ?? []);
        if ((filteredEntry['entries'] as List).isNotEmpty) filtered.add(filteredEntry);
      } else if (type == 'server' && _isSSHServer(entry)) {
        filtered.add(entry);
      } else if (_isPveEntry(type)) {
        filtered.add(entry);
      }
    }
    return filtered;
  }

  static bool _isSSHServer(Map<String, dynamic> entry) {
    final protocol = (entry['protocol'] as String?)?.toLowerCase();
    final connectionType = (entry['connectionType'] as String?)?.toLowerCase();
    final port = entry['port'] as int?;

    if (protocol != null) {
      if (['rdp', 'vnc', 'http', 'https'].contains(protocol)) return false;
      if (protocol == 'ssh') return true;
    }
    if (connectionType != null) {
      if (['rdp', 'vnc', 'http', 'https'].contains(connectionType)) return false;
      if (connectionType == 'ssh') return true;
    }
    if (port != null) {
      if (port == 3389 || port == 80 || port == 443) return false;
      if (port >= 5900 && port <= 5999) return false;
    }
    return entry['type'] == 'server';
  }
}
