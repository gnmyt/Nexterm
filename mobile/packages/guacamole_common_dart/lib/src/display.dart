import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'layer.dart';

class GuacDisplay {
  final Map<int, GuacLayer> _layers = {};

  GuacLayer get defaultLayer => getLayer(0);

  int cursorHotspotX = 0;
  int cursorHotspotY = 0;

  double cursorX = 0;
  double cursorY = 0;

  bool cursorVisible = false;

  final List<_PendingSync> _pendingSyncs = [];
  bool _flushing = false;

  void Function()? onflush;

  void Function(int width, int height)? onresize;

  GuacLayer getLayer(int index) {
    return _layers.putIfAbsent(index, () => GuacLayer(index));
  }

  void setChannelMask(GuacLayer layer, int mask) {
    layer.channelMask = mask;
  }

  void resize(GuacLayer layer, int width, int height) {
    layer.resize(width, height);
    if (layer.index == 0) {
      onresize?.call(width, height);
    }
  }

  void draw(GuacLayer layer, int x, int y, String dataUri) {
    final commaIndex = dataUri.indexOf(',');
    if (commaIndex < 0) return;
    final b64 = dataUri.substring(commaIndex + 1);
    final bytes = base64Decode(b64);

    _decodeAndDraw(layer, x, y, bytes);
  }

  void drawBase64(GuacLayer layer, int x, int y, String base64Data, String format) {
    final bytes = base64Decode(base64Data);
    _decodeAndDraw(layer, x, y, bytes);
  }

  void _decodeAndDraw(GuacLayer layer, int x, int y, Uint8List bytes) {
    ui.decodeImageFromList(bytes, (img) {
      _drawDecodedImage(layer, x, y, img);
    });
  }

  void _drawDecodedImage(GuacLayer layer, int x, int y, ui.Image img) {
    final w = img.width;
    final h = img.height;

    img.toByteData(format: ui.ImageByteFormat.rawRgba).then((data) {
      if (data != null) {
        layer.drawImageData(data.buffer.asUint8List(), w, h, x, y);
        layer.buildImage().then((_) {
          onflush?.call();
        });
      }
      img.dispose();
    });
  }

  void copy(GuacLayer srcLayer, int srcX, int srcY, int w, int h,
      GuacLayer dstLayer, int dstX, int dstY) {
    dstLayer.copyFrom(srcLayer, srcX, srcY, w, h, dstX, dstY);
  }

  void fillColor(GuacLayer layer, int r, int g, int b, int a) {
    if (layer.currentPath != null) {
      final bounds = layer.currentPath!.getBounds();
      layer.fillRect(bounds.left.toInt(), bounds.top.toInt(),
          bounds.width.toInt(), bounds.height.toInt(), r, g, b, a);
      layer.currentPath = null;
    }
  }

  void strokeColor(GuacLayer layer, String cap, String join, int thickness,
      int r, int g, int b, int a) {
    if (layer.currentPath != null) {
      final bounds = layer.currentPath!.getBounds();
      layer.fillRect(bounds.left.toInt(), bounds.top.toInt(),
          bounds.width.toInt(), bounds.height.toInt(), r, g, b, a);
      layer.currentPath = null;
    }
  }

  void put(GuacLayer srcLayer, int srcX, int srcY, int w, int h,
      GuacLayer dstLayer, int dstX, int dstY) {
    final savedMask = dstLayer.channelMask;
    dstLayer.channelMask = 0x3; // SRC
    dstLayer.copyFrom(srcLayer, srcX, srcY, w, h, dstX, dstY);
    dstLayer.channelMask = savedMask;
  }

  void transfer(GuacLayer srcLayer, int srcX, int srcY, int w, int h,
      GuacLayer dstLayer, int dstX, int dstY,
      int Function(int src, int dst) transferFn) {
    final srcPx = srcLayer.pixels;
    final dstPx = dstLayer.pixels;

    for (int row = 0; row < h; row++) {
      final sy = srcY + row;
      final dy = dstY + row;
      if (sy < 0 || sy >= srcLayer.height || dy < 0 || dy >= dstLayer.height) continue;

      for (int col = 0; col < w; col++) {
        final sx = srcX + col;
        final dx = dstX + col;
        if (sx < 0 || sx >= srcLayer.width || dx < 0 || dx >= dstLayer.width) continue;

        final srcOff = (sy * srcLayer.width + sx) * 4;
        final dstOff = (dy * dstLayer.width + dx) * 4;

        for (int c = 0; c < 4; c++) {
          dstPx[dstOff + c] = transferFn(srcPx[srcOff + c], dstPx[dstOff + c]).clamp(0, 255);
        }
      }
    }
    dstLayer.dirty = true;
  }

  void moveTo(GuacLayer layer, int x, int y) => layer.moveTo(x, y);
  void lineTo(GuacLayer layer, int x, int y) => layer.lineTo(x, y);

  void arc(GuacLayer layer, int x, int y, int radius, double startAngle,
      double endAngle, bool anticlockwise) {
    layer.arc(x, y, radius, startAngle, endAngle, anticlockwise);
  }

  void curveTo(GuacLayer layer, int cp1x, int cp1y, int cp2x, int cp2y,
      int x, int y) {
    layer.currentPath ??= ui.Path();
    layer.currentPath!.cubicTo(cp1x.toDouble(), cp1y.toDouble(),
        cp2x.toDouble(), cp2y.toDouble(), x.toDouble(), y.toDouble());
  }

  void rectPath(GuacLayer layer, int x, int y, int w, int h) {
    layer.rect(x, y, w, h);
  }

  void clip(GuacLayer layer) {
    layer.currentPath = null;
  }

  void close(GuacLayer layer) => layer.closePath();
  void push(GuacLayer layer) => layer.pushState();
  void pop(GuacLayer layer) => layer.popState();
  void reset(GuacLayer layer) => layer.resetState();

  void setTransform(GuacLayer layer, double a, double b, double c, double d,
      double e, double f) {
    layer.transform = Float64List.fromList([a, b, c, d, e, f]);
  }

  void transform(GuacLayer layer, double a, double b, double c, double d,
      double e, double f) {
    final t = layer.transform;
    layer.transform = Float64List.fromList([
      t[0] * a + t[2] * b,
      t[1] * a + t[3] * b,
      t[0] * c + t[2] * d,
      t[1] * c + t[3] * d,
      t[0] * e + t[2] * f + t[4],
      t[1] * e + t[3] * f + t[5],
    ]);
  }

  void fillLayer(GuacLayer layer, GuacLayer srcLayer) {
    layer.copyFrom(srcLayer, 0, 0, srcLayer.width, srcLayer.height, 0, 0);
  }

  void strokeLayer(GuacLayer layer, GuacLayer srcLayer) {
    fillLayer(layer, srcLayer);
  }

  void move(GuacLayer layer, GuacLayer parent, int x, int y, int z) {
    layer.parent = parent;
    layer.x = x;
    layer.y = y;
    layer.z = z;
  }

  void shade(GuacLayer layer, int alpha) {
    layer.opacity = alpha;
  }

  void distort(GuacLayer layer, double a, double b, double c, double d,
      double e, double f) {
    layer.transform = Float64List.fromList([a, b, c, d, e, f]);
  }

  void dispose(GuacLayer layer) {
    layer.dispose();
    _layers.remove(layer.index);
  }

  void setCursor(int hotspotX, int hotspotY, GuacLayer srcLayer, int srcX,
      int srcY, int width, int height) {
    cursorHotspotX = hotspotX;
    cursorHotspotY = hotspotY;
  }

  void showCursor(bool visible) {
    cursorVisible = visible;
  }

  void moveCursor(double x, double y) {
    cursorX = x;
    cursorY = y;
  }

  Future<void> flush(void Function()? callback, int timestamp, int frames) async {
    if (_flushing) {
      _pendingSyncs.add(_PendingSync(callback, timestamp, frames));
      return;
    }

    _flushing = true;

    final futures = <Future>[];
    for (final layer in _layers.values) {
      if (layer.dirty && layer.width > 0 && layer.height > 0) {
        futures.add(layer.buildImage());
      }
    }

    if (futures.isNotEmpty) {
      await Future.wait(futures);
    }

    onflush?.call();
    callback?.call();

    _flushing = false;

    if (_pendingSyncs.isNotEmpty) {
      final next = _pendingSyncs.removeAt(0);
      flush(next.callback, next.timestamp, next.frames);
    }
  }

  int get width => defaultLayer.width;

  int get height => defaultLayer.height;

  List<GuacLayer> get visibleLayers {
    final visible = _layers.values.where((l) => l.index >= 0).toList();
    visible.sort((a, b) => a.z.compareTo(b.z));
    return visible;
  }

  void disposeAll() {
    for (final layer in _layers.values) {
      layer.dispose();
    }
    _layers.clear();
  }
}

class _PendingSync {
  final void Function()? callback;
  final int timestamp;
  final int frames;
  _PendingSync(this.callback, this.timestamp, this.frames);
}
