import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart';
import 'package:http/testing.dart';
import 'package:replayglows_app/auth/product_entitlement.dart';
import 'package:replayglows_app/auth/suite_identity.dart';
import 'package:replayglows_app/auth/suite_identity_bridge_client.dart';

void main() {
  group('SuiteIdentityBridgeClient', () {
    const config = SuiteIdentityBridgeRuntimeConfig(
      url: 'https://example.invalid/api/bridge/replayglows/native',
      endpointLabel: 'example.invalid',
    );

    test('returns recognized snapshot when bridge URL is missing', () async {
      const bridge = SuiteIdentityBridgeClient();

      final snapshot = await bridge.resolveFromFirebaseSession(
        session: const SuiteIdentityRuntimeSession(
          firebaseUserId: 'firebase-1',
          email: 'user@example.com',
        ),
        bridgeConfig: const SuiteIdentityBridgeRuntimeConfig(url: ''),
        resolveIdToken: ({required bool forceRefresh}) async => 'token',
      );

      expect(snapshot.status, SuiteIdentityStatus.recognized);
      expect(snapshot.issue, contains('missing_url'));
      expect(snapshot.accounts.single.provider, SuiteIdentityProvider.firebase);
      expect(snapshot.accounts.single.providerUserId, 'firebase-1');
      expect(snapshot.accounts.single.email, 'user@example.com');
    });

    test('returns bridge issue when id token is missing', () async {
      const bridge = SuiteIdentityBridgeClient();
      final snapshot = await bridge.resolveFromFirebaseSession(
        session: const SuiteIdentityRuntimeSession(
          firebaseUserId: 'firebase-1',
          email: 'user@example.com',
        ),
        bridgeConfig: config,
        resolveIdToken: ({required bool forceRefresh}) async => null,
      );

      expect(snapshot.issue, contains('missing_firebase_token'));
    });

    test(
      'parses status and entitlements from a valid bridge response',
      () async {
        final client = MockClient((Request request) async {
          expect(request.headers['Authorization'], 'Bearer firebase-id-token');
          final payload = {
            'status': 'accessActive',
            'globalUserId': 'global-1',
            'accounts': [
              {
                'provider': 'clerk',
                'providerUserId': 'clerk-u1',
                'email': 'clerk@example.com',
              },
            ],
            'entitlements': [
              {'productId': 'replayglows', 'status': 'active', 'plan': 'pro'},
            ],
            'productToken': 'bridge-token',
          };
          return Response(
            jsonEncode(payload),
            200,
            headers: {'content-type': 'application/json'},
          );
        });
        final bridge = SuiteIdentityBridgeClient(httpClient: client);

        final snapshot = await bridge.resolveFromFirebaseSession(
          session: const SuiteIdentityRuntimeSession(
            firebaseUserId: 'firebase-1',
            email: 'user@example.com',
          ),
          bridgeConfig: config,
          resolveIdToken: ({required bool forceRefresh}) async {
            return 'firebase-id-token';
          },
        );

        expect(snapshot.status, SuiteIdentityStatus.accessActive);
        expect(snapshot.globalUserId, 'global-1');
        expect(snapshot.productToken, 'bridge-token');
        expect(snapshot.issue, isNull);
        expect(snapshot.accounts, hasLength(1));
        expect(snapshot.accounts.single.provider, SuiteIdentityProvider.clerk);
        expect(snapshot.accounts.single.providerUserId, 'clerk-u1');
        expect(snapshot.entitlements, hasLength(1));
        expect(snapshot.entitlements.single.productId, 'replayglows');
        expect(snapshot.entitlements.single.grantsAccess, isTrue);
      },
    );

    test('treats legacy tubeflow entitlement as ReplayGlows access', () {
      const snapshot = SuiteIdentitySnapshot(
        status: SuiteIdentityStatus.accessActive,
        entitlements: [
          ProductEntitlement(
            productId: 'tubeflow',
            status: ProductEntitlementStatus.active,
          ),
        ],
        productToken: 'bridge-token',
      );

      expect(snapshot.hasReplayGlowsAccess, isTrue);
    });

    test('returns issue on non-200 bridge response', () async {
      final client = MockClient((Request request) async {
        return Response('nope', 503);
      });
      final bridge = SuiteIdentityBridgeClient(httpClient: client);

      final snapshot = await bridge.resolveFromFirebaseSession(
        session: const SuiteIdentityRuntimeSession(
          firebaseUserId: 'firebase-1',
          email: 'user@example.com',
        ),
        bridgeConfig: config,
        resolveIdToken: ({required bool forceRefresh}) async => 'token',
      );

      expect(snapshot.issue, contains('http_503'));
    });
  });
}
