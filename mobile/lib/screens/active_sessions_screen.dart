import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import '../services/session_manager.dart';
import '../utils/auth_manager.dart';
import '../utils/snippet_manager.dart';
import '../utils/terminal_settings.dart';
import '../utils/sftp_settings.dart';
import 'renderers/guacamole_renderer.dart';
import 'renderers/sftp_renderer.dart';
import 'renderers/terminal_renderer.dart';

class ActiveSessionsScreen extends StatefulWidget {
  final SessionManager sessionManager;
  final AuthManager authManager;
  final SnippetManager snippetManager;
  final TerminalSettings terminalSettings;
  final SftpSettings sftpSettings;
  final VoidCallback? onExitFullscreen;

  const ActiveSessionsScreen({
    super.key,
    required this.sessionManager,
    required this.authManager,
    required this.snippetManager,
    required this.terminalSettings,
    required this.sftpSettings,
    this.onExitFullscreen,
  });

  @override
  State<ActiveSessionsScreen> createState() => _ActiveSessionsScreenState();
}

class _ActiveSessionsScreenState extends State<ActiveSessionsScreen> {
  double? _pillX;
  double _pillY = 0;

  @override
  void initState() {
    super.initState();
    widget.sessionManager.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.sessionManager.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _closeSession(String sessionId) async {
    final token = widget.authManager.sessionToken;
    if (token == null) return;
    await widget.sessionManager.closeSession(sessionId, token);
  }

  void _showSessionSwitcher() {
    final sm = widget.sessionManager;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ListenableBuilder(
        listenable: sm,
        builder: (_, __) => _SessionSwitcherSheet(
          sessions: sm.sessions,
          activeSessionId: sm.activeSessionId,
          onSelect: (id) {
            sm.setActive(id);
            Navigator.pop(ctx);
          },
          onClose: (id) async {
            await _closeSession(id);
            if (sm.sessions.isEmpty && ctx.mounted) {
              Navigator.pop(ctx);
            }
          },
          onExitFullscreen: widget.onExitFullscreen != null
              ? () {
                  Navigator.pop(ctx);
                  widget.onExitFullscreen!();
                }
              : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sm = widget.sessionManager;
    final sessions = sm.sessions;
    final activeId = sm.activeSessionId;

    if (sessions.isEmpty) {
      return Scaffold(
        body: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(MdiIcons.monitorOff, size: 48, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 16),
            Text('No active sessions',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.outline)),
          ]),
        ),
      );
    }

    final activeIndex = sessions.indexWhere((s) => s.sessionId == activeId);

    return Scaffold(
      body: LayoutBuilder(builder: (context, constraints) {
        final safeTop = MediaQuery.of(context).padding.top;
        _pillX ??= (constraints.maxWidth / 2) - 80;
        _pillY = _pillY.clamp(safeTop + 4, constraints.maxHeight - 48);
        _pillX = _pillX!.clamp(0.0, constraints.maxWidth - 160);

        return Stack(
          children: [
            Positioned.fill(
              child: IndexedStack(
                index: activeIndex >= 0 ? activeIndex : 0,
                children: sessions.map((s) => _buildRenderer(s)).toList(),
              ),
            ),

            Positioned(
              left: _pillX,
              top: _pillY,
              child: _buildDraggablePill(sessions, activeId, constraints),
            ),
          ],
        );
      }),
    );
  }

  Widget _buildDraggablePill(
      List<AppSession> sessions, String? activeId, BoxConstraints constraints) {
    final cs = Theme.of(context).colorScheme;
    final safeTop = MediaQuery.of(context).padding.top;
    final active = sessions.firstWhere(
      (s) => s.sessionId == activeId,
      orElse: () => sessions.first,
    );

    return GestureDetector(
      onPanUpdate: (d) {
        setState(() {
          _pillX = (_pillX! + d.delta.dx).clamp(0.0, constraints.maxWidth - 160);
          _pillY = (_pillY + d.delta.dy).clamp(safeTop + 4, constraints.maxHeight - 48);
        });
      },
      child: Container(
        decoration: BoxDecoration(
          color: cs.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          GestureDetector(
            onTap: _showSessionSwitcher,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 7, 6, 7),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(_iconForType(active.type), size: 14, color: cs.primary),
                const SizedBox(width: 5),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 80),
                  child: Text(
                    active.server.name,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cs.onSurface),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (sessions.length > 1) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: cs.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('${sessions.length}',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: cs.primary)),
                  ),
                ],
                const SizedBox(width: 2),
                Icon(MdiIcons.chevronUp, size: 14, color: cs.outline),
              ]),
            ),
          ),

          if (active.showMenu != null || active.showSnippets != null) ...[
            Container(width: 1, height: 22, color: cs.outlineVariant.withValues(alpha: 0.5)),

            GestureDetector(
              onTap: () {
                if (active.showSnippets != null) {
                  active.showSnippets!();
                } else {
                  active.showMenu?.call();
                }
              },
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                child: Icon(
                  active.showSnippets != null ? MdiIcons.codeBraces : MdiIcons.toolbox,
                  size: 16, color: cs.primary,
                ),
              ),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _buildRenderer(AppSession session) {
    final token = widget.authManager.sessionToken ?? '';
    switch (session.type) {
      case ConnectionType.guacamole:
        return GuacamoleRenderer(
          key: ValueKey('guac_${session.sessionId}'),
          session: session,
          token: token,
        );
      case ConnectionType.terminal:
        return TerminalRenderer(
          key: ValueKey('term_${session.sessionId}'),
          session: session,
          token: token,
          snippetManager: widget.snippetManager,
          terminalSettings: widget.terminalSettings,
        );
      case ConnectionType.sftp:
        return SftpRenderer(
          key: ValueKey('sftp_${session.sessionId}'),
          session: session,
          token: token,
          sftpSettings: widget.sftpSettings,
        );
    }
  }

  IconData _iconForType(ConnectionType type) {
    switch (type) {
      case ConnectionType.guacamole: return MdiIcons.monitorSmall;
      case ConnectionType.terminal: return MdiIcons.console;
      case ConnectionType.sftp: return MdiIcons.folderOutline;
    }
  }
}

class _SessionSwitcherSheet extends StatelessWidget {
  final List<AppSession> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSelect;
  final ValueChanged<String> onClose;
  final VoidCallback? onExitFullscreen;

  const _SessionSwitcherSheet({
    required this.sessions,
    required this.activeSessionId,
    required this.onSelect,
    required this.onClose,
    this.onExitFullscreen,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: cs.outlineVariant,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(children: [
              Icon(MdiIcons.layers, size: 20, color: cs.primary),
              const SizedBox(width: 8),
              Text('Sessions',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              const Spacer(),
              Text('${sessions.length}',
                  style: TextStyle(fontSize: 13, color: cs.outline, fontWeight: FontWeight.w600)),
            ]),
          ),
          const Divider(height: 1),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.45,
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: sessions.length,
              padding: const EdgeInsets.symmetric(vertical: 6),
              itemBuilder: (_, i) {
                final s = sessions[i];
                return _SessionTile(
                  session: s,
                  isActive: s.sessionId == activeSessionId,
                  onTap: () => onSelect(s.sessionId),
                  onClose: () => onClose(s.sessionId),
                );
              },
            ),
          ),
          if (onExitFullscreen != null) ...[
            const Divider(height: 1),
            ListTile(
              dense: true,
              leading: Icon(MdiIcons.exitToApp, size: 20, color: cs.outline),
              title: Text('Back to servers',
                  style: TextStyle(fontSize: 14, color: cs.onSurface)),
              onTap: onExitFullscreen,
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  final AppSession session;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onClose;

  const _SessionTile({
    required this.session,
    required this.isActive,
    required this.onTap,
    required this.onClose,
  });

  IconData get _icon {
    switch (session.type) {
      case ConnectionType.guacamole: return MdiIcons.monitorSmall;
      case ConnectionType.terminal: return MdiIcons.console;
      case ConnectionType.sftp: return MdiIcons.folderOutline;
    }
  }

  String get _typeLabel {
    switch (session.type) {
      case ConnectionType.guacamole: return 'Remote Desktop';
      case ConnectionType.terminal: return 'Terminal';
      case ConnectionType.sftp: return 'File Browser';
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      decoration: BoxDecoration(
        color: isActive ? cs.primaryContainer : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        dense: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.only(left: 14, right: 6),
        leading: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: (isActive ? cs.onPrimaryContainer : cs.primary).withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(_icon, size: 18,
              color: isActive ? cs.onPrimaryContainer : cs.primary),
        ),
        title: Text(session.server.name,
            style: TextStyle(
                fontSize: 14,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive ? cs.onPrimaryContainer : cs.onSurface),
            overflow: TextOverflow.ellipsis),
        subtitle: Text(_typeLabel,
            style: TextStyle(fontSize: 11,
                color: isActive ? cs.onPrimaryContainer.withValues(alpha: 0.7) : cs.outline)),
        trailing: IconButton(
          icon: Icon(MdiIcons.close, size: 16),
          onPressed: onClose,
          color: isActive ? cs.onPrimaryContainer : cs.outline,
          tooltip: 'Close session',
          constraints: const BoxConstraints(),
          padding: const EdgeInsets.all(8),
        ),
        onTap: onTap,
      ),
    );
  }
}
