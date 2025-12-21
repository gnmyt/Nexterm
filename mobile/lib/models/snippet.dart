class Snippet {
  final int id;
  final String name;
  final int accountId;
  final String command;
  final String? description;

  const Snippet({required this.id, required this.name, required this.accountId, required this.command, this.description});

  factory Snippet.fromJson(Map<String, dynamic> json) => Snippet(
    id: json['id'] as int,
    name: json['name'] as String? ?? '',
    accountId: json['accountId'] as int,
    command: json['command'] as String? ?? '',
    description: json['description'] as String?,
  );
}
