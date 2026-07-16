class GuacInputStream {
  final int index;

  void Function(String data)? onblob;

  void Function()? onend;

  GuacInputStream(this.index);
}
