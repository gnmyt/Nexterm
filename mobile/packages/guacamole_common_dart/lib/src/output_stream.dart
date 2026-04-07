import 'status.dart';

class GuacOutputStream {
  final int index;

  void Function(GuacStatus status)? onack;

  GuacOutputStream(this.index);
}
