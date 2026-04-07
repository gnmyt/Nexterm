class GuacParser {
  String _buffer = '';
  List<String> _elementBuffer = [];
  int _elementEnd = -1;
  int _startIndex = 0;
  int _elementCodepoints = 0;

  static const int _bufferTruncationThreshold = 4096;

  void Function(String opcode, List<String> args)? oninstruction;

  void receive(String packet) {
    // Truncate buffer as needed
    if (_startIndex > _bufferTruncationThreshold && _elementEnd >= _startIndex) {
      _buffer = _buffer.substring(_startIndex);
      _elementEnd -= _startIndex;
      _startIndex = 0;
    }

    if (_buffer.isNotEmpty) {
      _buffer += packet;
    } else {
      _buffer = packet;
    }

    while (_elementEnd < _buffer.length) {
      // Waiting for element data
      if (_elementEnd >= _startIndex) {
        final codepoints = _codePointCount(_buffer, _startIndex, _elementEnd);
        if (codepoints < _elementCodepoints) {
          _elementEnd += _elementCodepoints - codepoints;
          continue;
        }

        if (_elementCodepoints > 0 &&
            _elementEnd > 0 &&
            _elementEnd - 1 < _buffer.length &&
            _buffer.codeUnitAt(_elementEnd - 1) >= 0xD800 &&
            _buffer.codeUnitAt(_elementEnd - 1) <= 0xDBFF) {
          _elementEnd++;
          continue;
        }

        final element = _buffer.substring(_startIndex, _elementEnd);
        final terminator = _elementEnd < _buffer.length
            ? _buffer[_elementEnd]
            : '';

        _elementBuffer.add(element);

        if (terminator == ';') {
          final opcode = _elementBuffer.removeAt(0);
          oninstruction?.call(opcode, List.unmodifiable(_elementBuffer));
          _elementBuffer = [];

          if (_elementEnd + 1 == _buffer.length) {
            _elementEnd = -1;
            _buffer = '';
          }
        } else if (terminator != ',') {
          if (terminator.isEmpty) break;
          throw FormatException(
              'Element terminator was not ";" nor ",".');
        }

        _startIndex = _elementEnd + 1;
      }

      // Search for end of length
      final lengthEnd = _buffer.indexOf('.', _startIndex);
      if (lengthEnd != -1) {
        final lengthStr = _buffer.substring(
            _elementEnd == -1 ? 0 : _elementEnd + 1, lengthEnd);
        _elementCodepoints = int.tryParse(lengthStr) ?? 0;
        _startIndex = lengthEnd + 1;
        _elementEnd = _startIndex + _elementCodepoints;
      } else {
        _startIndex = _buffer.length;
        break;
      }
    }
  }

  static int _codePointCount(String str, int start, int end) {
    if (end > str.length) end = str.length;
    final sub = str.substring(start, end);
    return sub.runes.length;
  }

  static String toInstruction(List<Object> elements) {
    final buf = StringBuffer();
    for (int i = 0; i < elements.length; i++) {
      if (i > 0) buf.write(',');
      final str = elements[i].toString();
      buf.write(str.runes.length);
      buf.write('.');
      buf.write(str);
    }
    buf.write(';');
    return buf.toString();
  }
}
