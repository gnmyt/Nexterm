import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:guacamole_common_dart/guacamole_common_dart.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import '../../services/session_manager.dart';
import '../widgets/connection_loader.dart';

enum MouseMode { direct, virtualMouse }

class GuacamoleRenderer extends StatefulWidget {
  final AppSession session;
  final String token;
  final SessionManager sessionManager;
  final VoidCallback? onDisconnected;

  const GuacamoleRenderer({
    super.key,
    required this.session,
    required this.token,
    required this.sessionManager,
    this.onDisconnected,
  });

  @override
  State<GuacamoleRenderer> createState() => _GuacamoleRendererState();
}

class _GuacamoleRendererState extends State<GuacamoleRenderer> {
  GuacClient? _client;
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

  final FocusNode _keyboardFocusNode = FocusNode();
  final TextEditingController _keyboardController = TextEditingController();
  bool _keyboardVisible = false;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;

  static const _ks = (
    escape: 0xFF1B, tab: 0xFF09, enter: 0xFF0D, backspace: 0xFF08,
    delete: 0xFFFF, up: 0xFF52, down: 0xFF54, left: 0xFF51, right: 0xFF53,
    home: 0xFF50, end: 0xFF57, pageUp: 0xFF55, pageDown: 0xFF56,
    ctrl: 0xFFE3, alt: 0xFFE9, shift: 0xFFE1,
  );

  @override
  void initState() {
    super.initState();
    widget.session.showMenu = _showToolMenu;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.session.onCallbacksReady?.call();
    });
    _connect();
  }

  @override
  void dispose() {
    _cancelTimers();
    _keyboardFocusNode.dispose();
    _keyboardController.dispose();
    _repaint.dispose();
    super.dispose();
  }

  Future<void> _attemptReconnect() async {
    if (!mounted || _reconnectAttempts >= _maxReconnectAttempts) {
      widget.onDisconnected?.call();
      return;
    }

    _reconnectAttempts++;
    final delay = Duration(seconds: _reconnectAttempts.clamp(1, 5));
    await Future.delayed(delay);

    if (!mounted) return;

    final success = await widget.sessionManager.reconnectGuacSession(
      token: widget.token,
      session: widget.session,
    );

    if (!mounted) return;

    if (success) {
      _initialSizeSent = false;
      _connect();
    } else {
      _attemptReconnect();
    }
  }

  Future<void> _connect() async {
    try {
      setState(() => _error = null);
      final session = widget.session;
      _client = session.guacClient;

      _client!.display.onflush = () {
        if (mounted) _repaint.notify();
      };
      _client!.display.onresize = (w, h) {
        if (!mounted) return;
        setState(() {
          _displayWidth = w;
          _displayHeight = h;
        });
        _updateScaling();
      };
      _client!.onstatechange = (state) {
        if (!mounted) return;
        final connected =
            state == ClientState.connected || state == ClientState.waiting;
        setState(() => _connected = connected);
        session.isConnected = connected;
        if (state == ClientState.connected) {
          _sendDisplaySize();
          _reconnectAttempts = 0;
        }
        if (state == ClientState.disconnected) {
          setState(() => _connected = false);
          session.isConnected = false;
          _attemptReconnect();
        }
      };
      _client!.onerror = (status) {
        if (mounted) {
          setState(() => _error = 'Error: ${status.message}');
          session.error = 'Error: ${status.message}';
        }
      };

      if (!session.isConnected) {
        _client!.connect(
          'sessionToken=${Uri.encodeComponent(widget.token)}&sessionId=${Uri.encodeComponent(session.sessionId)}',
        );
      } else {
        setState(() => _connected = true);
        final display = _client!.display;
        if (display.width > 0 && display.height > 0) {
          _displayWidth = display.width;
          _displayHeight = display.height;
          _updateScaling();
        }
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to connect: $e');
    }
  }

  void _sendDisplaySize() {
    if (_client == null || _availableWidth <= 0 || _availableHeight <= 0)
      return;
    final dpr = MediaQuery.of(context).devicePixelRatio;
    _client!.sendSize(
        (_availableWidth * dpr).toInt(), (_availableHeight * dpr).toInt());
    _initialSizeSent = true;
  }

  void _onLayoutChanged(double w, double h) {
    final changed = w != _availableWidth || h != _availableHeight;
    _availableWidth = w;
    _availableHeight = h;
    if (changed) _updateScaling();
    if (_connected && w > 0 && h > 0 && (!_initialSizeSent || changed))
      _sendDisplaySize();
  }

  void _updateScaling() {
    if (_displayWidth <= 0 ||
        _displayHeight <= 0 ||
        _availableWidth <= 0 ||
        _availableHeight <= 0) return;
    _displayScale = (_availableWidth / _displayWidth)
        .clamp(0.0, _availableHeight / _displayHeight)
        .toDouble();
    _displayOffsetX =
        (_availableWidth - _displayWidth * _displayScale * _userScale) / 2 +
            _panOffsetX;
    _displayOffsetY =
        (_availableHeight - _displayHeight * _displayScale * _userScale) / 2 +
            _panOffsetY;
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
    if (_releaseTimer != null) {
      _releaseTimer!.cancel();
      _releaseTimer = null;
    }

    _longPressTimer?.cancel();
    _longPressTimer = Timer(_longPressDelay, () {
      if (!_hasMoved && _activePointers.length == 1)
        _onLongPress(e.localPosition);
    });
  }

  void _onPointerMove(PointerMoveEvent e) {
    final prev = _activePointers[e.pointer];
    _activePointers[e.pointer] = e.localPosition;

    if (_isPinching && _activePointers.length >= 2) {
      _updatePinch();
      return;
    }
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
      _mouseX = r.dx;
      _mouseY = r.dy;
      if (!_buttonHeld) _buttonHeld = true;
      _client!.sendMouseState(
          GuacMouseState(x: _mouseX, y: _mouseY, left: true));
    } else {
      final delta = e.localPosition - (prev ?? e.localPosition);
      final s = _displayScale * _userScale;
      _mouseX =
          (_mouseX + delta.dx / s).clamp(0, _displayWidth.toDouble());
      _mouseY =
          (_mouseY + delta.dy / s).clamp(0, _displayHeight.toDouble());
      _client!.sendMouseState(
          GuacMouseState(x: _mouseX, y: _mouseY, left: _buttonHeld));
      setState(() {});
    }
  }

  void _onPointerUp(PointerUpEvent e) {
    _activePointers.remove(e.pointer);
    _longPressTimer?.cancel();
    if (_isPinching) {
      if (_activePointers.isEmpty) _isPinching = false;
      return;
    }
    if (_client == null) return;

    if (_hasMoved) {
      if (_buttonHeld) _sendMouseUp();
      return;
    }

    if (_mouseMode == MouseMode.direct) {
      final r = _screenToRemote(e.localPosition);
      _mouseX = r.dx;
      _mouseY = r.dy;
    }
    if (!_buttonHeld) {
      _buttonHeld = true;
      _client!.sendMouseState(
          GuacMouseState(x: _mouseX, y: _mouseY, left: true));
    }
    _releaseTimer?.cancel();
    _releaseTimer = Timer(_releaseDelay, () {
      if (_buttonHeld) _sendMouseUp();
    });
  }

  void _onPointerCancel(PointerCancelEvent e) {
    _activePointers.remove(e.pointer);
    _cancelTimers();
    if (_buttonHeld) _sendMouseUp();
    if (_activePointers.isEmpty) _isPinching = false;
  }

  void _sendMouseUp() {
    _buttonHeld = false;
    _client?.sendMouseState(
        GuacMouseState(x: _mouseX, y: _mouseY, left: false));
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
      _mouseX = r.dx;
      _mouseY = r.dy;
    }
    if (_buttonHeld) _sendMouseUp();
    _client!.sendMouseState(
        GuacMouseState(x: _mouseX, y: _mouseY, right: true));
    Future.delayed(const Duration(milliseconds: 50), () {
      _client?.sendMouseState(
          GuacMouseState(x: _mouseX, y: _mouseY, right: false));
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
      _userScale = (_pinchBaseScale *
              (p[0] - p[1]).distance /
              _pinchBaseDistance)
          .clamp(0.5, 3.0);
      _panOffsetX =
          _pinchBasePan.dx + (center.dx - _pinchBaseCenter.dx);
      _panOffsetY =
          _pinchBasePan.dy + (center.dy - _pinchBaseCenter.dy);
      _updateScaling();
    });
  }

  void _sendKey(int ks, {bool pressed = true}) =>
      _client?.sendKeyEvent(pressed ? 1 : 0, ks);

  void _sendKeyPress(int ks) {
    _sendKey(ks);
    Future.delayed(
        const Duration(milliseconds: 50), () => _sendKey(ks, pressed: false));
  }

  void _toggleMod(int ks, bool held, void Function(bool) set) {
    setState(() {
      set(!held);
      _sendKey(ks, pressed: !held);
    });
  }

  void _releaseModifiers() {
    if (_ctrlHeld) {
      _ctrlHeld = false;
      _sendKey(_ks.ctrl, pressed: false);
    }
    if (_altHeld) {
      _altHeld = false;
      _sendKey(_ks.alt, pressed: false);
    }
    if (_shiftHeld) {
      _shiftHeld = false;
      _sendKey(_ks.shift, pressed: false);
    }
  }

  void _sendText(String text) {
    for (final c in text.runes) {
      _sendKeyPress(c < 128 ? c : c + 0x01000000);
    }
    _releaseModifiers();
  }

  void _fitScreen() {
    setState(() {
      _userScale = 1.0;
      _panOffsetX = 0;
      _panOffsetY = 0;
      _updateScaling();
    });
  }

  void _sendCtrlAltDel() {
    _sendKey(_ks.ctrl);
    _sendKey(_ks.alt);
    _sendKeyPress(_ks.delete);
    Future.delayed(const Duration(milliseconds: 100), () {
      _sendKey(_ks.alt, pressed: false);
      _sendKey(_ks.ctrl, pressed: false);
    });
  }

  void _showToolMenu() {
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final cs = Theme.of(ctx).colorScheme;
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 36, height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: cs.outlineVariant,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),

                    Row(children: [
                      Expanded(child: _sheetAction(
                        icon: _mouseMode == MouseMode.direct
                            ? MdiIcons.cursorDefaultClick : MdiIcons.mouse,
                        label: _mouseMode == MouseMode.direct ? 'Touch' : 'Mouse',
                        cs: cs,
                        onTap: () {
                          setState(() {
                            _mouseMode = _mouseMode == MouseMode.direct
                                ? MouseMode.virtualMouse : MouseMode.direct;
                          });
                          setSheetState(() {});
                        },
                      )),
                      const SizedBox(width: 8),
                      Expanded(child: _sheetAction(
                        icon: MdiIcons.keyboard, label: 'Keys',
                        cs: cs, onTap: () { Navigator.pop(ctx); _showKeyboardInput(); },
                      )),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(child: _sheetAction(
                        icon: MdiIcons.fitToScreen, label: 'Fit',
                        cs: cs, onTap: () { Navigator.pop(ctx); _fitScreen(); },
                      )),
                      const SizedBox(width: 8),
                      Expanded(child: _sheetAction(
                        icon: MdiIcons.keyboardSettings, label: 'C+A+Del',
                        cs: cs, onTap: () { Navigator.pop(ctx); _sendCtrlAltDel(); },
                      )),
                    ]),
                    const SizedBox(height: 12),

                    Row(children: [
                      _sheetMod('CTRL', _ctrlHeld, () {
                        _toggleMod(_ks.ctrl, _ctrlHeld, (v) => _ctrlHeld = v);
                        setSheetState(() {});
                      }, cs),
                      const SizedBox(width: 6),
                      _sheetMod('ALT', _altHeld, () {
                        _toggleMod(_ks.alt, _altHeld, (v) => _altHeld = v);
                        setSheetState(() {});
                      }, cs),
                      const SizedBox(width: 6),
                      _sheetMod('SHIFT', _shiftHeld, () {
                        _toggleMod(_ks.shift, _shiftHeld, (v) => _shiftHeld = v);
                        setSheetState(() {});
                      }, cs),
                    ]),
                    const SizedBox(height: 12),

                    Wrap(spacing: 6, runSpacing: 6, children: [
                      _sheetKey('ESC', _ks.escape, cs),
                      _sheetKey('TAB', _ks.tab, cs),
                      _sheetKey('⏎', _ks.enter, cs),
                      _sheetKey('⌫', _ks.backspace, cs),
                      _sheetKey('DEL', _ks.delete, cs),
                      _sheetKey('↑', _ks.up, cs),
                      _sheetKey('↓', _ks.down, cs),
                      _sheetKey('←', _ks.left, cs),
                      _sheetKey('→', _ks.right, cs),
                      _sheetKey('HOME', _ks.home, cs),
                      _sheetKey('END', _ks.end, cs),
                      _sheetKey('PGUP', _ks.pageUp, cs),
                      _sheetKey('PGDN', _ks.pageDown, cs),
                    ]),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _sheetAction({required IconData icon, required String label,
      required ColorScheme cs, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: cs.primaryContainer.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 18, color: cs.primary),
          const SizedBox(width: 8),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.onSurface)),
        ]),
      ),
    );
  }

  Widget _sheetMod(String label, bool active, VoidCallback onTap, ColorScheme cs) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? cs.primary : cs.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Center(child: Text(label, style: TextStyle(
            fontSize: 13, fontWeight: FontWeight.w600,
            color: active ? cs.onPrimary : cs.onSurface,
          ))),
        ),
      ),
    );
  }

  Widget _sheetKey(String label, int ks, ColorScheme cs) {
    return GestureDetector(
      onTap: () => _sendKeyPress(ks),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: TextStyle(
          fontSize: 12, fontWeight: FontWeight.w600, color: cs.onSurface)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    _updateScaling();
    return Stack(
      children: [
        Positioned.fill(
          child: LayoutBuilder(builder: (_, c) {
            WidgetsBinding.instance.addPostFrameCallback(
                (_) => _onLayoutChanged(c.maxWidth, c.maxHeight));
            return Container(color: Colors.black, child: _buildDisplay());
          }),
        ),
        Positioned.fill(
          child: ConnectionLoader(visible: !_connected && _error == null),
        ),

        Positioned(
          left: -100,
          top: -100,
          width: 1,
          height: 1,
          child: EditableText(
            controller: _keyboardController,
            focusNode: _keyboardFocusNode,
            style: const TextStyle(fontSize: 1, color: Colors.transparent),
            cursorColor: Colors.transparent,
            backgroundCursorColor: Colors.transparent,
            onChanged: (_) => _onKeyboardText(),
            onSubmitted: (_) {
              _sendKeyPress(_ks.enter);
              _keyboardController.value = TextEditingValue.empty;
              _keyboardFocusNode.requestFocus();
            },
          ),
        ),

        if (_error != null)
          Positioned(
            top: MediaQuery.of(context).padding.top,
            left: 0,
            right: 0,
            child: _errorBanner(),
          ),
      ],
    );
  }

  Widget _errorBanner() {
    final colors = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      color: colors.errorContainer,
      child: Row(children: [
        Icon(MdiIcons.alertCircleOutline, color: colors.onErrorContainer),
        const SizedBox(width: 8),
        Expanded(
            child: Text(_error!,
                style: TextStyle(color: colors.onErrorContainer))),
        IconButton(
            icon: Icon(MdiIcons.close),
            onPressed: () => setState(() => _error = null),
            color: colors.onErrorContainer),
      ]),
    );
  }

  Widget _buildDisplay() {
    return Listener(
      onPointerDown: _onPointerDown,
      onPointerMove: _onPointerMove,
      onPointerUp: _onPointerUp,
      onPointerCancel: _onPointerCancel,
      behavior: HitTestBehavior.opaque,
      child: ClipRect(
          child: CustomPaint(
        painter: _GuacPainter(
          client: _client,
          displayScale: _displayScale,
          userScale: _userScale,
          offsetX: _displayOffsetX,
          offsetY: _displayOffsetY,
          mouseMode: _mouseMode,
          mouseX: _mouseX,
          mouseY: _mouseY,
          repaint: _repaint,
        ),
        size: Size.infinite,
      )),
    );
  }

  void _showKeyboardInput() {
    if (_keyboardVisible) {
      _keyboardFocusNode.unfocus();
      setState(() => _keyboardVisible = false);
    } else {
      _keyboardFocusNode.requestFocus();
      setState(() => _keyboardVisible = true);
    }
  }

  String _prevKeyboardText = '';

  void _onKeyboardText() {
    final text = _keyboardController.text;
    if (text.length < _prevKeyboardText.length) {
      final deleted = _prevKeyboardText.length - text.length;
      for (var i = 0; i < deleted; i++) {
        _sendKeyPress(_ks.backspace);
      }
    } else if (text.length > _prevKeyboardText.length) {
      final newPart = text.substring(_prevKeyboardText.length);
      for (final c in newPart.runes) {
        _sendKeyPress(c < 128 ? c : c + 0x01000000);
      }
      _releaseModifiers();
    }
    _prevKeyboardText = text;
  }
}

class _GuacPainter extends CustomPainter {
  final GuacClient? client;
  final double displayScale, userScale, offsetX, offsetY, mouseX, mouseY;
  final MouseMode mouseMode;

  _GuacPainter({
    required this.client,
    required this.displayScale,
    required this.userScale,
    required this.offsetX,
    required this.offsetY,
    required this.mouseMode,
    required this.mouseX,
    required this.mouseY,
    required _RepaintNotifier repaint,
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
      if (layer.index > 0)
        canvas.translate(layer.x.toDouble(), layer.y.toDouble());
      final paint = layer.opacity < 255
          ? (Paint()..color = Color.fromARGB(layer.opacity, 255, 255, 255))
          : Paint();
      canvas.drawImage(layer.image!, Offset.zero, paint);
      canvas.restore();
    }

    if (mouseMode == MouseMode.virtualMouse) {
      final path = ui.Path()
        ..moveTo(mouseX, mouseY)
        ..lineTo(mouseX, mouseY + 18)
        ..lineTo(mouseX + 5, mouseY + 14)
        ..lineTo(mouseX + 9, mouseY + 22)
        ..lineTo(mouseX + 12, mouseY + 21)
        ..lineTo(mouseX + 8, mouseY + 13)
        ..lineTo(mouseX + 13, mouseY + 12)
        ..close();
      canvas.drawPath(
          path, Paint()..color = Colors.white..style = PaintingStyle.fill);
      canvas.drawPath(
          path,
          Paint()
            ..color = Colors.black
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _GuacPainter old) =>
      old.displayScale != displayScale ||
      old.userScale != userScale ||
      old.offsetX != offsetX ||
      old.offsetY != offsetY ||
      old.mouseMode != mouseMode ||
      old.mouseX != mouseX ||
      old.mouseY != mouseY;
}

class _RepaintNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}
