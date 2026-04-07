import 'dart:async';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/monitoring.dart';
import '../services/monitoring_service.dart';
import '../utils/auth_manager.dart';

class MonitoringScreen extends StatefulWidget {
  final AuthManager authManager;
  const MonitoringScreen({super.key, required this.authManager});
  @override State<MonitoringScreen> createState() => MonitoringScreenState();
}

class MonitoringScreenState extends State<MonitoringScreen> {
  List<M> _servers = [];
  M? _selected;
  M? _details;
  bool _loading = true, _loadingDetails = false;
  String? _error;
  Timer? _timer;

  bool get hasDetails => _selected != null;

  bool goBack() {
    if (_selected != null) {
      setState(() { _selected = null; _details = null; });
      return true;
    }
    return false;
  }

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

  int get _onlineCount => _servers.where((s) => s.hasData && s.error == null).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: _selected != null ? _detailsView() : _mainView(),
        ),
      ),
    );
  }

  Widget _mainView() => Column(key: const ValueKey('list'), children: [
    _buildHeader(),
    Expanded(
      child: _loading ? const Center(child: CircularProgressIndicator())
          : _error != null ? _errView()
          : _servers.isEmpty ? _emptyView()
          : _listView(),
    ),
  ]);

  Widget _buildHeader() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Monitoring', style: tt.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
          if (!_loading && _error == null && _servers.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 2),
              child: Text('$_onlineCount of ${_servers.length} reporting', style: tt.bodySmall?.copyWith(color: cs.outline))),
        ])),
      ]),
    );
  }

  Widget _errView() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: cs.errorContainer, shape: BoxShape.circle),
        child: Icon(MdiIcons.alertCircleOutline, size: 32, color: cs.onErrorContainer),
      ),
      const SizedBox(height: 20),
      Text('Something went wrong', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      Text(_error!, style: tt.bodySmall?.copyWith(color: cs.outline), textAlign: TextAlign.center),
      const SizedBox(height: 24),
      FilledButton.icon(onPressed: _load, icon: Icon(MdiIcons.refresh, size: 18), label: const Text('Retry'),
        style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
    ])));
  }

  Widget _emptyView() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return RefreshIndicator(onRefresh: _load, child: ListView(children: [SizedBox(
      height: MediaQuery.of(context).size.height * 0.5,
      child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: cs.surfaceContainerHigh, shape: BoxShape.circle),
          child: Icon(MdiIcons.chartBoxOutline, size: 32, color: cs.outline),
        ),
        const SizedBox(height: 20),
        Text('No monitoring data', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text('Enable monitoring from the web dashboard', style: tt.bodySmall?.copyWith(color: cs.outline)),
      ])),
    )]));
  }

  Widget _listView() => RefreshIndicator(
    onRefresh: _load,
    child: ListView.builder(
      padding: const EdgeInsets.only(left: 12, right: 12, bottom: 16, top: 4),
      itemCount: _servers.length,
      itemBuilder: (_, i) => _serverCard(_servers[i]),
    ),
  );

  Widget _serverCard(M s) {
    final cs = Theme.of(context).colorScheme;
    final pve = s.isPVE;
    final hasErr = s.error != null && !s.hasData;

    final (bg, fg) = hasErr
        ? (cs.surfaceContainerHighest, cs.outline)
        : pve ? (cs.tertiaryContainer, cs.onTertiaryContainer)
        : (cs.primaryContainer, cs.onPrimaryContainer);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Material(
        color: cs.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _loadDetails(s),
          child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
                child: Center(child: Icon(pve ? MdiIcons.serverNetwork : MdiIcons.server, color: fg, size: 20)),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s.str('name', 'Unknown'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                if (s['ip'] != null) Padding(padding: const EdgeInsets.only(top: 2),
                  child: Text(s.str('ip'), style: TextStyle(fontSize: 12, color: cs.outline), overflow: TextOverflow.ellipsis)),
              ])),
              Icon(MdiIcons.chevronRight, color: cs.outlineVariant, size: 18),
            ]),
            if (s.hasData) ...[
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: _miniGauge('CPU', s.cpu ?? 0, cs)),
                const SizedBox(width: 10),
                Expanded(child: _miniGauge('MEM', s.mem ?? 0, cs)),
              ]),
            ] else if (s.error != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: cs.errorContainer.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(8)),
                child: Row(children: [
                  Icon(MdiIcons.alertOutline, size: 14, color: cs.error),
                  const SizedBox(width: 6),
                  Expanded(child: Text(s.error!, style: TextStyle(fontSize: 11, color: cs.error), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ]),
              ),
            ],
          ])),
        ),
      ),
    );
  }

  Widget _miniGauge(String label, double v, ColorScheme cs) {
    final color = v > 80 ? cs.error : v > 60 ? Colors.orange : cs.primary;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: cs.surfaceContainerHighest, borderRadius: BorderRadius.circular(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: cs.outline)),
          Text('${v.toStringAsFixed(1)}%', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(
          value: (v / 100).clamp(0.0, 1.0), minHeight: 5, backgroundColor: cs.surfaceContainerHigh, color: color,
        )),
      ]),
    );
  }

  Widget _detailsView() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final s = _selected!;

    return Column(key: const ValueKey('detail'), children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
        child: Row(children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => setState(() { _selected = null; _details = null; }),
          ),
          const SizedBox(width: 4),
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: s.isPVE ? cs.tertiaryContainer : cs.primaryContainer,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(s.isPVE ? MdiIcons.serverNetwork : MdiIcons.server,
              color: s.isPVE ? cs.onTertiaryContainer : cs.onPrimaryContainer, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.str('name', 'Unknown'), style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            if (s['ip'] != null) Text(s.str('ip'), style: tt.bodySmall?.copyWith(color: cs.outline)),
          ])),
        ]),
      ),
      const SizedBox(height: 4),
      Expanded(
        child: _loadingDetails
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(onRefresh: () => _loadDetails(s), child: _detailsContent()),
      ),
    ]);
  }

  Widget _detailsContent() {
    final d = _details, latest = d?.sub('latest'), os = latest?.sub('osInfo'), s = _selected!;
    return ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
      _section(s.isPVE ? 'Cluster Info' : 'System Info', s.isPVE ? [
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
      const SizedBox(height: 12),
      _section('Performance', [
        _bar('CPU Usage', latest?.d('cpuUsage') ?? 0, Theme.of(context).colorScheme.primary),
        const SizedBox(height: 14),
        _bar('Memory Usage', latest?.d('memoryUsage') ?? 0, Colors.green),
        if (latest?.n('processes') != null) ...[const SizedBox(height: 14), _row('Processes', '${latest!.n('processes')}')],
        if (latest?.doubles('loadAverage').isNotEmpty == true) ...[const SizedBox(height: 14), _row('Load Average', latest!.doubles('loadAverage').map((l) => l.toStringAsFixed(2)).join(', '))],
      ]),
      if (s.isPVE && os?.list('nodes').isNotEmpty == true) ...[const SizedBox(height: 12), _nodesSection(os!.list('nodes'))],
    ]);
  }

  Widget _section(String title, List<Widget> children) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: cs.onSurface)),
        const SizedBox(height: 12),
        ...children,
      ]),
    );
  }

  Widget _row(String l, String v) {
    final cs = Theme.of(context).colorScheme;
    return Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(l, style: TextStyle(fontSize: 13, color: cs.outline)),
      Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
    ]));
  }

  Widget _bar(String l, double v, Color c, {double h = 8}) {
    final cs = Theme.of(context).colorScheme;
    final color = v > 80 ? cs.error : v > 60 ? Colors.orange : c;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(l, style: TextStyle(fontSize: 12, color: cs.outline)),
        Text('${v.toStringAsFixed(1)}%', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      ]),
      const SizedBox(height: 6),
      ClipRRect(borderRadius: BorderRadius.circular(h / 2), child: LinearProgressIndicator(
        value: (v / 100).clamp(0.0, 1.0), minHeight: h, backgroundColor: cs.surfaceContainerHighest, color: color,
      )),
    ]);
  }

  Widget _nodesSection(List<M> nodes) {
    final cs = Theme.of(context).colorScheme;
    return _section('Nodes', nodes.map((n) {
      final online = n.isOnline;
      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: cs.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                color: online ? cs.primaryContainer : cs.errorContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(MdiIcons.serverNetwork, size: 14, color: online ? cs.onPrimaryContainer : cs.onErrorContainer),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(n.str('name'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: online ? const Color(0xFF4CAF50).withValues(alpha: 0.15) : cs.errorContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(n.str('status'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                color: online ? const Color(0xFF4CAF50) : cs.error)),
            ),
          ]),
          if (online) ...[
            const SizedBox(height: 12),
            _bar('CPU', n.d('cpuUsage') ?? 0, cs.primary, h: 5),
            const SizedBox(height: 8),
            _bar('Memory', n.d('memoryUsage') ?? 0, Colors.green, h: 5),
            const SizedBox(height: 8),
            _bar('Storage', n.d('diskUsage') ?? 0, Colors.orange, h: 5),
          ],
        ]),
      );
    }).toList());
  }

  String _uptime(int? s) => s == null ? 'Unknown' : s >= 86400 ? '${s ~/ 86400}d ${(s % 86400) ~/ 3600}h' : s >= 3600 ? '${s ~/ 3600}h ${(s % 3600) ~/ 60}m' : '${s ~/ 60}m';
  String _bytes(int? b) => b == null || b == 0 ? '0 B' : b < 1024 ? '$b B' : b < 1048576 ? '${(b / 1024).toStringAsFixed(1)} KB' : b < 1073741824 ? '${(b / 1048576).toStringAsFixed(1)} MB' : '${(b / 1073741824).toStringAsFixed(2)} GB';
}
