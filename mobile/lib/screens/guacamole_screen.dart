import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:guacamole_common_dart/guacamole_common_dart.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import '../models/server.dart';
import '../services/connection_service.dart';
import '../utils/api_client.dart';
import '../utils/auth_manager.dart';

enum MouseMode { direct, virtualMouse }

class GuacamoleScreen extends StatefulWidget {
  final Server server;
  final AuthManager authManager;

  const GuacamoleScreen({
    super.key,
    required this.server,
    required this.authManager,
  });

  @override
  State<GuacamoleScreen> createState() => _GuacamoleScreenState();
}

class _GuacamoleScreenState extends State<GuacamoleScreen> {
  GuacClient? _client;
  GuacWebSocketTunnel? _tunnel;
  String? _sessionId;
  bool _connected = false;
  String? _error;
  MouseMode _mouseMode = MouseMode.direct;

  double _mouseX = 0, _mouseY = 0;
  double _displayScale = 1.0, _displayOffsetX = 0, _displayOffsetY = 0;
  int _displayWidth = 0, _displayHeight = 0;
  double _userScale = 1.0, _panOffsetX = 0, _panOffsetY = 0;
  double _availableWidth = 0, _availableHeight = 0;
  bool _initialSizeSent = false;

  final Map<int, Offset> _activePointers = {};
  bool _isPinching = false;
  double _pinchBaseDistance = 0, _pinchBaseScale = 1.0;
  Offset _pinchBaseCenter = Offset.zero, _pinchBasePan = Offset.zero;

  static const int _moveThreshold = 16;
  static const Duration _releaseDelay = Duration(milliseconds: 250);
  static const Duration _longPressDelay = Duration(milliseconds: 500);

  Offset? _pointerDownPos;
  Timer? _releaseTimer, _longPressTimer;
  bool _hasMoved = false, _buttonHeld = false;

  bool _ctrlHeld = false, _altHeld = false, _shiftHeld = false;
  final _repaint = _RepaintNotifier();

  static const _ks = (
    escape: 0xFF1B, tab: 0xFF09, enter: 0xFF0D, backspace: 0xFF08,
    delete: 0xFFFF, up: 0xFF52, down: 0xFF54, left: 0xFF51, right: 0xFF53,
    home: 0xFF50, end: 0xFF57, pageUp: 0xFF55, pageDown: 0xFF56,
    ctrl: 0xFFE3, alt: 0xFFE9, shift: 0xFFE1,
  );

  @override
  void initState() {
    super.initState();
    _connect();
  }

  @override
  void dispose() {
    _cancelTimers();
    _disconnect();
    _repaint.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    try {
      setState(() => _error = null);
      final token = widget.authManager.sessionToken;
      if (token == null) {
        setState(() => _error = 'No session token available');
        return;
      }

      final identityId = widget.server.identities?.isNotEmpty == true
          ? widget.server.identities!.first
          : null;

      final session = await ConnectionService.createSession(
        token: token,
        entryId: widget.server.id is int
            ? widget.server.id
            : int.parse(widget.server.id.toString()),
        identityId: identityId ?? 0,
      );
      _sessionId = session.sessionId;

      _tunnel = GuacWebSocketTunnel(ApiClient.buildWebSocketUrl('/ws/guac/'));
      _client = GuacClient(_tunnel!);

      _client!.display.onflush = () {
        if (mounted) _repaint.notify();
      };
      _client!.display.onresize = (w, h) {
        if (!mounted) return;
        setState(() { _displayWidth = w; _displayHeight = h; });
        _updateScaling();
      };
      _client!.onstatechange = (state) {
        if (!mounted) return;
        setState(() => _connected = state == ClientState.connected || state == ClientState.waiting);
        if (state == ClientState.connected) _sendDisplaySize();
        if (state == ClientState.disconnected) setState(() => _connected = false);
      };
      _client!.onerror = (status) {
        if (mounted) setState(() => _error = 'Error: ${status.message}');
      };

      _client!.connect(
        'sessionToken=${Uri.encodeComponent(token)}&sessionId=${Uri.encodeComponent(session.sessionId)}',
      );
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to connect: $e');
    }
  }

  void _disconnect() {
    _client?.disconnect();
    _client?.dispose();
    _client = null;
    _tunnel = null;
    if (_sessionId != null && widget.authManager.sessionToken != null) {
      ConnectionService.deleteSession(token: widget.authManager.sessionToken!, sessionId: _sessionId!);
      _sessionId = null;
    }
  }

  void _sendDisplaySize() {
    if (_client == null || _availableWidth <= 0 || _availableHeight <= 0) return;
    final dpr = MediaQuery.of(context).devicePixelRatio;
    _client!.sendSize((_availableWidth * dpr).toInt(), (_availableHeight * dpr).toInt());
    _initialSizeSent = true;
  }

  void _onLayoutChanged(double w, double h) {
    final changed = w != _availableWidth || h != _availableHeight;
    _availableWidth = w;
    _availableHeight = h;
    if (changed) _updateScaling();
    if (_connected && w > 0 && h > 0 && (!_initialSizeSent || changed)) _sendDisplaySize();
  }

  void _updateScaling() {
    if (_displayWidth <= 0 || _displayHeight <= 0 || _availableWidth <= 0 || _availableHeight <= 0) return;
    _displayScale = (_availableWidth / _displayWidth).clamp(0.0, _availableHeight / _displayHeight).toDouble();
    _displayOffsetX = (_availableWidth - _displayWidth * _displayScale * _userScale) / 2 + _panOffsetX;
    _displayOffsetY = (_availableHeight - _displayHeight * _displayScale * _userScale) / 2 + _panOffsetY;
  }

  Offset _screenToRemote(Offset pos) {
    final s = _displayScale * _userScale;
    return Offset(
      ((pos.dx - _displayOffsetX) / s).clamp(0, _displayWidth.toDouble()),
      ((pos.dy - _displayOffsetY) / s).clamp(0, _displayHeight.toDouble()),
    );
  }

  void _onPointerDown(PointerDownEvent e) {
    _activePointers[e.pointer] = e.localPosition;
    if (_activePointers.length == 2) {
      _cancelTimers();
      if (_buttonHeld) _sendMouseUp();
      _startPinch();
      return;
    }
    if (_activePointers.length > 2) return;

    _pointerDownPos = e.localPosition;
    _hasMoved = false;
    if (_releaseTimer != null) { _releaseTimer!.cancel(); _releaseTimer = null; }

    _longPressTimer?.cancel();
    _longPressTimer = Timer(_longPressDelay, () {
      if (!_hasMoved && _activePointers.length == 1) _onLongPress(e.localPosition);
    });
  }

  void _onPointerMove(PointerMoveEvent e) {
    final prev = _activePointers[e.pointer];
    _activePointers[e.pointer] = e.localPosition;

    if (_isPinching && _activePointers.length >= 2) { _updatePinch(); return; }
    if (_activePointers.length != 1 || _client == null) return;

    if (!_hasMoved && _pointerDownPos != null) {
      final d = e.localPosition - _pointerDownPos!;
      if (d.dx * d.dx + d.dy * d.dy > _moveThreshold) {
        _hasMoved = true;
        _longPressTimer?.cancel();
      }
    }
    if (!_hasMoved) return;

    if (_mouseMode == MouseMode.direct) {
      final r = _screenToRemote(e.localPosition);
      _mouseX = r.dx; _mouseY = r.dy;
      if (!_buttonHeld) _buttonHeld = true;
      _client!.sendMouseState(GuacMouseState(x: _mouseX, y: _mouseY, left: true));
    } else {
      final delta = e.localPosition - (prev ?? e.localPosition);
      final s = _displayScale * _userScale;
      _mouseX = (_mouseX + delta.dx / s).clamp(0, _displayWidth.toDouble());
      _mouseY = (_mouseY + delta.dy / s).clamp(0, _displayHeight.toDouble());
      _client!.sendMouseState(GuacMouseState(x: _mouseX, y: _mouseY, left: _buttonHeld));
      setState(() {});
    }
  }

  void _onPointerUp(PointerUpEvent e) {
    _activePointers.remove(e.pointer);
    _longPressTimer?.cancel();
    if (_isPinching) { if (_activePointers.isEmpty) _isPinching = false; return; }
    if (_client == null) return;

    if (_hasMoved) { if (_buttonHeld) _sendMouseUp(); return; }

    if (_mouseMode == MouseMode.direct) {
      final r = _screenToRemote(e.localPosition);
      _mouseX = r.dx; _mouseY = r.dy;
    }
    if (!_buttonHeld) {
      _buttonHeld = true;
      _client!.sendMouseState(GuacMouseState(x: _mouseX, y: _mouseY, left: true));
    }
    _releaseTimer?.cancel();
    _releaseTimer = Timer(_releaseDelay, () { if (_buttonHeld) _sendMouseUp(); });
  }

  void _onPointerCancel(PointerCancelEvent e) {
    _activePointers.remove(e.pointer);
    _cancelTimers();
    if (_buttonHeld) _sendMouseUp();
    if (_activePointers.isEmpty) _isPinching = false;
  }

  void _sendMouseUp() {
    _buttonHeld = false;
    _client?.sendMouseState(GuacMouseState(x: _mouseX, y: _mouseY, left: false));
  }

  void _cancelTimers() {
    _longPressTimer?.cancel();
    _releaseTimer?.cancel();
    _releaseTimer = null;
  }

  void _onLongPress(Offset pos) {
    if (_client == null) return;
    if (_mouseMode == MouseMode.direct) {
      final r = _screenToRemote(pos);
      _mouseX = r.dx; _mouseY = r.dy;
    }
    if (_buttonHeld) _sendMouseUp();
    _client!.sendMouseState(GuacMouseState(x: _mouseX, y: _mouseY, right: true));
    Future.delayed(const Duration(milliseconds: 50), () {
      _client?.sendMouseState(GuacMouseState(x: _mouseX, y: _mouseY, right: false));
    });
  }

  void _startPinch() {
    _isPinching = true;
    final p = _activePointers.values.toList();
    _pinchBaseCenter = (p[0] + p[1]) / 2;
    _pinchBaseDistance = (p[0] - p[1]).distance;
    _pinchBaseScale = _userScale;
    _pinchBasePan = Offset(_panOffsetX, _panOffsetY);
  }

  void _updatePinch() {
    final p = _activePointers.values.toList();
    if (p.length < 2 || _pinchBaseDistance <= 0) return;
    final center = (p[0] + p[1]) / 2;
    setState(() {
      _userScale = (_pinchBaseScale * (p[0] - p[1]).distance / _pinchBaseDistance).clamp(0.5, 3.0);
      _panOffsetX = _pinchBasePan.dx + (center.dx - _pinchBaseCenter.dx);
      _panOffsetY = _pinchBasePan.dy + (center.dy - _pinchBaseCenter.dy);
      _updateScaling();
    });
  }

  void _sendKey(int ks, {bool pressed = true}) => _client?.sendKeyEvent(pressed ? 1 : 0, ks);

  void _sendKeyPress(int ks) {
    _sendKey(ks);
    Future.delayed(const Duration(milliseconds: 50), () => _sendKey(ks, pressed: false));
  }

  void _toggleMod(int ks, bool held, void Function(bool) set) {
    setState(() {
      set(!held);
      _sendKey(ks, pressed: !held);
    });
  }

  void _releaseModifiers() {
    if (_ctrlHeld) { _ctrlHeld = false; _sendKey(_ks.ctrl, pressed: false); }
    if (_altHeld) { _altHeld = false; _sendKey(_ks.alt, pressed: false); }
    if (_shiftHeld) { _shiftHeld = false; _sendKey(_ks.shift, pressed: false); }
  }

  void _sendText(String text) {
    for (final c in text.runes) {
      _sendKeyPress(c < 128 ? c : c + 0x01000000);
    }
    _releaseModifiers();
  }

  @override
  Widget build(BuildContext context) {
    _updateScaling();
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) { _disconnect(); Navigator.of(context).pop(); }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.server.name),
          leading: IconButton(
            icon: Icon(MdiIcons.arrowLeft),
            onPressed: () { _disconnect(); Navigator.of(context).pop(); },
          ),
          actions: [
            if (_connected) IconButton(
              icon: Icon(MdiIcons.keyboard),
              onPressed: _showKeyboardInput,
              tooltip: 'Keyboard',
            ),
            if (_connected) PopupMenuButton<String>(
              icon: Icon(MdiIcons.dotsVertical),
              onSelected: (v) {
                if (v == 'ctrl_alt_del') {
                  _sendKey(_ks.ctrl); _sendKey(_ks.alt);
                  _sendKeyPress(_ks.delete);
                  Future.delayed(const Duration(milliseconds: 100), () {
                    _sendKey(_ks.alt, pressed: false);
                    _sendKey(_ks.ctrl, pressed: false);
                  });
                } else if (v == 'fit_screen') {
                  setState(() { _userScale = 1.0; _panOffsetX = 0; _panOffsetY = 0; _updateScaling(); });
                }
              },
              itemBuilder: (_) => [
                _menuItem('ctrl_alt_del', MdiIcons.keyboard, 'Ctrl+Alt+Del'),
                _menuItem('fit_screen', MdiIcons.fitToScreen, 'Fit to Screen'),
              ],
            ),
          ],
        ),
        body: Column(children: [
          if (_error != null) _errorBanner(),
          Expanded(child: LayoutBuilder(builder: (_, c) {
            WidgetsBinding.instance.addPostFrameCallback((_) => _onLayoutChanged(c.maxWidth, c.maxHeight));
            return Container(color: Colors.black, child: _buildDisplay());
          })),
          _buildToolbar(),
        ]),
      ),
    );
  }

  PopupMenuItem<String> _menuItem(String value, IconData icon, String label) =>
      PopupMenuItem(value: value, child: Row(children: [Icon(icon, size: 20), const SizedBox(width: 8), Text(label)]));

  Widget _errorBanner() {
    final colors = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(8), color: colors.errorContainer,
      child: Row(children: [
        Icon(MdiIcons.alertCircleOutline, color: colors.onErrorContainer),
        const SizedBox(width: 8),
        Expanded(child: Text(_error!, style: TextStyle(color: colors.onErrorContainer))),
        IconButton(icon: Icon(MdiIcons.close), onPressed: () => setState(() => _error = null), color: colors.onErrorContainer),
      ]),
    );
  }

  Widget _buildDisplay() {
    if (!_connected && _error == null) {
      return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        CircularProgressIndicator(), SizedBox(height: 16), Text('Connecting...', style: TextStyle(color: Colors.white70)),
      ]));
    }
    return Listener(
      onPointerDown: _onPointerDown, onPointerMove: _onPointerMove,
      onPointerUp: _onPointerUp, onPointerCancel: _onPointerCancel,
      behavior: HitTestBehavior.opaque,
      child: ClipRect(child: CustomPaint(
        painter: _GuacPainter(
          client: _client, displayScale: _displayScale, userScale: _userScale,
          offsetX: _displayOffsetX, offsetY: _displayOffsetY,
          mouseMode: _mouseMode, mouseX: _mouseX, mouseY: _mouseY, repaint: _repaint,
        ),
        size: Size.infinite,
      )),
    );
  }

  Widget _buildToolbar() {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainer,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, -2))],
      ),
      child: SafeArea(top: false, child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
          _iconBtn(
            _mouseMode == MouseMode.direct ? MdiIcons.cursorDefaultClick : MdiIcons.mouse,
            _mouseMode == MouseMode.direct ? 'Touch' : 'Mouse',
            () => setState(() => _mouseMode = _mouseMode == MouseMode.direct ? MouseMode.virtualMouse : MouseMode.direct),
          ),
          const SizedBox(width: 4), _div(), const SizedBox(width: 4),
          _modBtn('CTRL', _ctrlHeld, () => _toggleMod(_ks.ctrl, _ctrlHeld, (v) => _ctrlHeld = v)),
          const SizedBox(width: 4),
          _modBtn('ALT', _altHeld, () => _toggleMod(_ks.alt, _altHeld, (v) => _altHeld = v)),
          const SizedBox(width: 4),
          _modBtn('SHIFT', _shiftHeld, () => _toggleMod(_ks.shift, _shiftHeld, (v) => _shiftHeld = v)),
          const SizedBox(width: 4), _div(), const SizedBox(width: 4),
          ..._keyButtons([
            ('ESC', _ks.escape), ('TAB', _ks.tab), ('⏎', _ks.enter), ('⌫', _ks.backspace), ('DEL', _ks.delete),
          ]),
          _div(), const SizedBox(width: 4),
          ..._keyButtons([('↑', _ks.up), ('↓', _ks.down), ('←', _ks.left), ('→', _ks.right)]),
          _div(), const SizedBox(width: 4),
          ..._keyButtons([('HOME', _ks.home), ('END', _ks.end), ('PGUP', _ks.pageUp), ('PGDN', _ks.pageDown)]),
        ])),
      )),
    );
  }

  List<Widget> _keyButtons(List<(String, int)> keys) =>
      keys.expand((k) => [_btn(k.$1, () => _sendKeyPress(k.$2), compact: true), const SizedBox(width: 4)]).toList();

  Widget _div() => Container(width: 1, height: 32, color: Theme.of(context).colorScheme.outlineVariant);

  Widget _btn(String label, VoidCallback onTap, {bool isActive = false, bool compact = false}) {
    final t = Theme.of(context);
    final bg = isActive ? t.colorScheme.primary : t.colorScheme.surfaceContainerHighest;
    final fg = isActive ? t.colorScheme.onPrimary : t.colorScheme.onSurface;
    return Material(color: bg, borderRadius: BorderRadius.circular(10), elevation: isActive ? 2 : 0,
      child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: BoxConstraints(minWidth: compact ? 40 : 52, minHeight: 40),
          padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 14, vertical: 8),
          child: Center(child: Text(label, style: TextStyle(fontSize: compact ? 12 : 13, fontWeight: FontWeight.w600, color: fg))),
        ),
      ),
    );
  }

  Widget _modBtn(String label, bool active, VoidCallback onTap) => _btn(label, onTap, isActive: active);

  Widget _iconBtn(IconData icon, String label, VoidCallback onTap) {
    final t = Theme.of(context);
    return Material(color: t.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(10),
      child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minWidth: 60, minHeight: 40),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18, color: t.colorScheme.onSurface),
            const SizedBox(height: 1),
            Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: t.colorScheme.onSurface)),
          ]),
        ),
      ),
    );
  }

  void _showKeyboardInput() {
    showModalBottomSheet(context: context, isScrollControlled: true, builder: (ctx) {
      final ctl = TextEditingController();
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: ctl, autofocus: true,
            decoration: const InputDecoration(hintText: 'Type text to send...', border: OutlineInputBorder()),
            onSubmitted: (t) { _sendText(t); _sendKeyPress(_ks.enter); Navigator.pop(ctx); },
          ),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            const SizedBox(width: 8),
            FilledButton(onPressed: () { _sendText(ctl.text); Navigator.pop(ctx); }, child: const Text('Send')),
          ]),
          const SizedBox(height: 8),
        ]),
      );
    });
  }
}

class _GuacPainter extends CustomPainter {
  final GuacClient? client;
  final double displayScale, userScale, offsetX, offsetY, mouseX, mouseY;
  final MouseMode mouseMode;

  _GuacPainter({
    required this.client, required this.displayScale, required this.userScale,
    required this.offsetX, required this.offsetY, required this.mouseMode,
    required this.mouseX, required this.mouseY, required _RepaintNotifier repaint,
  }) : super(repaint: repaint);

  @override
  void paint(Canvas canvas, Size size) {
    if (client == null) return;
    final display = client!.display;
    canvas.save();
    canvas.translate(offsetX, offsetY);
    canvas.scale(displayScale * userScale);

    for (final layer in display.visibleLayers) {
      if (layer.image == null) continue;
      canvas.save();
      if (layer.index > 0) canvas.translate(layer.x.toDouble(), layer.y.toDouble());
      final paint = layer.opacity < 255 ? (Paint()..color = Color.fromARGB(layer.opacity, 255, 255, 255)) : Paint();
      canvas.drawImage(layer.image!, Offset.zero, paint);
      canvas.restore();
    }

    if (mouseMode == MouseMode.virtualMouse) {
      final path = ui.Path()
        ..moveTo(mouseX, mouseY)..lineTo(mouseX, mouseY + 18)..lineTo(mouseX + 5, mouseY + 14)
        ..lineTo(mouseX + 9, mouseY + 22)..lineTo(mouseX + 12, mouseY + 21)
        ..lineTo(mouseX + 8, mouseY + 13)..lineTo(mouseX + 13, mouseY + 12)..close();
      canvas.drawPath(path, Paint()..color = Colors.white..style = PaintingStyle.fill);
      canvas.drawPath(path, Paint()..color = Colors.black..style = PaintingStyle.stroke..strokeWidth = 1.5);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _GuacPainter old) =>
      old.displayScale != displayScale || old.userScale != userScale ||
      old.offsetX != offsetX || old.offsetY != offsetY ||
      old.mouseMode != mouseMode || old.mouseX != mouseX || old.mouseY != mouseY;
}

class _RepaintNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}
