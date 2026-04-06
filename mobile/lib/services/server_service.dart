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
      } else if (type == 'server' && _isSupportedServer(entry)) {
        filtered.add(entry);
      } else if (_isPveEntry(type)) {
        filtered.add(entry);
      }
    }
    return filtered;
  }

  static bool _isSupportedServer(Map<String, dynamic> entry) {
    return entry['type'] == 'server';
  }

  static bool isGuacamoleServer(Map<String, dynamic>? entry) {
    if (entry == null) return false;
    final protocol = (entry['protocol'] as String?)?.toLowerCase();
    return protocol == 'rdp' || protocol == 'vnc';
  }

  static bool isGuacamoleProtocol(String? protocol) {
    final p = protocol?.toLowerCase();
    return p == 'rdp' || p == 'vnc';
  }
}
