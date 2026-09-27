import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nexterm/utils/sftp_edit.dart';

void main() {
  group('fnv1a63Hex', () {
    test('is stable for identical input', () {
      expect(fnv1a63Hex('hello'.codeUnits), fnv1a63Hex('hello'.codeUnits));
    });

    test('differs when bytes change', () {
      expect(fnv1a63Hex('hello'.codeUnits), isNot(fnv1a63Hex('hallo'.codeUnits)));
    });
  });

  group('pendingEditChanged', () {
    test('detects size and hash changes, ignores mtime-only touch', () {
      expect(
        pendingEditChanged(
          oldSize: 5, oldMtimeMs: 1, oldHash: 'aa',
          newSize: 6, newMtimeMs: 1, newHash: 'aa',
        ),
        isTrue,
      );
      expect(
        pendingEditChanged(
          oldSize: 5, oldMtimeMs: 1, oldHash: 'aa',
          newSize: 5, newMtimeMs: 2, newHash: 'aa',
        ),
        isFalse,
      );
      expect(
        pendingEditChanged(
          oldSize: 5, oldMtimeMs: 1, oldHash: 'aa',
          newSize: 5, newMtimeMs: 1, newHash: 'bb',
        ),
        isTrue,
      );
      expect(
        pendingEditChanged(
          oldSize: 5, oldMtimeMs: 1, oldHash: 'aa',
          newSize: 5, newMtimeMs: 1, newHash: 'aa',
        ),
        isFalse,
      );
    });
  });

  group('hashEditFile', () {
    test('matches fnv1a63Hex of file bytes', () async {
      final dir = await Directory.systemTemp.createTemp('nexterm_test');
      try {
        final file = File('${dir.path}/a.txt');
        await file.writeAsString('hello nexterm');
        expect(await hashEditFile(file), fnv1a63Hex('hello nexterm'.codeUnits));
      } finally {
        await dir.delete(recursive: true);
      }
    });
  });
}
