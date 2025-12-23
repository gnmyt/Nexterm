class Server {
  final dynamic id;
  final String name;
  final String ip;
  final String? icon;
  final String? protocol;
  final String? type;
  final double? position;
  final List<int>? identities;
  final bool? online;
  final String? status;
  final int? integrationId;
  final List<Tag>? tags;

  const Server({
    this.id, required this.name, required this.ip, this.icon, this.protocol,
    this.type, this.position, this.identities, this.online, this.status, this.integrationId, this.tags,
  });

  factory Server.fromJson(Map<String, dynamic> json) => Server(
    id: json['id'],
    name: (json['name'] as String?) ?? 'Unknown Server',
    ip: (json['ip'] as String?) ?? 'N/A',
    icon: json['icon'] as String?,
    protocol: json['protocol'] as String?,
    type: json['type'] as String?,
    position: (json['position'] as num?)?.toDouble(),
    identities: (json['identities'] as List<dynamic>?)?.cast<int>(),
    online: json['online'] as bool?,
    status: json['status'] as String?,
    integrationId: json['integrationId'] as int?,
    tags: (json['tags'] as List<dynamic>?)?.map((t) => Tag.fromJson(t as Map<String, dynamic>)).toList(),
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'ip': ip, 'icon': icon, 'protocol': protocol, 'type': type,
    'position': position, 'identities': identities, 'online': online, 'status': status,
    'integrationId': integrationId, 'tags': tags?.map((t) => t.toJson()).toList(),
  };

  bool get isPve => type?.startsWith('pve-') == true;
  bool get isServer => type == 'server';
  bool get isRunning => status != null ? (status == 'running' || status == 'online') : online != false;
  bool get isStopped => status != null ? (status == 'stopped' || status == 'offline') : online == false;
}

class Tag {
  final int id;
  final String name;
  final String color;

  const Tag({required this.id, required this.name, required this.color});

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
    id: json['id'] as int,
    name: json['name'] as String,
    color: json['color'] as String,
  );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'color': color};
}
