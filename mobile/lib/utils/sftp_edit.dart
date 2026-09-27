import 'dart:io';

int fnv1a63(List<int> bytes) {
  var hash = 0xcbf29ce484222325 & 0x7FFFFFFFFFFFFFFF;
  for (final byte in bytes) {
    hash ^= byte;
    hash = (hash * 0x100000001b3) & 0x7FFFFFFFFFFFFFFF;
  }
  return hash;
}

String fnv1a63Hex(List<int> bytes) {
  return fnv1a63(bytes).toRadixString(16).padLeft(16, '0');
}

Future<String> hashEditFile(File file) async {
  var hash = 0xcbf29ce484222325 & 0x7FFFFFFFFFFFFFFF;
  await for (final chunk in file.openRead()) {
    for (final byte in chunk) {
      hash ^= byte;
      hash = (hash * 0x100000001b3) & 0x7FFFFFFFFFFFFFFF;
    }
  }
  return hash.toRadixString(16).padLeft(16, '0');
}

bool pendingEditChanged({
  required int oldSize,
  required int oldMtimeMs,
  required String oldHash,
  required int newSize,
  required int newMtimeMs,
  required String newHash,
}) {
  return oldSize != newSize || oldHash != newHash;
}
