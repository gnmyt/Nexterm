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
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 4),
            child: Row(children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
              const SizedBox(width: 4),
              Expanded(child: Text('Connections', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
              Material(
                color: cs.primaryContainer,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  onTap: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => DeviceSetupScreen(authManager: authManager, isAddingServer: true),
                  )),
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Icon(Icons.add, size: 20, color: cs.onPrimaryContainer),
                  ),
                ),
              ),
            ]),
          ),
          Expanded(
            child: ListenableBuilder(
              listenable: authManager.accountManager,
              builder: (_, __) {
                final accounts = authManager.accountManager.accounts;
                final activeId = authManager.accountManager.activeAccountId;
                if (accounts.isEmpty) return _empty(cs, tt);
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  itemCount: accounts.length,
                  itemBuilder: (_, i) => _accountTile(context, accounts[i], accounts[i].id == activeId, cs),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }

  Widget _empty(ColorScheme cs, TextTheme tt) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: cs.surfaceContainerHigh, shape: BoxShape.circle),
        child: Icon(MdiIcons.serverNetworkOff, size: 32, color: cs.outline),
      ),
      const SizedBox(height: 20),
      Text('No connections', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      Text('Add a server to get started', style: tt.bodySmall?.copyWith(color: cs.outline)),
    ]),
  );

  Widget _accountTile(BuildContext context, ServerAccount a, bool active, ColorScheme cs) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Material(
      color: cs.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: active ? null : () => authManager.switchAccount(a.id),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: active ? cs.primaryContainer : cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(MdiIcons.serverNetwork, size: 20,
                color: active ? cs.onPrimaryContainer : cs.outline),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(a.label, style: TextStyle(fontSize: 15, fontWeight: active ? FontWeight.w700 : FontWeight.w500), overflow: TextOverflow.ellipsis)),
                if (active) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: cs.primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
                    child: Text('Active', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: cs.primary)),
                  ),
                ],
              ]),
              Padding(padding: const EdgeInsets.only(top: 2),
                child: Text(a.fullName ?? a.username ?? a.displayUrl,
                  style: TextStyle(fontSize: 12, color: cs.outline), overflow: TextOverflow.ellipsis)),
            ])),
            PopupMenuButton<String>(
              icon: Icon(MdiIcons.dotsVertical, color: cs.outline, size: 20),
              onSelected: (v) => _onMenu(context, v, a),
              itemBuilder: (_) => [
                if (!active) const PopupMenuItem(value: 'switch', child: Text('Switch to')),
                const PopupMenuItem(value: 'rename', child: Text('Rename')),
                const PopupMenuItem(value: 'remove', child: Text('Remove')),
              ],
            ),
          ]),
        ),
      ),
    ),
  );

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
