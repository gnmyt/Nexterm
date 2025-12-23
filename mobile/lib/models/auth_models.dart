class LoginRequest {
  final String username;
  final String password;
  final int? code;

  const LoginRequest({required this.username, required this.password, this.code});

  Map<String, dynamic> toJson() => {
    'username': username,
    'password': password,
    if (code != null) 'code': code,
  };
}

class LoginResponse {
  final String? token;
  final bool? totpRequired;
  final String? error;
  final int? statusCode;
  final int? code;

  const LoginResponse({this.token, this.totpRequired, this.error, this.statusCode, this.code});

  factory LoginResponse.fromJson(Map<String, dynamic> json, int statusCode) {
    final jsonCode = json['code'] as int?;
    if (jsonCode == 202) {
      return LoginResponse(totpRequired: true, statusCode: statusCode, code: jsonCode);
    }
    if (json.containsKey('token')) {
      return LoginResponse(token: json['token'], statusCode: statusCode, code: jsonCode);
    }
    return LoginResponse(error: json['message'] ?? 'Login failed', statusCode: statusCode, code: jsonCode);
  }

  bool get isSuccess => statusCode == 200 && token != null;
}

class RegisterRequest {
  final String username;
  final String password;
  final String firstName;
  final String lastName;

  const RegisterRequest({required this.username, required this.password, required this.firstName, required this.lastName});

  Map<String, dynamic> toJson() => {'username': username, 'password': password, 'firstName': firstName, 'lastName': lastName};
}

class UserInfo {
  final String username;
  final String firstName;
  final String lastName;
  final String role;
  final bool totpEnabled;

  const UserInfo({required this.username, required this.firstName, required this.lastName, required this.role, required this.totpEnabled});

  factory UserInfo.fromJson(Map<String, dynamic> json) => UserInfo(
    username: json['username'] ?? '',
    firstName: json['firstName'] ?? '',
    lastName: json['lastName'] ?? '',
    role: json['role'] ?? 'user',
    totpEnabled: json['totpEnabled'] ?? false,
  );

  String get fullName => '$firstName $lastName';
}

class LogoutRequest {
  final String token;

  const LogoutRequest({required this.token});

  Map<String, dynamic> toJson() => {'token': token};
}
