import 'dart:convert';

import 'package:http/http.dart' as http;

import 'package:replayglows_app/app/build_info.dart';
import 'package:replayglows_app/auth/product_entitlement.dart';
import 'package:replayglows_app/auth/suite_identity.dart';

typedef FirebaseIdTokenResolver =
    Future<String?> Function({required bool forceRefresh});

class SuiteIdentityBridgeClient {
  const SuiteIdentityBridgeClient({http.Client? httpClient})
    : _httpClient = httpClient;

  final http.Client? _httpClient;

  Future<SuiteIdentitySnapshot> resolveFromFirebaseSession({
    required SuiteIdentityRuntimeSession session,
    required SuiteIdentityBridgeRuntimeConfig bridgeConfig,
    required FirebaseIdTokenResolver resolveIdToken,
    bool forceRefresh = false,
  }) async {
    final fallbackAccount = SuiteIdentityAccount(
      provider: SuiteIdentityProvider.firebase,
      providerUserId: session.firebaseUserId,
      email: session.email,
    );

    final response = await _resolveSnapshotFromBridge(
      bridgeConfig: bridgeConfig,
      resolveIdToken: resolveIdToken,
      fallbackAccount: fallbackAccount,
      forceRefresh: forceRefresh,
    );

    if (response == null) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue:
            'suite_identity_bridge_failure(endpoint=${bridgeConfig.endpointLabel})',
      );
    }

    return response;
  }

  Future<SuiteIdentitySnapshot?> _resolveSnapshotFromBridge({
    required SuiteIdentityBridgeRuntimeConfig bridgeConfig,
    required FirebaseIdTokenResolver resolveIdToken,
    required SuiteIdentityAccount fallbackAccount,
    required bool forceRefresh,
  }) async {
    if (!bridgeConfig.isConfigured) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue: 'suite_identity_bridge_missing_url',
      );
    }

    final idToken = (await _resolveIdToken(
      resolveIdToken: resolveIdToken,
      forceRefresh: forceRefresh,
    ))?.trim();
    if (idToken == null || idToken.isEmpty) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue: 'suite_identity_bridge_missing_firebase_token',
      );
    }

    final response = await _requestBridge(
      bridgeUri: bridgeConfig.bridgeUri!,
      idToken: idToken,
    );
    if (response == null) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue:
            'suite_identity_bridge_network_error(endpoint=${bridgeConfig.endpointLabel})',
      );
    }

    if (response.statusCode != 200) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue:
            'suite_identity_bridge_http_${response.statusCode}(endpoint=${bridgeConfig.endpointLabel})',
      );
    }

    final decoded = _decodeSnapshotJson(response.body);
    if (decoded == null) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue:
            'suite_identity_bridge_invalid_json(endpoint=${bridgeConfig.endpointLabel})',
      );
    }

    final snapshot = _parseSnapshot(decoded, fallbackAccount: fallbackAccount);
    if (snapshot == null) {
      return SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.recognized,
        globalUserId: null,
        accounts: [fallbackAccount],
        entitlements: const [],
        issue:
            'suite_identity_bridge_invalid_schema(endpoint=${bridgeConfig.endpointLabel})',
      );
    }

    return snapshot;
  }

  Future<String?> _resolveIdToken({
    required FirebaseIdTokenResolver resolveIdToken,
    required bool forceRefresh,
  }) async {
    try {
      return resolveIdToken(forceRefresh: forceRefresh);
    } catch (_) {
      return null;
    }
  }

  Future<http.Response?> _requestBridge({
    required Uri bridgeUri,
    required String idToken,
  }) async {
    try {
      return await (_httpClient ?? http.Client()).post(
        bridgeUri,
        headers: <String, String>{
          'Authorization': 'Bearer $idToken',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Accept-Version': '2026-06-02',
        },
        body: '{}',
      );
    } catch (_) {
      return null;
    }
  }

  static Map<String, dynamic>? _decodeSnapshotJson(String rawBody) {
    try {
      final decoded = jsonDecode(rawBody);
      if (decoded is Map) {
        return decoded.cast<String, dynamic>();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static SuiteIdentitySnapshot? _parseSnapshot(
    Map<String, Object?> payload, {
    required SuiteIdentityAccount fallbackAccount,
  }) {
    final status = _parseStatus(payload['status']);
    final globalUserId =
        _parseNonEmptyString(payload['globalUserId']) ??
        _parseNonEmptyString(payload['global_user_id']);
    final accounts = _parseAccounts(payload['accounts']);
    final entitlements = _parseEntitlements(payload['entitlements']);
    final productToken =
        _parseNonEmptyString(payload['productToken']) ??
        _parseNonEmptyString(payload['product_token']);
    final parsedStatus = status ?? SuiteIdentityStatus.recognized;

    return SuiteIdentitySnapshot(
      status: parsedStatus,
      globalUserId: globalUserId,
      accounts: accounts.isEmpty ? [fallbackAccount] : accounts,
      entitlements: entitlements,
      productToken: productToken,
      issue: null,
    );
  }

  static SuiteIdentityStatus? _parseStatus(Object? rawValue) {
    final value = _parseNonEmptyString(rawValue);
    if (value == null) {
      return SuiteIdentityStatus.recognized;
    }
    final normalized = value.toLowerCase();
    switch (normalized) {
      case 'ok':
      case 'recognized':
      case 'account_recognized':
        return SuiteIdentityStatus.recognized;
      case 'accessactive':
      case 'access_active':
      case 'access-active':
        return SuiteIdentityStatus.accessActive;
      case 'accessinactive':
      case 'access_inactive':
      case 'access-inactive':
        return SuiteIdentityStatus.accessInactive;
      case 'linkingrequired':
      case 'linking_required':
      case 'linking-required':
        return SuiteIdentityStatus.linkingRequired;
      case 'unavailable':
      case 'indeterminate':
        return SuiteIdentityStatus.unavailable;
      case 'unknown':
        return SuiteIdentityStatus.unknown;
      default:
        return null;
    }
  }

  static List<SuiteIdentityAccount> _parseAccounts(Object? rawValue) {
    if (rawValue is! List) {
      return const [];
    }

    final accounts = <SuiteIdentityAccount>[];
    for (final entry in rawValue) {
      if (entry is! Map) {
        continue;
      }
      final normalized = Map<String, Object?>.from(entry);
      final providerRaw = _parseNonEmptyString(
        normalized['provider'],
      )?.toLowerCase();
      final providerUserId =
          _parseNonEmptyString(normalized['providerUserId']) ??
          _parseNonEmptyString(normalized['provider_user_id']);

      if (providerRaw == null || providerUserId == null) {
        continue;
      }

      final provider = _parseProvider(providerRaw);
      accounts.add(
        SuiteIdentityAccount(
          provider: provider,
          providerUserId: providerUserId,
          email: _parseNonEmptyString(normalized['email']),
        ),
      );
    }
    return accounts;
  }

  static SuiteIdentityProvider _parseProvider(String value) {
    final normalized = value.trim().toLowerCase();
    switch (normalized) {
      case 'clerk':
        return SuiteIdentityProvider.clerk;
      case 'firebase':
        return SuiteIdentityProvider.firebase;
      case 'local':
        return SuiteIdentityProvider.local;
      default:
        return SuiteIdentityProvider.unknown;
    }
  }

  static List<ProductEntitlement> _parseEntitlements(Object? rawValue) {
    if (rawValue is! List) {
      return const [];
    }
    final entitlements = <ProductEntitlement>[];

    for (final entry in rawValue) {
      if (entry is! Map) {
        continue;
      }

      final normalized = Map<String, Object?>.from(entry);
      final productId =
          _parseNonEmptyString(normalized['productId']) ??
          _parseNonEmptyString(normalized['product_id']);
      final statusValue = _parseNonEmptyString(normalized['status']);
      if (productId == null || statusValue == null) {
        continue;
      }

      final status = _parseEntitlementStatus(statusValue);
      if (status == null) {
        continue;
      }

      entitlements.add(
        ProductEntitlement(
          productId: productId,
          status: status,
          plan: _parseNonEmptyString(normalized['plan']),
          source: _parseNonEmptyString(normalized['source']),
          sourceRef:
              _parseNonEmptyString(normalized['sourceRef']) ??
              _parseNonEmptyString(normalized['source_ref']),
          environment: _parseNonEmptyString(normalized['environment']),
          updatedAt: _parseDateTime(
            _parseNonEmptyString(normalized['updatedAt']) ??
                _parseNonEmptyString(normalized['updated_at']),
          ),
        ),
      );
    }

    return entitlements;
  }

  static ProductEntitlementStatus? _parseEntitlementStatus(String value) {
    final normalized = value.trim().toLowerCase();
    switch (normalized) {
      case 'active':
        return ProductEntitlementStatus.active;
      case 'trialing':
        return ProductEntitlementStatus.trialing;
      case 'inactive':
        return ProductEntitlementStatus.inactive;
      case 'expired':
        return ProductEntitlementStatus.expired;
      case 'refunded':
        return ProductEntitlementStatus.refunded;
      case 'revoked':
        return ProductEntitlementStatus.revoked;
      case 'pendingreview':
      case 'pending_review':
        return ProductEntitlementStatus.pendingReview;
      default:
        return null;
    }
  }

  static DateTime? _parseDateTime(String? value) {
    if (value == null) {
      return null;
    }
    return DateTime.tryParse(value)?.toUtc();
  }

  static String? _parseNonEmptyString(Object? value) {
    if (value is! String) {
      return null;
    }
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }
}

class SuiteIdentityRuntimeSession {
  const SuiteIdentityRuntimeSession({
    required this.firebaseUserId,
    required this.email,
    this.userName,
    this.imageUrl,
  });

  final String firebaseUserId;
  final String email;
  final String? userName;
  final String? imageUrl;
}

SuiteIdentityBridgeRuntimeConfig
suiteIdentityBridgeRuntimeConfigFromBuildInfo() {
  return SuiteIdentityBridgeRuntimeConfig(
    url: trimmedSuiteIdentityBridgeUrl,
    endpointLabel: trimmedSuiteIdentityBridgeUrl.isEmpty
        ? 'missing'
        : _extractHostLabel(trimmedSuiteIdentityBridgeUrl),
  );
}

String _extractHostLabel(String value) {
  final uri = Uri.tryParse(value);
  if (uri == null || uri.host.isEmpty) {
    return 'invalid';
  }
  return uri.host;
}
