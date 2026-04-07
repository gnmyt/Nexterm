import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

class GuacLayer {
  final int index;

  int width = 0;

  int height = 0;

  Uint8List? _pixels;

  ui.Image? image;

  bool dirty = false;

  GuacLayer? parent;

  int x = 0;
  int y = 0;

  int z = 0;

  int opacity = 255;

  int channelMask = 0xF; // SRC over DST (default)

  Float64List transform = Float64List.fromList([1, 0, 0, 1, 0, 0]);

  ui.Path? currentPath;

  final List<_GraphicsState> _stateStack = [];

  GuacLayer(this.index);

  Uint8List get pixels {
    final needed = width * height * 4;
    if (_pixels == null || _pixels!.length != needed) {
      final old = _pixels;
      _pixels = Uint8List(needed);
      if (old != null) {
        final copyLen = old.length < needed ? old.length : needed;
        _pixels!.setRange(0, copyLen, old);
      }
      dirty = true;
    }
    return _pixels!;
  }

  void resize(int newWidth, int newHeight) {
    if (newWidth == width && newHeight == height) return;

    final oldPixels = _pixels;
    final oldWidth = width;
    final oldHeight = height;

    width = newWidth;
    height = newHeight;
    _pixels = Uint8List(newWidth * newHeight * 4);

    if (oldPixels != null) {
      final copyW = oldWidth < newWidth ? oldWidth : newWidth;
      final copyH = oldHeight < newHeight ? oldHeight : newHeight;
      for (int row = 0; row < copyH; row++) {
        final srcOff = row * oldWidth * 4;
        final dstOff = row * newWidth * 4;
        _pixels!.setRange(dstOff, dstOff + copyW * 4, oldPixels, srcOff);
      }
    }
    dirty = true;
  }

  void fillRect(int rx, int ry, int rw, int rh, int r, int g, int b, int a) {
    final px = pixels;
    final x1 = rx.clamp(0, width);
    final y1 = ry.clamp(0, height);
    final x2 = (rx + rw).clamp(0, width);
    final y2 = (ry + rh).clamp(0, height);

    for (int row = y1; row < y2; row++) {
      for (int col = x1; col < x2; col++) {
        final off = (row * width + col) * 4;
        _compositePixel(px, off, r, g, b, a);
      }
    }
    dirty = true;
  }

  void copyFrom(GuacLayer src, int srcX, int srcY, int w, int h,
      int dstX, int dstY) {
    final srcPx = src.pixels;
    final dstPx = pixels;

    for (int row = 0; row < h; row++) {
      final sy = srcY + row;
      final dy = dstY + row;
      if (sy < 0 || sy >= src.height || dy < 0 || dy >= height) continue;

      for (int col = 0; col < w; col++) {
        final sx = srcX + col;
        final dx = dstX + col;
        if (sx < 0 || sx >= src.width || dx < 0 || dx >= width) continue;

        final srcOff = (sy * src.width + sx) * 4;
        final dstOff = (dy * width + dx) * 4;

        final sr = srcPx[srcOff];
        final sg = srcPx[srcOff + 1];
        final sb = srcPx[srcOff + 2];
        final sa = srcPx[srcOff + 3];

        _compositePixel(dstPx, dstOff, sr, sg, sb, sa);
      }
    }
    dirty = true;
  }

  void drawImageData(Uint8List rgba, int imgW, int imgH, int dx, int dy) {
    final dstPx = pixels;
    for (int row = 0; row < imgH; row++) {
      final dstRow = dy + row;
      if (dstRow < 0 || dstRow >= height) continue;
      for (int col = 0; col < imgW; col++) {
        final dstCol = dx + col;
        if (dstCol < 0 || dstCol >= width) continue;
        final srcOff = (row * imgW + col) * 4;
        final dstOff = (dstRow * width + dstCol) * 4;
        _compositePixel(dstPx, dstOff,
            rgba[srcOff], rgba[srcOff + 1], rgba[srcOff + 2], rgba[srcOff + 3]);
      }
    }
    dirty = true;
  }

  void _compositePixel(Uint8List px, int off, int r, int g, int b, int a) {
    switch (channelMask) {
      case 0x0: // CLEAR (rout=0, gout=0, bout=0, aout=0)
        px[off] = 0;
        px[off + 1] = 0;
        px[off + 2] = 0;
        px[off + 3] = 0;
        break;

      case 0x3: // SRC (replace with source)
      case 0xC: // SRC as well in practice
        px[off] = r;
        px[off + 1] = g;
        px[off + 2] = b;
        px[off + 3] = a;
        break;

      case 0x6: // IN (intersect alpha)
        final dstA = px[off + 3];
        final srcA = a / 255.0;
        final outA = (dstA * srcA).round().clamp(0, 255);
        px[off] = r;
        px[off + 1] = g;
        px[off + 2] = b;
        px[off + 3] = outA;
        break;

      case 0xF: // SRC over DST (alpha blending)
      default:
        if (a == 255) {
          px[off] = r;
          px[off + 1] = g;
          px[off + 2] = b;
          px[off + 3] = 255;
        } else if (a == 0) {
          // No change
        } else {
          final sa = a / 255.0;
          final da = px[off + 3] / 255.0;
          final outA = sa + da * (1.0 - sa);
          if (outA > 0) {
            px[off] = ((r * sa + px[off] * da * (1.0 - sa)) / outA).round().clamp(0, 255);
            px[off + 1] = ((g * sa + px[off + 1] * da * (1.0 - sa)) / outA).round().clamp(0, 255);
            px[off + 2] = ((b * sa + px[off + 2] * da * (1.0 - sa)) / outA).round().clamp(0, 255);
            px[off + 3] = (outA * 255).round().clamp(0, 255);
          }
        }
        break;
    }
  }

  Future<void> buildImage() async {
    if (!dirty || width <= 0 || height <= 0) return;
    final completer = Completer<void>();
    ui.decodeImageFromPixels(
      pixels,
      width,
      height,
      ui.PixelFormat.rgba8888,
      (img) {
        image?.dispose();
        image = img;
        dirty = false;
        completer.complete();
      },
    );
    return completer.future;
  }

  void pushState() {
    _stateStack.add(_GraphicsState(
      channelMask: channelMask,
      transform: Float64List.fromList(transform),
    ));
  }

  void popState() {
    if (_stateStack.isNotEmpty) {
      final st = _stateStack.removeLast();
      channelMask = st.channelMask;
      transform = st.transform;
    }
  }

  void resetState() {
    channelMask = 0xF;
    transform = Float64List.fromList([1, 0, 0, 1, 0, 0]);
    currentPath = null;
    _stateStack.clear();
  }

  void moveTo(int mx, int my) {
    currentPath ??= ui.Path();
    currentPath!.moveTo(mx.toDouble(), my.toDouble());
  }

  void lineTo(int lx, int ly) {
    currentPath ??= ui.Path();
    currentPath!.lineTo(lx.toDouble(), ly.toDouble());
  }

  void arc(int cx, int cy, int radius, double startAngle, double endAngle,
      bool anticlockwise) {
    currentPath ??= ui.Path();
    final rect = ui.Rect.fromCircle(
        center: ui.Offset(cx.toDouble(), cy.toDouble()),
        radius: radius.toDouble());
    final sweep = anticlockwise
        ? -(startAngle - endAngle)
        : (endAngle - startAngle);
    currentPath!.addArc(rect, startAngle, sweep);
  }

  void rect(int rx, int ry, int rw, int rh) {
    currentPath ??= ui.Path();
    currentPath!.addRect(ui.Rect.fromLTWH(
        rx.toDouble(), ry.toDouble(), rw.toDouble(), rh.toDouble()));
  }

  void closePath() {
    currentPath?.close();
  }

  void dispose() {
    image?.dispose();
    image = null;
    _pixels = null;
  }
}

class _GraphicsState {
  final int channelMask;
  final Float64List transform;
  _GraphicsState({required this.channelMask, required this.transform});
}
