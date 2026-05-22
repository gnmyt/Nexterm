import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/session_model.dart';
import '../services/auth_service.dart';
import '../utils/auth_manager.dart';

class SessionsScreen extends StatefulWidget {
  final AuthManager authManager;
  const SessionsScreen({super.key, required this.authManager});
  @override State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  List<SessionModel>? _sessions;
  bool _loading = false;
  final _auth = AuthService();

  @override void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final token = widget.authManager.sessionToken;
    if (token != null) {
      final sessions = await _auth.listSessions(token);
      if (mounted) setState(() { _sessions = sessions; _loading = false; });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _revoke(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke Session'),
        content: const Text('Are you sure you want to end this session?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Revoke')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final token = widget.authManager.sessionToken;
    if (token == null) return;
    final success = await _auth.revokeSession(token, id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(success ? 'Session revoked' : 'Failed to revoke session'),
      behavior: SnackBarBehavior.floating));
    if (success) _load();
  }

  IconData _icon(String? ua) {
    if (ua == null) return MdiIcons.devices;
    if (ua.startsWith('NextermConnector/')) return MdiIcons.application;
    if (ua.startsWith('NextermMobile/')) return MdiIcons.cellphoneLink;
    final l = ua.toLowerCase();
    if (l.contains('mobile') || l.contains('android') || l.contains('iphone')) return MdiIcons.cellphone;
    if (l.contains('tablet') || l.contains('ipad')) return MdiIcons.tablet;
    if (l.contains('mac') || l.contains('windows') || l.contains('linux')) return MdiIcons.laptop;
    return MdiIcons.devices;
  }

  String _ago(DateTime? d) {
    if (d == null) return 'Unknown';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.day}/${d.month}/${d.year}';
  }

  String _device(String? ua) {
    if (ua == null) return 'Unknown Device';
    final conn = RegExp(r'^NextermConnector/([\d.]+)\s*\(([^;]+);').firstMatch(ua);
    if (conn != null) return 'Connector ${conn.group(1)} · ${conn.group(2)?.trim()}';
    final mobile = RegExp(r'^NextermMobile/([\d.]+)\s*\(([^;)]+)').firstMatch(ua);
    if (mobile != null) {
      final p = mobile.group(2)?.trim() ?? '';
      return 'Mobile ${mobile.group(1)} · ${p.isNotEmpty ? p[0].toUpperCase() + p.substring(1) : p}';
    }
    for (final b in ['Chrome', 'Firefox', 'Safari', 'Edge']) {
      if (ua.contains(b) && (b != 'Safari' || !ua.contains('Chrome'))) {
        for (final os in ['Windows', 'Mac', 'Linux', 'Android', 'iPhone', 'iPad']) {
          if (ua.contains(os)) return '$b · $os';
        }
        return b;
      }
    }
    return 'Unknown Device';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 4),
            child: Row(children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
              const SizedBox(width: 4),
              Expanded(child: Text('Active Sessions', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
              IconButton(icon: Icon(MdiIcons.refresh, size: 22), onPressed: _load),
            ]),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(onRefresh: _load, child: _sessions == null || _sessions!.isEmpty ? _empty(cs, tt) : _list(cs)),
          ),
        ]),
      ),
    );
  }

  Widget _empty(ColorScheme cs, TextTheme tt) => ListView(children: [SizedBox(
    height: MediaQuery.of(context).size.height * 0.5,
    child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: cs.surfaceContainerHigh, shape: BoxShape.circle),
        child: Icon(MdiIcons.monitor, size: 32, color: cs.outline),
      ),
      const SizedBox(height: 20),
      Text('No other sessions', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      Text('Only this device is active', style: tt.bodySmall?.copyWith(color: cs.outline)),
    ])),
  )]);

  Widget _list(ColorScheme cs) => ListView.builder(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
    itemCount: _sessions!.length,
    itemBuilder: (_, i) => _sessionTile(_sessions![i], cs),
  );

  Widget _sessionTile(SessionModel s, ColorScheme cs) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(12)),
          child: Icon(_icon(s.userAgent), color: cs.onPrimaryContainer, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(_device(s.userAgent), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
          Padding(padding: const EdgeInsets.only(top: 3),
            child: Text('${s.ip ?? 'Unknown IP'} · ${_ago(s.lastActivity)}',
              style: TextStyle(fontSize: 12, color: cs.outline), overflow: TextOverflow.ellipsis)),
        ])),
        const SizedBox(width: 8),
        Material(
          color: cs.errorContainer,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: () => _revoke(s.id),
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(MdiIcons.deleteOutline, size: 18, color: cs.onErrorContainer),
            ),
          ),
        ),
      ]),
    ),
  );
}
