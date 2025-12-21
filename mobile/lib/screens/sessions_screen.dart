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

  IconData _getDeviceIcon(String? userAgent) {
    if (userAgent == null) return MdiIcons.devices;
    final ua = userAgent.toLowerCase();
    if (ua.contains('mobile') ||
        ua.contains('android') ||
        ua.contains('iphone')) {
      return MdiIcons.cellphone;
    } else if (ua.contains('tablet') || ua.contains('ipad')) {
      return MdiIcons.tablet;
    } else if (ua.contains('mac') ||
        ua.contains('windows') ||
        ua.contains('linux')) {
      return MdiIcons.laptop;
    }
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

  String _shortenUserAgent(String? userAgent) {
    if (userAgent == null) return 'Unknown Device';

    if (userAgent.contains('Chrome')) {
      if (userAgent.contains('Windows')) return 'Chrome on Windows';
      if (userAgent.contains('Mac')) return 'Chrome on Mac';
      if (userAgent.contains('Linux')) return 'Chrome on Linux';
      if (userAgent.contains('Android')) return 'Chrome on Android';
      return 'Chrome';
    } else if (userAgent.contains('Firefox')) {
      if (userAgent.contains('Windows')) return 'Firefox on Windows';
      if (userAgent.contains('Mac')) return 'Firefox on Mac';
      if (userAgent.contains('Linux')) return 'Firefox on Linux';
      return 'Firefox';
    } else if (userAgent.contains('Safari') && !userAgent.contains('Chrome')) {
      if (userAgent.contains('iPhone')) return 'Safari on iPhone';
      if (userAgent.contains('iPad')) return 'Safari on iPad';
      if (userAgent.contains('Mac')) return 'Safari on Mac';
      return 'Safari';
    } else if (userAgent.contains('Edge')) {
      return 'Edge';
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
