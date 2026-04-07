class SftpEntry {
  final String name;
  final bool isDir;
  final bool isSymlink;
  final int size;
  final int mtime;
  final int mode;

  const SftpEntry({
    required this.name,
    required this.isDir,
    this.isSymlink = false,
    this.size = 0,
    this.mtime = 0,
    this.mode = 0,
  });

  factory SftpEntry.fromJson(Map<String, dynamic> json) => SftpEntry(
        name: json['name'] as String? ?? '',
        isDir: json['type'] == 'folder' || (json['isDir'] as bool? ?? false),
        isSymlink: json['isSymlink'] as bool? ?? false,
        size: (json['size'] as num?)?.toInt() ?? 0,
        mtime: (json['last_modified'] as num?)?.toInt() ??
            (json['mtime'] as num?)?.toInt() ??
            0,
        mode: (json['mode'] as num?)?.toInt() ?? 0,
      );

  String get formattedSize {
    if (isDir) return '';
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    if (size < 1024 * 1024 * 1024) {
      return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  DateTime get modifiedDate =>
      DateTime.fromMillisecondsSinceEpoch(mtime * 1000);

  String get extension {
    if (isDir) return '';
    final dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(dot + 1).toLowerCase() : '';
  }
}
