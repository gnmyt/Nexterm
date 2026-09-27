import 'package:flutter/material.dart';
import 'package:flutter_material_design_icons/flutter_material_design_icons.dart';
import 'package:re_editor/re_editor.dart';
import 'package:re_highlight/styles/atom-one-dark.dart';
import 'package:re_highlight/styles/atom-one-light.dart';
import '../services/sftp_text_file_service.dart';
import '../utils/code_language.dart';

class SftpCodeEditorScreen extends StatefulWidget {
  final String sessionId;
  final String remotePath;
  final String token;

  const SftpCodeEditorScreen({
    super.key,
    required this.sessionId,
    required this.remotePath,
    required this.token,
  });

  @override
  State<SftpCodeEditorScreen> createState() => _SftpCodeEditorScreenState();
}

class _SftpCodeEditorScreenState extends State<SftpCodeEditorScreen> {
  CodeLineEditingController? _controller;
  late final SelectionToolbarController _toolbarController;
  Map<String, CodeHighlightThemeMode> _languages = {};
  bool _loading = true;
  String? _errorMessage;
  String _initialText = '';
  bool _dirty = false;
  bool _saving = false;

  String get _fileName {
    final path = widget.remotePath;
    final slash = path.lastIndexOf('/');
    final name = slash >= 0 ? path.substring(slash + 1) : path;
    return name.isEmpty ? path : name;
  }

  @override
  void initState() {
    super.initState();
    _toolbarController =
        MobileSelectionToolbarController(builder: _toolbarBuilder);
    _load();
  }

  Widget _toolbarBuilder({
    required BuildContext context,
    required TextSelectionToolbarAnchors anchors,
    required CodeLineEditingController controller,
    required VoidCallback onDismiss,
    required VoidCallback onRefresh,
  }) {
    return AdaptiveTextSelectionToolbar.buttonItems(
      anchors: anchors,
      buttonItems: [
        ContextMenuButtonItem(
          label: 'Cut',
          onPressed: () {
            controller.cut();
            onDismiss();
          },
        ),
        ContextMenuButtonItem(
          label: 'Copy',
          onPressed: () {
            controller.copy();
            onDismiss();
          },
        ),
        ContextMenuButtonItem(
          label: 'Paste',
          onPressed: () {
            controller.paste();
            onDismiss();
          },
        ),
        ContextMenuButtonItem(
          label: 'Select All',
          onPressed: () {
            controller.selectAll();
            onRefresh();
          },
        ),
      ],
    );
  }

  void _onChanged() {
    final text = _controller?.text ?? '';
    final dirty = text != _initialText;
    if (dirty != _dirty && mounted) {
      setState(() => _dirty = dirty);
    }
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _errorMessage = null;
      });
    }
    try {
      final text = await SftpTextFileService.loadText(
        sessionId: widget.sessionId,
        remotePath: widget.remotePath,
        token: widget.token,
      );
      if (!mounted) return;
      final langs =
          CodeLanguage.highlightLanguagesForPath(widget.remotePath);
      final controller = CodeLineEditingController.fromText(text);
      _controller?.removeListener(_onChanged);
      _controller?.dispose();
      controller.addListener(_onChanged);
      setState(() {
        _controller = controller;
        _languages = langs;
        _initialText = text;
        _dirty = false;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    final controller = _controller;
    if (controller == null || _loading || _saving || !_dirty) return;
    setState(() => _saving = true);
    try {
      await SftpTextFileService.saveText(
        sessionId: widget.sessionId,
        remotePath: widget.remotePath,
        token: widget.token,
        content: controller.text,
      );
      if (!mounted) return;
      setState(() {
        _initialText = controller.text;
        _dirty = false;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Save failed: $e')),
      );
    }
  }

  Future<void> _confirmDiscard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text('You have unsaved changes. Discard them?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (discard == true && mounted) {
      setState(() {
        _initialText = _controller?.text ?? '';
        _dirty = false;
      });
      Navigator.of(context).pop();
    }
  }

  void _onClosePressed() {
    if (_dirty) {
      _confirmDiscard();
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _controller?.removeListener(_onChanged);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canSave =
        _dirty && !_saving && !_loading && _controller != null;
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _dirty) {
          _confirmDiscard();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: Icon(MdiIcons.close),
            onPressed: _onClosePressed,
            tooltip: 'Close',
          ),
          title: Row(
            children: [
              Expanded(
                child: Text(
                  _fileName,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (_dirty)
                Text(
                  ' ●',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontSize: 14,
                  ),
                ),
            ],
          ),
          actions: [
            if (_saving)
              const Padding(
                padding: EdgeInsets.all(14),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else
              IconButton(
                icon: Icon(MdiIcons.contentSave),
                onPressed: canSave ? _save : null,
                tooltip: 'Save',
              ),
          ],
        ),
        body: SafeArea(child: _buildBody(isDark)),
      ),
    );
  }

  Widget _buildBody(bool isDark) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final error = _errorMessage;
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                MdiIcons.alertCircleOutline,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(
                error,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _load,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    final controller = _controller;
    if (controller == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return CodeEditor(
      controller: controller,
      wordWrap: false,
      autofocus: false,
      toolbarController: _toolbarController,
      style: CodeEditorStyle(
        fontSize: 14,
        fontFamily: 'monospace',
        codeTheme: _languages.isEmpty
            ? null
            : CodeHighlightTheme(
                languages: _languages,
                theme: isDark ? atomOneDarkTheme : atomOneLightTheme,
              ),
      ),
      indicatorBuilder:
          (context, editingController, chunkController, notifier) {
        return Row(
          children: [
            DefaultCodeLineNumber(
              controller: editingController,
              notifier: notifier,
            ),
            DefaultCodeChunkIndicator(
              width: 20,
              controller: chunkController,
              notifier: notifier,
            ),
          ],
        );
      },
    );
  }
}
