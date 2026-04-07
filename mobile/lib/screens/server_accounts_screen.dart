import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../models/server_account.dart';
import '../utils/auth_manager.dart';
import '../screens/device_setup_screen.dart';

class ServerAccountsScreen extends StatelessWidget {
  final AuthManager authManager;

  const ServerAccountsScreen({super.key, required this.authManager});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Connections')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => DeviceSetupScreen(authManager: authManager, isAddingServer: true),
        )),
        child: const Icon(Icons.add),
      ),
      body: ListenableBuilder(
        listenable: authManager.accountManager,
        builder: (context, _) {
          final accounts = authManager.accountManager.accounts;
          final activeId = authManager.accountManager.activeAccountId;
          return ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: accounts.length,
            itemBuilder: (context, i) {
              final a = accounts[i];
              final active = a.id == activeId;
              return Card(
                margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: active ? cs.primary : cs.surfaceContainerHighest,
                    child: Icon(MdiIcons.serverNetwork, color: active ? cs.onPrimary : cs.onSurfaceVariant),
                  ),
                  title: Text(a.label, style: TextStyle(fontWeight: active ? FontWeight.bold : FontWeight.normal)),
                  subtitle: Text(a.fullName ?? a.username ?? a.displayUrl),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (active) Chip(label: const Text('Active'), visualDensity: VisualDensity.compact),
                    PopupMenuButton<String>(
                      onSelected: (v) => _onMenu(context, v, a),
                      itemBuilder: (_) => [
                        if (!active) const PopupMenuItem(value: 'switch', child: Text('Switch to')),
                        const PopupMenuItem(value: 'rename', child: Text('Rename')),
                        const PopupMenuItem(value: 'remove', child: Text('Remove')),
                      ],
                    ),
                  ]),
                  onTap: active ? null : () => authManager.switchAccount(a.id),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _onMenu(BuildContext context, String action, ServerAccount account) {
    switch (action) {
      case 'switch': authManager.switchAccount(account.id);
      case 'rename': _showRenameDialog(context, account);
      case 'remove': _showRemoveDialog(context, account);
    }
  }

  void _showRenameDialog(BuildContext context, ServerAccount account) {
    final controller = TextEditingController(text: account.label);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename Server'),
        content: TextField(controller: controller, decoration: const InputDecoration(labelText: 'Label', border: OutlineInputBorder()), autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () {
            final l = controller.text.trim();
            if (l.isNotEmpty) { account.label = l; authManager.accountManager.updateAccount(account); }
            Navigator.pop(ctx);
          }, child: const Text('Rename')),
        ],
      ),
    );
  }

  void _showRemoveDialog(BuildContext context, ServerAccount account) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Server'),
        content: Text('Remove "${account.label}"? This will log you out.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () { authManager.removeAccount(account.id); Navigator.pop(ctx); },
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }
}
