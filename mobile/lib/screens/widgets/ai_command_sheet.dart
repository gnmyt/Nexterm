import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../services/ai_service.dart';

class AICommandSheet extends StatefulWidget {
  final String token;
  final int? entryId;
  final String? recentOutput;
  final ValueChanged<String> onCommandAccepted;

  const AICommandSheet({super.key, required this.token, this.entryId, this.recentOutput, required this.onCommandAccepted});

  @override
  State<AICommandSheet> createState() => _AICommandSheetState();
}

enum _State { input, loading, result }

class _AICommandSheetState extends State<AICommandSheet> with TickerProviderStateMixin {
  final _prompt = TextEditingController();
  final _command = TextEditingController();
  final _focus = FocusNode();
  final _speech = stt.SpeechToText();
  _State _state = _State.input;
  String? _error;
  bool _hasInput = false, _speechOk = false, _listening = false;

  late final AnimationController _pulse;
  late final AnimationController _shimmer;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))
      ..addListener(() { if (mounted) setState(() {}); });
    _shimmer = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))
      ..repeat();
    _prompt.addListener(() {
      final has = _prompt.text.trim().isNotEmpty;
      if (has != _hasInput) setState(() => _hasInput = has);
    });
    _initSpeech();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  Future<void> _initSpeech() async {
    try {
      _speechOk = await _speech.initialize(
        onStatus: (s) { if (s == 'notListening' && mounted) _stopListening(); },
        onError: (_) { if (mounted) _stopListening(); },
      );
      if (mounted) setState(() {});
    } catch (_) {}
  }

  void _stopListening() {
    _listening = false;
    _pulse.stop();
    _pulse.reset();
    if (mounted) setState(() {});
  }

  void _toggleListening() {
    if (_listening) {
      _speech.stop();
      _stopListening();
    } else {
      setState(() => _listening = true);
      _pulse.repeat(reverse: true);
      _speech.listen(
        onResult: (r) {
          if (!mounted) return;
          _prompt.text = r.recognizedWords;
          _prompt.selection = TextSelection.collapsed(offset: _prompt.text.length);
          if (r.finalResult) _stopListening();
        },
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 3),
        listenOptions: stt.SpeechListenOptions(listenMode: stt.ListenMode.dictation),
      );
    }
  }

  Future<void> _generate() async {
    final text = _prompt.text.trim();
    if (text.isEmpty) return;
    if (_listening) { _speech.stop(); _stopListening(); }

    setState(() { _state = _State.loading; _error = null; });
    try {
      final cmd = await AIService.generateCommand(
        token: widget.token, prompt: text,
        entryId: widget.entryId, recentOutput: widget.recentOutput,
      );
      if (mounted) setState(() { _state = _State.result; _command.text = cmd; });
    } catch (_) {
      if (mounted) setState(() { _state = _State.input; _error = 'Failed to generate command. Please try again.'; });
    }
  }

  void _accept() {
    final cmd = _command.text.trim();
    if (cmd.isNotEmpty) { widget.onCommandAccepted(cmd); Navigator.pop(context); }
  }

  void _copy() {
    if (_command.text.trim().isEmpty) return;
    Clipboard.setData(ClipboardData(text: _command.text.trim()));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: const Text('Command copied'), behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 1), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  void _reset() {
    setState(() { _state = _State.input; _command.clear(); _error = null; });
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    if (_listening) _speech.stop();
    _prompt.dispose(); _command.dispose(); _focus.dispose();
    _pulse.dispose(); _shimmer.dispose();
    super.dispose();
  }

  Widget _promptSummary(ColorScheme cs, {int maxLines = 2, double fontSize = 14}) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
    decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(12)),
    child: Row(children: [
      Icon(MdiIcons.textBoxOutline, size: 15, color: cs.outline),
      const SizedBox(width: 10),
      Expanded(child: Text(_prompt.text.trim(),
        style: TextStyle(fontSize: fontSize, color: cs.onSurface.withValues(alpha: 0.65)),
        maxLines: maxLines, overflow: TextOverflow.ellipsis)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: AnimatedSize(
          duration: const Duration(milliseconds: 250), curve: Curves.easeInOut, alignment: Alignment.topCenter,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Center(child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4), width: 36, height: 4,
              decoration: BoxDecoration(color: cs.outlineVariant, borderRadius: BorderRadius.circular(2)),
            )),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                  child: Icon(MdiIcons.creation, color: cs.onPrimaryContainer, size: 18),
                ),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    switch (_state) { _State.input => 'AI Assistant', _State.loading => 'Generating...', _State.result => 'Command Ready' },
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (_state == _State.input)
                    Text('Describe a task to generate a command', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.outline)),
                ]),
                const Spacer(),
                IconButton(icon: Icon(MdiIcons.close, size: 20), onPressed: () => Navigator.pop(context),
                  style: IconButton.styleFrom(tapTargetSize: MaterialTapTargetSize.shrinkWrap)),
              ]),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              switchInCurve: Curves.easeOut, switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, a) => FadeTransition(opacity: a, child: SizeTransition(sizeFactor: a, axisAlignment: -1, child: child)),
              child: switch (_state) {
                _State.input => _buildInput(cs),
                _State.loading => _buildLoading(cs),
                _State.result => _buildResult(cs),
              },
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildInput(ColorScheme cs) => Padding(
    key: const ValueKey('input'), padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      if (_error != null) ...[
        Container(
          width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: cs.errorContainer, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Icon(MdiIcons.alertCircleOutline, size: 16, color: cs.onErrorContainer),
            const SizedBox(width: 10),
            Expanded(child: Text(_error!, style: TextStyle(fontSize: 13, color: cs.onErrorContainer))),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      Container(
        decoration: BoxDecoration(
          color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _listening ? cs.error.withValues(alpha: 0.5) : cs.outlineVariant.withValues(alpha: 0.3),
            width: _listening ? 1.5 : 1,
          ),
        ),
        child: Column(children: [
          TextField(
            controller: _prompt, focusNode: _focus, minLines: 1, maxLines: 4,
            textInputAction: TextInputAction.send, onSubmitted: (_) => _generate(),
            style: TextStyle(fontSize: 15, color: cs.onSurface),
            decoration: InputDecoration(
              hintText: _listening ? 'Listening...' : 'What do you need?',
              hintStyle: TextStyle(color: cs.outline.withValues(alpha: 0.7)),
              border: InputBorder.none, contentPadding: const EdgeInsets.fromLTRB(18, 14, 18, 4),
            ),
          ),
          Padding(padding: const EdgeInsets.fromLTRB(8, 0, 8, 8), child: Row(children: [
            if (_speechOk)
              GestureDetector(
                onTap: _toggleListening,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200), padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _listening ? cs.error.withValues(alpha: 0.15) : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: _listening ? [BoxShadow(
                      color: cs.error.withValues(alpha: 0.2 * _pulse.value),
                      blurRadius: 8 + 4 * _pulse.value, spreadRadius: _pulse.value,
                    )] : null,
                  ),
                  child: Icon(_listening ? MdiIcons.microphone : MdiIcons.microphoneOutline,
                    size: 20, color: _listening ? cs.error : cs.outline),
                ),
              ),
            const Spacer(),
            AnimatedScale(scale: _hasInput ? 1.0 : 0.0, duration: const Duration(milliseconds: 150),
              child: Material(color: cs.primary, borderRadius: BorderRadius.circular(12),
                child: InkWell(borderRadius: BorderRadius.circular(12), onTap: _generate,
                  child: Padding(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(MdiIcons.arrowUp, size: 16, color: cs.onPrimary), const SizedBox(width: 4),
                      Text('Generate', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.onPrimary)),
                    ]),
                  ),
                ),
              ),
            ),
          ])),
        ]),
      ),
    ]),
  );

  Widget _buildLoading(ColorScheme cs) => Padding(
    key: const ValueKey('loading'), padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      _promptSummary(cs),
      const SizedBox(height: 20),
      AnimatedBuilder(animation: _shimmer, builder: (_, child) => ShaderMask(
        shaderCallback: (b) => LinearGradient(
          colors: [cs.outline, cs.primary, cs.outline],
          stops: [(_shimmer.value - 0.3).clamp(0.0, 1.0), _shimmer.value, (_shimmer.value + 0.3).clamp(0.0, 1.0)],
        ).createShader(b),
        child: child,
      ), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(MdiIcons.creation, size: 18, color: Colors.white), const SizedBox(width: 8),
        Text('Thinking...', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white)),
      ])),
      const SizedBox(height: 4),
    ]),
  );

  Widget _buildResult(ColorScheme cs) => Padding(
    key: const ValueKey('result'), padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      _promptSummary(cs, maxLines: 1, fontSize: 13),
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFF1A1C2A), borderRadius: BorderRadius.circular(14),
          border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.2)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.fromLTRB(14, 10, 8, 0), child: Row(children: [
            Icon(MdiIcons.consoleLine, size: 14, color: Colors.white54), const SizedBox(width: 6),
            Text('Command', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.white54, letterSpacing: 0.5)),
            const Spacer(),
            IconButton(icon: Icon(MdiIcons.contentCopy, size: 15, color: Colors.white54), onPressed: _copy,
              style: IconButton.styleFrom(tapTargetSize: MaterialTapTargetSize.shrinkWrap, minimumSize: const Size(32, 32))),
          ])),
          Padding(padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
            child: TextField(controller: _command, maxLines: null,
              style: GoogleFonts.jetBrainsMono(fontSize: 14, color: const Color(0xFF7FBF7F), height: 1.5),
              decoration: const InputDecoration.collapsed(hintText: ''))),
        ]),
      ),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: OutlinedButton.icon(onPressed: _reset, icon: Icon(MdiIcons.refresh, size: 16), label: const Text('Retry'),
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)), side: BorderSide(color: cs.outlineVariant)))),
        const SizedBox(width: 10),
        Expanded(flex: 2, child: FilledButton.icon(onPressed: _accept, icon: Icon(MdiIcons.play, size: 18), label: const Text('Run Command'),
          style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))))),
      ]),
    ]),
  );
}
