import 'package:replayglows_app/app/build_info.dart';
import 'package:replayglows_app/auth/product_entitlement.dart';

enum SuiteIdentityStatus {
  unknown,
  recognized,
  linkingRequired,
  accessActive,
  accessInactive,
  unavailable,
}

enum SuiteIdentityProvider { clerk, firebase, local, unknown }

class SuiteIdentityAccount {
  const SuiteIdentityAccount({
    required this.provider,
    required this.providerUserId,
    this.email,
  });

  final SuiteIdentityProvider provider;
  final String providerUserId;
  final String? email;
}

class SuiteIdentitySnapshot {
  const SuiteIdentitySnapshot({
    required this.status,
    this.globalUserId,
    this.accounts = const [],
    this.entitlements = const [],
    this.productToken,
    this.issue,
  });

  const SuiteIdentitySnapshot.unavailable(this.issue)
    : status = SuiteIdentityStatus.unavailable,
      globalUserId = null,
      accounts = const [],
      entitlements = const [],
      productToken = null;

  final SuiteIdentityStatus status;
  final String? globalUserId;
  final List<SuiteIdentityAccount> accounts;
  final List<ProductEntitlement> entitlements;
  final String? productToken;
  final String? issue;

  bool get accountRecognized =>
      status != SuiteIdentityStatus.unavailable &&
      status != SuiteIdentityStatus.unknown;

  bool get hasReplayGlowsAccess {
    final productIds = {
      replayGlowsProductId.trim(),
      ...replayGlowsLegacyProductIds
          .split(',')
          .map((value) => value.trim())
          .where((value) => value.isNotEmpty),
    }..removeWhere((value) => value.isEmpty);

    return entitlements.any(
      (entry) => productIds.contains(entry.productId) && entry.grantsAccess,
    );
  }
}

class SuiteIdentityBridgeRuntimeConfig {
  const SuiteIdentityBridgeRuntimeConfig({
    required this.url,
    this.endpointLabel = 'default',
  });

  final String url;
  final String endpointLabel;

  bool get isConfigured {
    final hasUrl = url.trim().isNotEmpty;
    return hasUrl && Uri.tryParse(url)?.hasAbsolutePath == true;
  }

  Uri? get bridgeUri {
    if (!isConfigured) {
      return null;
    }
    return Uri.tryParse(url.trim());
  }
}
