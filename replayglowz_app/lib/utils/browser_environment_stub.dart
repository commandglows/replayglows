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

BrowserEnvironment currentBrowserEnvironment() =>
    const BrowserEnvironment(isWeb: false, isFirefox: false, isVivaldi: false);
