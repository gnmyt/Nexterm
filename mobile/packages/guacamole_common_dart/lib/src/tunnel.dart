import 'dart:async';
import 'package:web_socket_channel/io.dart';
import 'parser.dart';
import 'status.dart';

enum TunnelState { connecting, open, closed, unstable }

const String internalDataOpcode = '';

class GuacWebSocketTunnel {
  final String _tunnelUrl;

  TunnelState state = TunnelState.closed;
  String? uuid;

  void Function(String opcode, List<String> args)? oninstruction;

  void Function(TunnelState state)? onstatechange;

  void Function(GuacStatus status)? onerror;

  void Function(String uuid)? onuuid;

  IOWebSocketChannel? _socket;
  GuacParser? _parser;
  Timer? _receiveTimer;
  Timer? _unstableTimer;
  Timer? _pingTimer;
  int _lastSentPing = 0;
  StreamSubscription? _subscription;

  int receiveTimeout = 15000;

  int unstableThreshold = 1500;

  static const int _pingFrequency = 500;

  GuacWebSocketTunnel(this._tunnelUrl);

  bool get isConnected =>
      state == TunnelState.open || state == TunnelState.unstable;

  void _setState(TunnelState newState) {
    if (newState != state) {
      state = newState;
      onstatechange?.call(newState);
    }
  }

  void _setUUID(String newUuid) {
    uuid = newUuid;
    onuuid?.call(newUuid);
  }

  void _resetTimers() {
    _receiveTimer?.cancel();
    _unstableTimer?.cancel();
    _pingTimer?.cancel();

    if (state == TunnelState.unstable) {
      _setState(TunnelState.open);
    }

    _receiveTimer = Timer(Duration(milliseconds: receiveTimeout), () {
      _closeTunnel(
          GuacStatus(GuacStatus.upstreamTimeout, 'Server timeout.'));
    });

    _unstableTimer = Timer(Duration(milliseconds: unstableThreshold), () {
      _setState(TunnelState.unstable);
    });

    final now = DateTime.now().millisecondsSinceEpoch;
    final pingDelay = (_lastSentPing + _pingFrequency - now).clamp(0, _pingFrequency);

    if (pingDelay > 0) {
      _pingTimer = Timer(Duration(milliseconds: pingDelay), _sendPing);
    } else {
      _sendPing();
    }
  }

  void _sendPing() {
    final now = DateTime.now().millisecondsSinceEpoch;
    sendMessage([internalDataOpcode, 'ping', now]);
    _lastSentPing = now;
  }

  void _closeTunnel(GuacStatus status) {
    _receiveTimer?.cancel();
    _unstableTimer?.cancel();
    _pingTimer?.cancel();

    if (state == TunnelState.closed) return;

    if (status.isError) {
      onerror?.call(status);
    }

    _setState(TunnelState.closed);
    _subscription?.cancel();

    try {
      _socket?.sink.close();
    } catch (_) {}
  }

  void sendMessage(List<Object> elements) {
    if (!isConnected || elements.isEmpty) return;
    _socket?.sink.add(GuacParser.toInstruction(elements));
  }

  void connect(String data) {
    _resetTimers();
    _setState(TunnelState.connecting);

    _parser = GuacParser();
    _parser!.oninstruction = (opcode, args) {
      // First instruction carries the tunnel UUID
      if (uuid == null) {
        if (opcode == internalDataOpcode && args.length == 1) {
          _setUUID(args[0]);
        }
        _setState(TunnelState.open);
      }

      // Forward non-internal instructions
      if (opcode != internalDataOpcode) {
        oninstruction?.call(opcode, args);
      }
    };

    final url = _tunnelUrl.contains('?')
        ? '$_tunnelUrl&$data'
        : '$_tunnelUrl?$data';

    _socket = IOWebSocketChannel.connect(
      Uri.parse(url),
      protocols: ['guacamole'],
    );

    _subscription = _socket!.stream.listen(
      (data) {
        _resetTimers();
        try {
          _parser!.receive(data as String);
        } catch (e) {
          _closeTunnel(
              GuacStatus(GuacStatus.serverError, e.toString()));
        }
      },
      onError: (error) {
        _closeTunnel(
            GuacStatus(GuacStatus.upstreamError, error.toString()));
      },
      onDone: () {
        _closeTunnel(GuacStatus(GuacStatus.success, 'Connection closed.'));
      },
    );
  }

  void disconnect() {
    _closeTunnel(GuacStatus(GuacStatus.success, 'Manually closed.'));
  }
}
