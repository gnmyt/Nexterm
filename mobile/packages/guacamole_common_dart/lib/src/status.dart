class GuacStatus {
  final int code;
  final String message;

  const GuacStatus(this.code, [this.message = '']);

  bool get isError => code >= 0x0100;

  static const int success = 0x0000;
  static const int unsupported = 0x0100;
  static const int serverError = 0x0200;
  static const int serverBusy = 0x0201;
  static const int upstreamTimeout = 0x0202;
  static const int upstreamError = 0x0203;
  static const int resourceNotFound = 0x0204;
  static const int resourceConflict = 0x0205;
  static const int upstreamNotFound = 0x0207;
  static const int clientBadRequest = 0x0300;
  static const int clientUnauthorized = 0x0301;
  static const int clientForbidden = 0x0303;
  static const int clientTimeout = 0x0308;
  static const int clientOverrun = 0x030D;
  static const int clientBadType = 0x030F;
  static const int clientTooMany = 0x031D;

  static int fromWebSocketCode(int code) {
    switch (code) {
      case 1000: return success;
      case 1001: return serverError;
      case 1009: return clientOverrun;
      case 1011: return serverError;
      case 1015: return upstreamNotFound;
      default:
        if (code >= 4000 && code <= 4999) return code - 4000;
        return upstreamNotFound;
    }
  }

  @override
  String toString() => 'GuacStatus($code, $message)';
}
