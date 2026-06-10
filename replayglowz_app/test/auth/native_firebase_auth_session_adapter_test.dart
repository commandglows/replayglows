import 'package:flutter_test/flutter_test.dart';
import 'package:replayglowz_app/auth/auth_session_adapter_native.dart';

void main() {
  test('constructor defers FirebaseAuth.instance until initialise', () {
    expect(NativeFirebaseAuthSessionAdapter.new, returnsNormally);
  });
}
