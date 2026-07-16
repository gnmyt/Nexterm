class IntegerPool {
  int _nextInt = 0;
  final List<int> _free = [];

  int next() {
    if (_free.isNotEmpty) return _free.removeLast();
    return _nextInt++;
  }

  void free(int value) {
    _free.add(value);
  }
}
