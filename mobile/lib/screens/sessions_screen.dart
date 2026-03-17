import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/session_model.dart';
import '../services/auth_service.dart';
import '../utils/auth_manager.dart';

class SessionsScreen extends StatefulWidget {
  final AuthManager authManager;

  const SessionsScreen({super.key, required this.authManager});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  List<SessionModel>? _sessions;
  bool _loading = false;
  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() => _loading = true);
    final token = widget.authManager.sessionToken;
    if (token != null) {
      final sessions = await _authService.listSessions(token);
      setState(() {
        _sessions = sessions;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _revokeSession(String sessionId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke Session'),
        content: const Text('Are you sure you want to end this session?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final token = widget.authManager.sessionToken;
      if (token != null) {
        final success = await _authService.revokeSession(token, sessionId);
        if (success && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Session revoked successfully')),
          );
          _loadSessions();
        } else if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to revoke session')),
          );
        }
      }
    }
  }

  IconData _getDeviceIcon(String? ua) {
    if (ua == null) return MdiIcons.devices;
    if (ua.startsWith('NextermConnector/')) return MdiIcons.application;
    if (ua.startsWith('NextermMobile/')) return MdiIcons.cellphoneLink;
    final l = ua.toLowerCase();
    if (l.contains('mobile') || l.contains('android') || l.contains('iphone')) return MdiIcons.cellphone;
    if (l.contains('tablet') || l.contains('ipad')) return MdiIcons.tablet;
    if (l.contains('mac') || l.contains('windows') || l.contains('linux')) return MdiIcons.laptop;
    return MdiIcons.devices;
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Unknown';
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }

  String _shortenUserAgent(String? ua) {
    if (ua == null) return 'Unknown Device';
    final conn = RegExp(r'^NextermConnector/([\d.]+)\s*\(([^;]+);').firstMatch(ua);
    if (conn != null) return 'Nexterm Connector ${conn.group(1)} on ${conn.group(2)?.trim()}';
    final mobile = RegExp(r'^NextermMobile/([\d.]+)\s*\(([^;)]+)').firstMatch(ua);
    if (mobile != null) {
      final p = mobile.group(2)?.trim() ?? '';
      return 'Nexterm Mobile ${mobile.group(1)} on ${p.isNotEmpty ? p[0].toUpperCase() + p.substring(1) : p}';
    }
    for (final b in ['Chrome', 'Firefox', 'Safari', 'Edge']) {
      if (ua.contains(b) && (b != 'Safari' || !ua.contains('Chrome'))) {
        for (final os in ['Windows', 'Mac', 'Linux', 'Android', 'iPhone', 'iPad']) {
          if (ua.contains(os)) return '$b on $os';
        }
        return b;
      }
    }
    return 'Unknown Device';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Sessions'),
        actions: [
          IconButton(icon: Icon(MdiIcons.refresh), onPressed: _loadSessions),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadSessions,
              child: _sessions == null || _sessions!.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.6,
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  MdiIcons.monitor,
                                  size: 64,
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onSurfaceVariant,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No other active sessions',
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium?.copyWith(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      itemCount: _sessions!.length,
                      itemBuilder: (context, index) {
                        final session = _sessions![index];
                        return Card(
                          margin: const EdgeInsets.symmetric(
                            horizontal: 8.0,
                            vertical: 4.0,
                          ),
                          child: ListTile(
                            leading: Icon(
                              _getDeviceIcon(session.userAgent),
                              size: 32,
                            ),
                            title: Text(_shortenUserAgent(session.userAgent)),
                            subtitle: Text(
                              'IP: ${session.ip ?? 'Unknown'}\n'
                              'Last Activity: ${_formatDate(
                                session.lastActivity,
                              )}',
                            ),
                            isThreeLine: true,
                            trailing: IconButton(
                              icon: Icon(MdiIcons.deleteOutline),
                              onPressed: () => _revokeSession(session.id),
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
