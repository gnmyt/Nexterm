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
