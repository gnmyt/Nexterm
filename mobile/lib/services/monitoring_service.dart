import 'dart:convert';
import '../models/monitoring.dart';
import '../utils/api_client.dart';

class MonitoringService {
  static Future<List<M>> getAll(String token) async {
    final r = await ApiClient.get('/monitoring', token: token);
    if (r.statusCode != 200) throw Exception('Failed: ${r.statusCode}');
    return (json.decode(r.body) as List).map((e) => M.from(e)).toList();
  }

  static Future<M> getDetails(String token, dynamic id, {String range = '1h'}) async {
    final ep = id.toString().startsWith('pve-')
        ? '/monitoring/integration/${id.toString().substring(4)}?timeRange=$range'
        : '/monitoring/$id?timeRange=$range';
    final r = await ApiClient.get(ep, token: token);
    if (r.statusCode != 200) throw Exception('Failed: ${r.statusCode}');
    return M.from(json.decode(r.body));
  }
}
