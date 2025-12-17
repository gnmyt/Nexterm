import 'dart:async';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/monitoring.dart';
import '../services/monitoring_service.dart';
import '../utils/auth_manager.dart';

class MonitoringScreen extends StatefulWidget {
  final AuthManager authManager;
  const MonitoringScreen({super.key, required this.authManager});
  @override State<MonitoringScreen> createState() => _MonitoringScreenState();
}

class _MonitoringScreenState extends State<MonitoringScreen> {
  List<M> _servers = [];
  M? _selected;
  M? _details;
  bool _loading = true, _loadingDetails = false;
  String? _error;
  Timer? _timer;

  @override void initState() { super.initState(); _load(); _timer = Timer.periodic(const Duration(seconds: 60), (_) => _load(silent: true)); }
  @override void dispose() { _timer?.cancel(); super.dispose(); }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final token = widget.authManager.sessionToken ?? (throw Exception('Not authenticated'));
      final servers = await MonitoringService.getAll(token);
      if (!mounted) return;
      setState(() { _servers = servers; _loading = false; _error = null; });
      if (_selected != null) _selected = servers.firstWhere((s) => s['id'] == _selected!['id'], orElse: () => _selected!);
    } catch (e) { if (mounted) setState(() { _error = e.toString(); _loading = false; }); }
  }

  Future<void> _loadDetails(M server) async {
    setState(() { _selected = server; _loadingDetails = true; });
    try {
      final token = widget.authManager.sessionToken ?? (throw Exception('Not authenticated'));
      final details = await MonitoringService.getDetails(token, server['id']);
      if (mounted) setState(() { _details = details; _loadingDetails = false; });
    } catch (_) { if (mounted) setState(() => _loadingDetails = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(_selected?.str('name') ?? 'Monitoring'),
      leading: _selected != null ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() { _selected = null; _details = null; })) : null,
    ),
    body: _loading ? const Center(child: CircularProgressIndicator())
        : _error != null ? _errView()
        : _selected != null ? _detailsView()
        : _listView(),
  );

  Widget _errView() => Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    Icon(MdiIcons.alertCircleOutline, size: 48, color: Theme.of(context).colorScheme.error),
    const SizedBox(height: 16), Text(_error!, textAlign: TextAlign.center),
    const SizedBox(height: 24), FilledButton.icon(onPressed: _load, icon: Icon(MdiIcons.refresh), label: const Text('Retry')),
  ])));

  Widget _listView() => _servers.isEmpty
      ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(MdiIcons.monitorDashboard, size: 64, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 16), Text('No servers with monitoring enabled', style: TextStyle(color: Theme.of(context).colorScheme.outline)),
        ]))
      : RefreshIndicator(onRefresh: _load, child: ListView.builder(
          padding: const EdgeInsets.all(8), itemCount: _servers.length,
          itemBuilder: (_, i) => _serverCard(_servers[i]),
        ));

  Widget _serverCard(M s) {
    final t = Theme.of(context);
    final pve = s.isPVE;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _loadDetails(s),
        child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 44, height: 44, decoration: BoxDecoration(color: pve ? t.colorScheme.tertiaryContainer : t.colorScheme.primaryContainer, borderRadius: BorderRadius.circular(10)),
              child: Icon(pve ? MdiIcons.serverNetwork : MdiIcons.server, color: pve ? t.colorScheme.onTertiaryContainer : t.colorScheme.onPrimaryContainer)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.str('name', 'Unknown'), style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              if (s['ip'] != null) Text(s.str('ip'), style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline)),
            ])),
            Icon(MdiIcons.chevronRight, color: t.colorScheme.outline),
          ]),
          if (s.hasData) ...[const SizedBox(height: 16), Row(children: [
            Expanded(child: _miniBar('CPU', s.cpu ?? 0, t)),
            const SizedBox(width: 12),
            Expanded(child: _miniBar('Memory', s.mem ?? 0, t)),
          ])] else if (s.error != null) ...[const SizedBox(height: 12), Text(s.error!, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.error))],
        ])),
      ),
    );
  }

  Widget _miniBar(String label, double v, ThemeData t) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline)),
      Text('${v.toStringAsFixed(1)}%', style: t.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
    ]),
    const SizedBox(height: 4),
    ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(
      value: v / 100, minHeight: 6, backgroundColor: t.colorScheme.surfaceContainerHighest,
      color: v > 80 ? t.colorScheme.error : v > 60 ? Colors.orange : t.colorScheme.primary,
    )),
  ]);

  Widget _detailsView() {
    if (_loadingDetails) return const Center(child: CircularProgressIndicator());
    final d = _details, latest = d?.sub('latest'), os = latest?.sub('osInfo'), s = _selected!;
    return RefreshIndicator(onRefresh: () => _loadDetails(s), child: ListView(padding: const EdgeInsets.all(16), children: [
      _card(s.isPVE ? 'Cluster Info' : 'System Info', s.isPVE ? [
        _row('Nodes', '${os?.n('onlineNodes') ?? 0} / ${os?.n('totalNodes') ?? 0} online'),
        _row('Total CPU', '${os?.n('totalCpu') ?? 0} cores'),
        _row('Total Memory', _bytes(os?.n('totalMemory'))),
        _row('VMs', '${os?.n('runningVMs') ?? 0} / ${os?.n('vmCount') ?? 0} running'),
        _row('Containers', '${os?.n('runningLXC') ?? 0} / ${os?.n('lxcCount') ?? 0} running'),
        _row('Uptime', _uptime(latest?.n('uptime'))),
      ] : [
        _row('Hostname', os?.str('hostname', 'Unknown') ?? 'Unknown'),
        _row('OS', os?.str('name', 'Unknown') ?? 'Unknown'),
        _row('Version', os?.str('version', 'Unknown') ?? 'Unknown'),
        _row('Kernel', os?.str('kernel', 'Unknown') ?? 'Unknown'),
        _row('Architecture', os?.str('architecture', 'Unknown') ?? 'Unknown'),
        _row('Uptime', _uptime(latest?.n('uptime'))),
      ]),
      const SizedBox(height: 16),
      _card('Performance', [
        _bar('CPU Usage', latest?.d('cpuUsage') ?? 0, Theme.of(context).colorScheme.primary),
        const SizedBox(height: 12),
        _bar('Memory Usage', latest?.d('memoryUsage') ?? 0, Colors.green),
        if (latest?.n('processes') != null) ...[const SizedBox(height: 12), _row('Processes', '${latest!.n('processes')}')],
        if (latest?.doubles('loadAverage').isNotEmpty == true) ...[const SizedBox(height: 12), _row('Load Average', latest!.doubles('loadAverage').map((l) => l.toStringAsFixed(2)).join(', '))],
      ]),
      if (s.isPVE && os?.list('nodes').isNotEmpty == true) ...[const SizedBox(height: 16), _nodesCard(os!.list('nodes'))],
    ]));
  }

  Widget _card(String title, List<Widget> children) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
    const SizedBox(height: 12), ...children,
  ])));

  Widget _row(String l, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
    Text(l, style: TextStyle(color: Theme.of(context).colorScheme.outline)),
    Text(v, style: const TextStyle(fontWeight: FontWeight.w500)),
  ]));

  Widget _bar(String l, double v, Color c, {double h = 8}) {
    final t = Theme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(l, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline)),
        Text('${v.toStringAsFixed(1)}%', style: t.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 4),
      ClipRRect(borderRadius: BorderRadius.circular(h / 2), child: LinearProgressIndicator(
        value: (v / 100).clamp(0.0, 1.0), minHeight: h, backgroundColor: t.colorScheme.surfaceContainerHighest,
        color: v > 80 ? t.colorScheme.error : v > 60 ? Colors.orange : c,
      )),
    ]);
  }

  Widget _nodesCard(List<M> nodes) => _card('Nodes', nodes.map((n) {
    final t = Theme.of(context), online = n.isOnline;
    return Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: t.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(n.str('name'), style: t.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const Spacer(),
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: online ? Colors.green.withValues(alpha: 0.2) : t.colorScheme.errorContainer, borderRadius: BorderRadius.circular(12)),
            child: Text(n.str('status'), style: t.textTheme.bodySmall?.copyWith(color: online ? Colors.green : t.colorScheme.error))),
        ]),
        if (online) ...[const SizedBox(height: 12), _bar('CPU', n.d('cpuUsage') ?? 0, t.colorScheme.primary, h: 4), const SizedBox(height: 8), _bar('Memory', n.d('memoryUsage') ?? 0, Colors.green, h: 4), const SizedBox(height: 8), _bar('Storage', n.d('diskUsage') ?? 0, Colors.orange, h: 4)],
      ]),
    );
  }).toList());

  String _uptime(int? s) => s == null ? 'Unknown' : s >= 86400 ? '${s ~/ 86400}d ${(s % 86400) ~/ 3600}h' : s >= 3600 ? '${s ~/ 3600}h ${(s % 3600) ~/ 60}m' : '${s ~/ 60}m';
  String _bytes(int? b) => b == null || b == 0 ? '0 B' : b < 1024 ? '$b B' : b < 1048576 ? '${(b / 1024).toStringAsFixed(1)} KB' : b < 1073741824 ? '${(b / 1048576).toStringAsFixed(1)} MB' : '${(b / 1073741824).toStringAsFixed(2)} GB';
}
