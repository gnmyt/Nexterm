import 'server.dart';

class ServerFolder {
  final dynamic id;
  final String name;
  final String type;
  final double? position;
  final dynamic organizationId;
  final bool? requireConnectionReason;
  final List<dynamic> entries;
  bool isExpanded;
  final String? ip;
  final String? icon;
  final String? folderType;

  ServerFolder({
    this.id, required this.name, this.type = 'folder', this.position, this.organizationId,
    this.requireConnectionReason, this.entries = const [], this.isExpanded = false,
    this.ip, this.icon, this.folderType,
  });

  factory ServerFolder.fromJson(Map<String, dynamic> json) => ServerFolder(
    id: json['id'],
    name: json['name'] as String,
    type: json['type'] as String? ?? 'folder',
    position: (json['position'] as num?)?.toDouble(),
    organizationId: json['organizationId'],
    requireConnectionReason: json['requireConnectionReason'] as bool?,
    entries: json['entries'] as List<dynamic>? ?? [],
    ip: json['ip'] as String?,
    icon: json['icon'] as String?,
    folderType: json['folderType'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'type': type, 'position': position,
    'organizationId': organizationId, 'requireConnectionReason': requireConnectionReason,
    'entries': entries, 'ip': ip, 'icon': icon, 'folderType': folderType,
  };

  List<Server> get servers => entries
      .where((e) => e is Map<String, dynamic> && e['type'] == 'server')
      .map((e) => Server.fromJson(e as Map<String, dynamic>))
      .toList();

  List<ServerFolder> get subfolders => entries
      .where((e) => e is Map<String, dynamic> && e['type'] == 'folder')
      .map((e) => ServerFolder.fromJson(e as Map<String, dynamic>))
      .toList();

  List<ServerFolder> get organizations => entries
      .where((e) => e is Map<String, dynamic> && e['type'] == 'organization')
      .map((e) => ServerFolder.fromJson(e as Map<String, dynamic>))
      .toList();

  List<Server> get pveEntries => entries
      .where((e) => e is Map<String, dynamic> && (e['type'] as String?)?.startsWith('pve-') == true)
      .map((e) => Server.fromJson(e as Map<String, dynamic>))
      .toList();

  List<Server> get allServers => [...servers, ...pveEntries];
  List<ServerFolder> get allFolders => [...subfolders, ...organizations];
  bool get isPveNode => folderType == 'pve-node';
  bool get isOrganization => type == 'organization';
}
