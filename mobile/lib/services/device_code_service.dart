import 'dart:convert';
import '../utils/api_client.dart';

class DeviceCodeResponse {
  final String code;
  final String token;
  final DateTime expiresAt;
  final String? error;

  DeviceCodeResponse({
    required this.code,
    required this.token,
    required this.expiresAt,
    this.error,
  });

  factory DeviceCodeResponse.fromJson(Map<String, dynamic> json) {
    return DeviceCodeResponse(
      code: json['code'] ?? '',
      token: json['token'] ?? '',
      expiresAt: json['expiresAt'] != null 
          ? DateTime.parse(json['expiresAt']) 
          : DateTime.now().add(const Duration(minutes: 10)),
    );
  }

  factory DeviceCodeResponse.error(String message) {
    return DeviceCodeResponse(
      code: '',
      token: '',
      expiresAt: DateTime.now(),
      error: message,
    );
  }
}

class DevicePollResponse {
  final String status;
  final String? token;

  DevicePollResponse({required this.status, this.token});

  factory DevicePollResponse.fromJson(Map<String, dynamic> json) {
    return DevicePollResponse(
      status: json['status'] ?? 'invalid',
      token: json['token'],
    );
  }

  bool get isPending => status == 'pending';
  bool get isAuthorized => status == 'authorized';
  bool get isInvalid => status == 'invalid';
}

class DeviceCodeService {
  static const String _createEndpoint = '/auth/device/create';
  static const String _pollEndpoint = '/auth/device/poll';

  Future<DeviceCodeResponse> createCode() async {
    try {
      final response = await ApiClient.post(
        _createEndpoint,
        body: {'clientType': 'mobile'},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = json.decode(response.body);
        if (data['code'] != null && data['code'] is String) {
          return DeviceCodeResponse.fromJson(data);
        }
        return DeviceCodeResponse.error(data['message'] ?? 'Failed to create device code');
      } else if (response.statusCode == 429) {
        return DeviceCodeResponse.error('Too many requests. Please try again later.');
      } else {
        final data = json.decode(response.body);
        return DeviceCodeResponse.error(data['message'] ?? 'Failed to create device code');
      }
    } catch (e) {
      return DeviceCodeResponse.error('Connection error: $e');
    }
  }

  Future<DevicePollResponse> pollToken(String token) async {
    try {
      final response = await ApiClient.post(
        _pollEndpoint,
        body: {'token': token},
      );

      if (response.statusCode == 200) {
        return DevicePollResponse.fromJson(json.decode(response.body));
      }
      return DevicePollResponse(status: 'invalid');
    } catch (e) {
      return DevicePollResponse(status: 'error');
    }
  }
}
