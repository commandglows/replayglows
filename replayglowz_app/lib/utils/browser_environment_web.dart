import 'package:web/web.dart' as web;

class BrowserEnvironment {
  const BrowserEnvironment({
    required this.isWeb,
    required this.isFirefox,
    required this.isVivaldi,
  });

  final bool isWeb;
  final bool isFirefox;
  final bool isVivaldi;
}

BrowserEnvironment currentBrowserEnvironment() {
  final userAgent = web.window.navigator.userAgent.toLowerCase();
  return BrowserEnvironment(
    isWeb: true,
    isFirefox: userAgent.contains('firefox') || userAgent.contains('fxios'),
    isVivaldi: userAgent.contains('vivaldi'),
  );
}
