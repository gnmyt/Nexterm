import 'dart:async';

import 'display.dart';
import 'input_stream.dart';
import 'integer_pool.dart';
import 'layer.dart';
import 'mouse.dart';
import 'output_stream.dart';
import 'status.dart';
import 'tunnel.dart';

enum ClientState { idle, connecting, waiting, connected, disconnecting, disconnected }

class GuacClient {
  final GuacWebSocketTunnel _tunnel;
  final GuacDisplay display = GuacDisplay();

  ClientState _state = ClientState.idle;
  ClientState get state => _state;

  int _currentTimestamp = 0;
  Timer? _keepAliveTimer;

  final Map<int, GuacInputStream> _streams = {};
  final Map<int, GuacOutputStream> _outputStreams = {};
  final IntegerPool _streamIndices = IntegerPool();

  final Map<int, GuacLayer> _layers = {};

  static const int _keepAliveFrequency = 5000;

  void Function(ClientState state)? onstatechange;
  void Function(GuacStatus status)? onerror;
  void Function(int timestamp, int frames)? onsync;
  void Function(String name)? onname;
  void Function(GuacInputStream stream, String mimetype)? onclipboard;
  void Function(GuacInputStream stream, String mimetype, String filename)? onfile;

  static const _lineCap = ['butt', 'round', 'square'];
  static const _lineJoin = ['bevel', 'miter', 'round'];

  late final Map<String, void Function(List<String>)> _instructionHandlers;

  GuacClient(this._tunnel) {
    _instructionHandlers = _buildHandlers();
  }

  void _setState(ClientState newState) {
    if (_state != newState) {
      _state = newState;
      onstatechange?.call(newState);
    }
  }

  bool get _isConnected =>
      _state == ClientState.waiting || _state == ClientState.connected;

  GuacLayer _getLayer(int index) {
    return _layers.putIfAbsent(index, () => display.getLayer(index));
  }

  void _scheduleKeepAlive() {
    _keepAliveTimer?.cancel();
    _keepAliveTimer = Timer(const Duration(milliseconds: _keepAliveFrequency), () {
      if (_isConnected) {
        _tunnel.sendMessage(['nop']);
        _scheduleKeepAlive();
      }
    });
  }

  void connect(String data) {
    _setState(ClientState.connecting);

    _tunnel.oninstruction = (opcode, args) {
      final handler = _instructionHandlers[opcode];
      handler?.call(args);
      _scheduleKeepAlive();
    };

    _tunnel.onstatechange = (tunnelState) {
      if (tunnelState == TunnelState.closed) {
        if (_state != ClientState.disconnecting) {
          _setState(ClientState.disconnected);
        }
      }
    };

    _tunnel.onerror = (status) {
      onerror?.call(status);
    };

    try {
      _tunnel.connect(data);
    } catch (e) {
      _setState(ClientState.idle);
      rethrow;
    }

    _scheduleKeepAlive();
    _setState(ClientState.waiting);
  }

  void disconnect() {
    if (_state == ClientState.disconnected || _state == ClientState.disconnecting) return;

    _setState(ClientState.disconnecting);
    _keepAliveTimer?.cancel();
    _tunnel.disconnect();
    _setState(ClientState.disconnected);
  }

  void sendMouseState(GuacMouseState mouseState) {
    if (!_isConnected) return;

    display.moveCursor(mouseState.x, mouseState.y);

    _tunnel.sendMessage([
      'mouse',
      mouseState.x.floor(),
      mouseState.y.floor(),
      mouseState.buttonMask,
    ]);
  }

  void sendKeyEvent(int pressed, int keysym) {
    if (!_isConnected) return;
    _tunnel.sendMessage(['key', keysym, pressed]);
  }

  void sendSize(int width, int height) {
    if (!_isConnected) return;
    _tunnel.sendMessage(['size', width, height]);
  }

  void sendAck(int streamIndex, String message, int code) {
    if (!_isConnected) return;
    _tunnel.sendMessage(['ack', streamIndex, message, code]);
  }

  void sendBlob(int streamIndex, String data) {
    if (!_isConnected) return;
    _tunnel.sendMessage(['blob', streamIndex, data]);
  }

  void endStream(int streamIndex) {
    if (!_isConnected) return;
    _tunnel.sendMessage(['end', streamIndex]);
    if (_outputStreams.containsKey(streamIndex)) {
      _streamIndices.free(streamIndex);
      _outputStreams.remove(streamIndex);
    }
  }

  GuacOutputStream createClipboardStream(String mimetype) {
    final index = _streamIndices.next();
    final stream = GuacOutputStream(index);
    _outputStreams[index] = stream;
    _tunnel.sendMessage(['clipboard', index, mimetype]);
    return stream;
  }

  void dispose() {
    _keepAliveTimer?.cancel();
    display.disposeAll();
  }

  Map<String, void Function(List<String>)> _buildHandlers() {
    return {
      'png': (args) {
        final channelMask = int.parse(args[0]);
        final layer = _getLayer(int.parse(args[1]));
        final x = int.parse(args[2]);
        final y = int.parse(args[3]);
        final data = args[4];
        display.setChannelMask(layer, channelMask);
        display.drawBase64(layer, x, y, data, 'png');
      },

      'jpeg': (args) {
        final channelMask = int.parse(args[0]);
        final layer = _getLayer(int.parse(args[1]));
        final x = int.parse(args[2]);
        final y = int.parse(args[3]);
        final data = args[4];
        display.setChannelMask(layer, channelMask);
        display.drawBase64(layer, x, y, data, 'jpeg');
      },

      'img': (args) {
        final streamIndex = int.parse(args[0]);
        final channelMask = int.parse(args[1]);
        final layer = _getLayer(int.parse(args[2]));
        final mimetype = args[3];
        final x = int.parse(args[4]);
        final y = int.parse(args[5]);

        final stream = GuacInputStream(streamIndex);
        _streams[streamIndex] = stream;

        final chunks = <String>[];
        stream.onblob = (data) => chunks.add(data);
        stream.onend = () {
          final fullData = chunks.join();
          display.setChannelMask(layer, channelMask);
          display.drawBase64(layer, x, y, fullData, mimetype);
        };

        sendAck(streamIndex, 'OK', GuacStatus.success);
      },

      'copy': (args) {
        final srcL = _getLayer(int.parse(args[0]));
        final srcX = int.parse(args[1]);
        final srcY = int.parse(args[2]);
        final srcW = int.parse(args[3]);
        final srcH = int.parse(args[4]);
        final channelMask = int.parse(args[5]);
        final dstL = _getLayer(int.parse(args[6]));
        final dstX = int.parse(args[7]);
        final dstY = int.parse(args[8]);
        display.setChannelMask(dstL, channelMask);
        display.copy(srcL, srcX, srcY, srcW, srcH, dstL, dstX, dstY);
      },

      'transfer': (args) {
        final srcL = _getLayer(int.parse(args[0]));
        final srcX = int.parse(args[1]);
        final srcY = int.parse(args[2]);
        final srcW = int.parse(args[3]);
        final srcH = int.parse(args[4]);
        final funcIndex = int.parse(args[5]);
        final dstL = _getLayer(int.parse(args[6]));
        final dstX = int.parse(args[7]);
        final dstY = int.parse(args[8]);

        if (funcIndex == 0x3) {
          display.put(srcL, srcX, srcY, srcW, srcH, dstL, dstX, dstY);
        } else if (funcIndex != 0x5) {
          display.transfer(srcL, srcX, srcY, srcW, srcH, dstL, dstX, dstY,
              _getTransferFunction(funcIndex));
        }
      },

      'rect': (args) {
        final layer = _getLayer(int.parse(args[0]));
        final x = int.parse(args[1]);
        final y = int.parse(args[2]);
        final w = int.parse(args[3]);
        final h = int.parse(args[4]);
        display.rectPath(layer, x, y, w, h);
      },

      'cfill': (args) {
        final channelMask = int.parse(args[0]);
        final layer = _getLayer(int.parse(args[1]));
        final r = int.parse(args[2]);
        final g = int.parse(args[3]);
        final b = int.parse(args[4]);
        final a = int.parse(args[5]);
        display.setChannelMask(layer, channelMask);
        display.fillColor(layer, r, g, b, a);
      },

      'cstroke': (args) {
        final channelMask = int.parse(args[0]);
        final layer = _getLayer(int.parse(args[1]));
        final capIdx = int.parse(args[2]).clamp(0, 2);
        final joinIdx = int.parse(args[3]).clamp(0, 2);
        final thickness = int.parse(args[4]);
        final r = int.parse(args[5]);
        final g = int.parse(args[6]);
        final b = int.parse(args[7]);
        final a = int.parse(args[8]);
        display.setChannelMask(layer, channelMask);
        display.strokeColor(layer, _lineCap[capIdx], _lineJoin[joinIdx],
            thickness, r, g, b, a);
      },

      'start': (args) {
        final layer = _getLayer(int.parse(args[0]));
        display.moveTo(layer, int.parse(args[1]), int.parse(args[2]));
      },

      'line': (args) {
        final layer = _getLayer(int.parse(args[0]));
        display.lineTo(layer, int.parse(args[1]), int.parse(args[2]));
      },

      'arc': (args) {
        final layer = _getLayer(int.parse(args[0]));
        display.arc(layer, int.parse(args[1]), int.parse(args[2]),
            int.parse(args[3]), double.parse(args[4]), double.parse(args[5]),
            int.parse(args[6]) != 0);
      },

      'curve': (args) {
        final layer = _getLayer(int.parse(args[0]));
        display.curveTo(layer, int.parse(args[1]), int.parse(args[2]),
            int.parse(args[3]), int.parse(args[4]),
            int.parse(args[5]), int.parse(args[6]));
      },

      'close': (args) => display.close(_getLayer(int.parse(args[0]))),
      'clip': (args) => display.clip(_getLayer(int.parse(args[0]))),
      'push': (args) => display.push(_getLayer(int.parse(args[0]))),
      'pop': (args) => display.pop(_getLayer(int.parse(args[0]))),
      'reset': (args) => display.reset(_getLayer(int.parse(args[0]))),

      'size': (args) {
        final layer = _getLayer(int.parse(args[0]));
        display.resize(layer, int.parse(args[1]), int.parse(args[2]));
      },

      'move': (args) {
        final layerIdx = int.parse(args[0]);
        final parentIdx = int.parse(args[1]);
        if (layerIdx > 0 && parentIdx >= 0) {
          display.move(_getLayer(layerIdx), _getLayer(parentIdx),
              int.parse(args[2]), int.parse(args[3]), int.parse(args[4]));
        }
      },

      'shade': (args) {
        final layerIdx = int.parse(args[0]);
        if (layerIdx >= 0) {
          display.shade(_getLayer(layerIdx), int.parse(args[1]));
        }
      },

      'dispose': (args) {
        final layerIdx = int.parse(args[0]);
        if (layerIdx > 0) {
          display.dispose(_getLayer(layerIdx));
          _layers.remove(layerIdx);
        } else if (layerIdx < 0) {
          _layers.remove(layerIdx);
        }
      },

      'distort': (args) {
        final layerIdx = int.parse(args[0]);
        if (layerIdx >= 0) {
          display.distort(_getLayer(layerIdx),
              double.parse(args[1]), double.parse(args[2]),
              double.parse(args[3]), double.parse(args[4]),
              double.parse(args[5]), double.parse(args[6]));
        }
      },

      'transform': (args) {
        final layer = _getLayer(int.parse(args[0]));
        display.transform(layer,
            double.parse(args[1]), double.parse(args[2]),
            double.parse(args[3]), double.parse(args[4]),
            double.parse(args[5]), double.parse(args[6]));
      },

      'identity': (args) {
        display.setTransform(_getLayer(int.parse(args[0])), 1, 0, 0, 1, 0, 0);
      },

      'lfill': (args) {
        final channelMask = int.parse(args[0]);
        final layer = _getLayer(int.parse(args[1]));
        final srcLayer = _getLayer(int.parse(args[2]));
        display.setChannelMask(layer, channelMask);
        display.fillLayer(layer, srcLayer);
      },

      'lstroke': (args) {
        final channelMask = int.parse(args[0]);
        final layer = _getLayer(int.parse(args[1]));
        final srcLayer = _getLayer(int.parse(args[2]));
        display.setChannelMask(layer, channelMask);
        display.strokeLayer(layer, srcLayer);
      },

      'cursor': (args) {
        display.setCursor(
            int.parse(args[0]), int.parse(args[1]),
            _getLayer(int.parse(args[2])),
            int.parse(args[3]), int.parse(args[4]),
            int.parse(args[5]), int.parse(args[6]));
      },

      'mouse': (args) {
        display.showCursor(true);
        display.moveCursor(double.parse(args[0]), double.parse(args[1]));
      },

      'sync': (args) {
        final timestamp = int.parse(args[0]);
        final frames = args.length > 1 ? int.parse(args[1]) : 0;

        display.flush(() {
          if (timestamp != _currentTimestamp) {
            _tunnel.sendMessage(['sync', timestamp]);
            _currentTimestamp = timestamp;
          }
        }, timestamp, frames);

        if (_state == ClientState.waiting) {
          _setState(ClientState.connected);
        }

        onsync?.call(timestamp, frames);
      },

      'blob': (args) {
        final streamIndex = int.parse(args[0]);
        final data = args[1];
        _streams[streamIndex]?.onblob?.call(data);
      },

      'ack': (args) {
        final streamIndex = int.parse(args[0]);
        final reason = args[1];
        final code = int.parse(args[2]);
        final stream = _outputStreams[streamIndex];
        if (stream != null) {
          stream.onack?.call(GuacStatus(code, reason));
          if (code >= 0x0100 && _outputStreams[streamIndex] == stream) {
            _streamIndices.free(streamIndex);
            _outputStreams.remove(streamIndex);
          }
        }
      },

      'end': (args) {
        final streamIndex = int.parse(args[0]);
        final stream = _streams[streamIndex];
        if (stream != null) {
          stream.onend?.call();
          _streams.remove(streamIndex);
        }
      },

      'audio': (args) { // TODO: Implement in the future. Shouldn't be a requirement for now
        final streamIndex = int.parse(args[0]);
        sendAck(streamIndex, 'OK', GuacStatus.success);
        _streams[streamIndex] = GuacInputStream(streamIndex);
        _streams[streamIndex]!.onblob = (_) {};
        _streams[streamIndex]!.onend = () => _streams.remove(streamIndex);
      },

      'video': (args) {
        final streamIndex = int.parse(args[0]);
        sendAck(streamIndex, 'OK', GuacStatus.success);
        _streams[streamIndex] = GuacInputStream(streamIndex);
        _streams[streamIndex]!.onblob = (_) {};
        _streams[streamIndex]!.onend = () => _streams.remove(streamIndex);
      },

      'clipboard': (args) {
        final streamIndex = int.parse(args[0]);
        final mimetype = args[1];
        if (onclipboard != null) {
          final stream = GuacInputStream(streamIndex);
          _streams[streamIndex] = stream;
          onclipboard!.call(stream, mimetype);
        } else {
          sendAck(streamIndex, 'Clipboard unsupported', GuacStatus.unsupported);
        }
      },

      'file': (args) {
        final streamIndex = int.parse(args[0]);
        final mimetype = args[1];
        final filename = args[2];
        if (onfile != null) {
          final stream = GuacInputStream(streamIndex);
          _streams[streamIndex] = stream;
          onfile!.call(stream, mimetype, filename);
        } else {
          sendAck(streamIndex, 'File transfer unsupported', GuacStatus.unsupported);
        }
      },

      'pipe': (args) {
        sendAck(int.parse(args[0]), 'Named pipes unsupported', GuacStatus.unsupported);
      },

      'argv': (args) {
        sendAck(int.parse(args[0]), 'Arguments unsupported', GuacStatus.unsupported);
      },

      'name': (args) => onname?.call(args[0]),

      'error': (args) {
        final reason = args[0];
        final code = int.parse(args[1]);
        onerror?.call(GuacStatus(code, reason));
        disconnect();
      },

      'disconnect': (args) => disconnect(),

      'required': (args) {
      },

      'nop': (args) {},
      'msg': (args) {},
      'set': (args) {},
      'filesystem': (args) {},

      'body': (args) {
        final streamIndex = int.parse(args[1]);
        sendAck(streamIndex, 'Receipt of body unsupported', GuacStatus.unsupported);
      },

      'undefine': (args) {},

      'nest': (args) {},
    };
  }

  static int Function(int, int) _getTransferFunction(int index) {
    switch (index) {
      case 0x0: return (s, d) => 0;           // CLEAR
      case 0x1: return (s, d) => s & d;       // AND
      case 0x2: return (s, d) => s & ~d;      // AND_REVERSE
      case 0x3: return (s, d) => s;            // COPY (SRC)
      case 0x4: return (s, d) => ~s & d;       // AND_INVERTED
      case 0x5: return (s, d) => d;            // NOOP
      case 0x6: return (s, d) => s ^ d;        // XOR
      case 0x7: return (s, d) => s | d;        // OR
      case 0x8: return (s, d) => ~(s | d);     // NOR
      case 0x9: return (s, d) => ~(s ^ d);     // EQUIV
      case 0xA: return (s, d) => ~d;           // INVERT
      case 0xB: return (s, d) => s | ~d;       // OR_REVERSE
      case 0xC: return (s, d) => ~s;           // COPY_INVERTED
      case 0xD: return (s, d) => ~s | d;       // OR_INVERTED
      case 0xE: return (s, d) => ~(s & d);     // NAND
      case 0xF: return (s, d) => 0xFF;         // SET
      default: return (s, d) => s;
    }
  }
}
