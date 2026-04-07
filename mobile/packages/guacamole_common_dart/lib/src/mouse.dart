class GuacMouseState {
  double x;
  double y;
  bool left;
  bool middle;
  bool right;
  bool up;
  bool down;

  GuacMouseState({
    this.x = 0,
    this.y = 0,
    this.left = false,
    this.middle = false,
    this.right = false,
    this.up = false,
    this.down = false,
  });

  int get buttonMask {
    int mask = 0;
    if (left) mask |= 1;
    if (middle) mask |= 2;
    if (right) mask |= 4;
    if (up) mask |= 8;
    if (down) mask |= 16;
    return mask;
  }

  GuacMouseState copyWith({
    double? x,
    double? y,
    bool? left,
    bool? middle,
    bool? right,
    bool? up,
    bool? down,
  }) {
    return GuacMouseState(
      x: x ?? this.x,
      y: y ?? this.y,
      left: left ?? this.left,
      middle: middle ?? this.middle,
      right: right ?? this.right,
      up: up ?? this.up,
      down: down ?? this.down,
    );
  }
}
