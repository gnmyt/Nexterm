class SessionModel {
  final String id;
  final String? userAgent;
  final String? ip;
  final DateTime? createdAt;
  final DateTime? lastActivity;
  final bool? current;

  SessionModel({
    required this.id,
    this.userAgent,
    this.ip,
    this.createdAt,
    this.lastActivity,
    this.current,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) => SessionModel(
    id: json['id'].toString(),
    userAgent: json['userAgent'] as String?,
    ip: json['ip'] as String?,
    createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    lastActivity: json['lastActivity'] != null ? DateTime.tryParse(json['lastActivity']) : null,
    current: json['current'] as bool?,
  );
}
