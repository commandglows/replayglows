import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/app/build_info.dart';

void main() {
  group('FirebaseRuntimeConfig.resolve', () {
    test('reports required fields and ignores optional fields', () {
      final config = FirebaseRuntimeConfig.resolve(
        projectId: 'project-1',
        apiKey: 'api-key',
        appId: '',
        messagingSenderId: '',
        authDomain: '',
        storageBucket: '',
      );

      expect(config.projectId, 'project-1');
      expect(config.apiKey, 'api-key');
      expect(config.authDomain, isEmpty);
      expect(config.storageBucket, isEmpty);
      expect(config.isComplete, isFalse);
      expect(
        config.missingEnvironmentNames,
        containsAll(<String>[
          FirebaseRuntimeConfig.appIdEnvironmentName,
          FirebaseRuntimeConfig.messagingSenderIdEnvironmentName,
        ]),
      );
      expect(
        config.missingEnvironmentNames,
        isNot(contains(FirebaseRuntimeConfig.authDomainEnvironmentName)),
      );
      expect(
        config.missingEnvironmentNames,
        isNot(contains(FirebaseRuntimeConfig.storageBucketEnvironmentName)),
      );
    });

    test('reports fully configured state when required values are present', () {
      final config = FirebaseRuntimeConfig.resolve(
        projectId: 'project-2',
        apiKey: 'api-key',
        appId: 'app-id',
        messagingSenderId: 'sender-id',
        authDomain: 'https://auth.example',
        storageBucket: 'bucket',
      );

      expect(config.isComplete, isTrue);
      expect(config.missingEnvironmentNames, isEmpty);
    });
  });
}
