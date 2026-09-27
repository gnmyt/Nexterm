import 'package:flutter_test/flutter_test.dart';
import 'package:nexterm/utils/sftp_settings.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('exposeToFilesApp defaults to false and persists', () async {
    SharedPreferences.setMockInitialValues({});
    final settings = await SftpSettings.load();
    expect(settings.exposeToFilesApp, isFalse);
    await settings.setExposeToFilesApp(true);
    expect(settings.exposeToFilesApp, isTrue);
    final reloaded = await SftpSettings.load();
    expect(reloaded.exposeToFilesApp, isTrue);
  });
}
