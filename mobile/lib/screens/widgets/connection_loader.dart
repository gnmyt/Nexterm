import 'dart:math';

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class ConnectionLoader extends StatefulWidget {
  final bool visible;

  const ConnectionLoader({super.key, required this.visible});

  @override
  State<ConnectionLoader> createState() => _ConnectionLoaderState();
}

class _ConnectionLoaderState extends State<ConnectionLoader>
    with TickerProviderStateMixin {
  late final AnimationController _dotController;
  late final AnimationController _progressController;
  late final AnimationController _fadeController;

  @override
  void initState() {
    super.initState();

    _dotController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();

    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..forward();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
      value: 1.0,
    );
  }

  @override
  void didUpdateWidget(ConnectionLoader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.visible && oldWidget.visible) {
      _progressController.stop();
      _fadeController.reverse();
    } else if (widget.visible && !oldWidget.visible) {
      _progressController
        ..reset()
        ..forward();
      _fadeController.forward();
    }
  }

  @override
  void dispose() {
    _dotController.dispose();
    _progressController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeController,
      child: IgnorePointer(
        ignoring: !widget.visible,
        child: Container(
          color: Colors.black,
          child: Column(
            children: [
              _buildProgressBar(context),
              Expanded(child: _buildContent(context)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressBar(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return AnimatedBuilder(
      animation: _progressController,
      builder: (context, child) {
        final t = _progressController.value;
        final progress = _easeProgress(t);

        return SizedBox(
          height: 2,
          child: Stack(
            children: [
              FractionallySizedBox(
                widthFactor: progress,
                child: Container(
                  decoration: BoxDecoration(
                    color: primary,
                    boxShadow: [
                      BoxShadow(
                        color: primary.withValues(alpha: 0.6),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                      BoxShadow(
                        color: primary.withValues(alpha: 0.3),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  double _easeProgress(double t) {
    if (t < 0.15) return t / 0.15 * 0.25;
    if (t < 0.30) return 0.25 + (t - 0.15) / 0.15 * 0.20;
    if (t < 0.50) return 0.45 + (t - 0.30) / 0.20 * 0.10;
    if (t < 0.70) return 0.55 + (t - 0.50) / 0.20 * 0.10;
    if (t < 0.85) return 0.65 + (t - 0.70) / 0.15 * 0.10;
    return 0.75 + (t - 0.85) / 0.15 * 0.10;
  }

  Widget _buildContent(BuildContext context) {
    final subtext = Colors.white.withValues(alpha: 0.5);
    final primary = Theme.of(context).colorScheme.primary;

    return Center(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(MdiIcons.laptop, size: 36, color: subtext),
          const SizedBox(width: 24),
          _buildDots(primary),
          const SizedBox(width: 24),
          Icon(MdiIcons.server, size: 36, color: subtext),
        ],
      ),
    );
  }

  Widget _buildDots(Color color) {
    return AnimatedBuilder(
      animation: _dotController,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final delay = i * 0.2;
            final t = (_dotController.value - delay) % 1.0;
            final opacity = _dotOpacity(t);
            final dx = _dotTranslateX(t);

            return Transform.translate(
              offset: Offset(dx, 0),
              child: Opacity(
                opacity: opacity,
                child: Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.symmetric(horizontal: 5),
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }

  double _dotOpacity(double t) {
    if (t < 0.0) return 0.0;
    if (t < 0.5) return (sin(t * pi) * 2).clamp(0.0, 1.0);
    return (sin(t * pi) * 2).clamp(0.0, 1.0);
  }

  double _dotTranslateX(double t) {
    if (t < 0.0) return -4.0;
    return -4.0 + 8.0 * t;
  }
}
