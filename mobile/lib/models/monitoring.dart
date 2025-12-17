class M {
  final Map<String, dynamic> _d;
  M([Map<String, dynamic>? data]) : _d = data ?? {};
  factory M.from(dynamic v) => M(v is Map ? Map<String, dynamic>.from(v) : {});

  dynamic operator [](String k) => _d[k];
  M sub(String k) => M.from(_d[k]);
  List<M> list(String k) => (_d[k] as List?)?.map((e) => M.from(e)).toList() ?? [];
  Map<String, dynamic> get raw => _d;

  String str(String k, [String d = '']) => _d[k]?.toString() ?? d;
  int? n(String k) => _d[k] is num ? (_d[k] as num).toInt() : null;
  double? d(String k) => _d[k] is num ? (_d[k] as num).toDouble() : null;
  bool flag(String k) => _d[k] == true || _d[k] == 1;
  List<double> doubles(String k) => (_d[k] as List?)?.map((e) => (e as num).toDouble()).toList() ?? [];

  bool get isPVE => str('type') == 'proxmox';
  bool get isOnline => str('status') == 'online';
  double? get cpu => d('cpuUsage') ?? sub('monitoring').d('cpuUsage');
  double? get mem => d('memoryUsage') ?? sub('monitoring').d('memoryUsage');
  String? get error => this['errorMessage']?.toString() ?? sub('monitoring')['errorMessage']?.toString();
  bool get hasData => cpu != null;
}
