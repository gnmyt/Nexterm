import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

Future<String?> showConnectionReasonDialog(BuildContext context, String serverName) {
  return showDialog<String>(
    context: context,
    builder: (_) => ConnectionReasonDialog(serverName: serverName),
  );
}

class ConnectionReasonDialog extends StatefulWidget {
  final String serverName;

  const ConnectionReasonDialog({super.key, required this.serverName});

  @override
  State<ConnectionReasonDialog> createState() => _ConnectionReasonDialogState();
}

class _ConnectionReasonDialogState extends State<ConnectionReasonDialog> {
  final _reason = TextEditingController();

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  void _connect() {
    final reason = _reason.text.trim();
    if (reason.isEmpty) return;
    Navigator.pop(context, reason);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return AlertDialog(
      title: const Text('Connection Reason Required'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text.rich(
          TextSpan(children: [
            const TextSpan(text: 'Please provide a reason for connecting to '),
            TextSpan(text: widget.serverName, style: const TextStyle(fontWeight: FontWeight.w700)),
            const TextSpan(text: ':'),
          ]),
          style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _reason,
          autofocus: true,
          minLines: 3,
          maxLines: 3,
          maxLength: 500,
          buildCounter: (_, {required currentLength, required isFocused, maxLength}) =>
              Text('$currentLength/$maxLength', style: TextStyle(fontSize: 11, color: cs.outline)),
          textInputAction: TextInputAction.newline,
          inputFormatters: [LengthLimitingTextInputFormatter(500)],
          decoration: InputDecoration(
            hintText: 'Enter your reason for this connection...',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _reason.text.trim().isEmpty ? null : _connect, child: const Text('Connect')),
      ],
    );
  }
}
