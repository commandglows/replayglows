import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:replayglows_app/models/settings.dart';
import 'package:replayglows_app/providers/providers.dart';

ThemeMode appThemeModeToThemeMode(AppThemeMode? mode) {
  switch (mode) {
    case AppThemeMode.light:
      return ThemeMode.light;
    case AppThemeMode.dark:
      return ThemeMode.dark;
    case AppThemeMode.system:
    case null:
      return ThemeMode.system;
  }
}

/// Maps persisted app settings to runtime [ThemeMode].
///
/// Fallback remains [ThemeMode.system] while settings are loading
/// or when no settings document exists yet.
final themeModeProvider = Provider<ThemeMode>((ref) {
  final appThemeMode = ref.watch(settingsProvider).asData?.value?.theme;
  return appThemeModeToThemeMode(appThemeMode);
});

/// Design tokens for the ReplayGlows app.
///
/// All color constants are defined here so they can be referenced
/// consistently across both light and dark theme configurations.
abstract final class AppColors {
  // Shared
  static const primary = Color(0xFF0D87E1);
  static const primaryForeground = Color(0xFFFFFFFF);

  // Light mode
  static const lightBackground = Color(0xFFF1F5F9);
  static const lightForeground = Color(0xFF0F172A);
  static const lightCard = Color(0xFFFFFFFF);
  static const lightCardForeground = Color(0xFF0F172A);
  static const lightSecondary = Color(0xFFF1F5F9);
  static const lightSecondaryForeground = Color(0xFF0F172A);
  static const lightMuted = Color(0xFFF1F5F9);
  static const lightMutedForeground = Color(0xFF64748B);
  static const lightDestructive = Color(0xFFEF4444);
  static const lightBorder = Color(0xFFE2E8F0);

  // Dark mode
  static const darkBackground = Color(0xFF050506);
  static const darkForeground = Color(0xFFFAFAFA);
  static const darkCard = Color(0xFF18181B);
  static const darkCardForeground = Color(0xFFFAFAFA);
  static const darkSecondary = Color(0xFF27272A);
  static const darkSecondaryForeground = Color(0xFFFAFAFA);
  static const darkMuted = Color(0xFF27272A);
  static const darkMutedForeground = Color(0xFFA1A1AA);
  static const darkDestructive = Color(0xFF7F1D1D);
  static const darkBorder = Color(0xFF27272A);

  // Runtime-selectable playlist palette. These colors are persisted as user
  // data, but remain centralized so every playlist surface uses the same set.
  static const playlistPurple = Colors.purple;
  static const playlistBlue = Colors.blue;
  static const playlistTeal = Colors.teal;
  static const playlistGreen = Colors.green;
  static const playlistOrange = Colors.orange;
  static const playlistRed = Colors.red;
  static const playlistPink = Colors.pink;
  static const playlistIndigo = Colors.indigo;
  static const playlistPalette = <Color>[
    playlistPurple,
    playlistBlue,
    playlistTeal,
    playlistGreen,
    playlistOrange,
    playlistRed,
    playlistPink,
    playlistIndigo,
  ];

  // YouTube poster overlays need fixed contrast independent of app theme.
  static const videoOverlayBase = Colors.black;
  static const videoOverlayTop = Color(0xA3000000);
  static const videoOverlayMiddle = Color(0x2E000000);
  static const videoOverlayBottom = Color(0x8F000000);
  static const videoOverlayAvatar = Color(0x3DFFFFFF);
  static const videoOverlayForeground = Colors.white;
  static const videoOverlayMuted = Color(0xD1FFFFFF);
  static const videoOverlayShadow = Color(0x5C000000);
}

/// Spacing scale shared by app surfaces and reusable widgets.
abstract final class AppSpacing {
  static const xxxs = 2.0;
  static const xxs = 4.0;
  static const xs = 8.0;
  static const xs2 = 6.0;
  static const sm = 12.0;
  static const sm2 = 14.0;
  static const md = 16.0;
  static const md2 = 20.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const xxl = 48.0;
}

/// Shape tokens for cards, controls, and compact surfaces.
abstract final class AppRadii {
  static const sm = 4.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
  static const pill = 999.0;
}

/// Typography roles and scale. Font files are owned by the app asset layer.
abstract final class AppTypography {
  static const bodyFont = 'Inter';
  static const headingFont = 'Instrument Sans';
  static const displayFont = 'DM Sans';
  static const monospaceFont = 'monospace';

  static const displayLarge = 57.0;
  static const displayMedium = 45.0;
  static const displaySmall = 36.0;
  static const headlineLarge = 32.0;
  static const headlineMedium = 28.0;
  static const headlineSmall = 24.0;
  static const titleLarge = 22.0;
  static const titleMedium = 16.0;
  static const titleSmall = 14.0;
  static const bodyLarge = 16.0;
  static const bodyMedium = 14.0;
  static const bodySmall = 12.0;
  static const labelLarge = 14.0;
  static const labelMedium = 12.0;
  static const labelSmall = 11.0;
  static const mediaLineHeight = 1.4;
  static const noteLineHeight = 1.6;
}

/// Elevation and opacity roles for Material surfaces.
abstract final class AppElevation {
  static const none = 0.0;
  static const raised = 1.0;
  static const modal = 8.0;
  static const scrimOpacity = 0.32;
  static const focusOpacity = 0.12;
}

/// Motion contract used by interactive app surfaces.
abstract final class AppMotion {
  static const fast = Duration(milliseconds: 140);
  static const standard = Duration(milliseconds: 220);
  static const slow = Duration(milliseconds: 320);
  static const feedback = Duration(seconds: 2);
  static const persistentError = Duration(seconds: 8);
  static const curve = Curves.easeOutCubic;
  static const emphasizedCurve = Curves.easeOut;
}

/// Named responsive layout thresholds for adaptive app surfaces.
abstract final class AppBreakpoints {
  static const compact = 600.0;
  static const medium = 840.0;
  static const expanded = 1200.0;
}

/// Minimum interactive dimensions for accessible controls.
abstract final class AppSizes {
  static const minTouchTarget = 44.0;
  static const iconSmall = 16.0;
  static const iconMedium = 24.0;
  static const iconLarge = 32.0;
  static const navigationIcon = 28.0;
  static const emptyStateIcon = 64.0;
  static const compactProgress = 18.0;
  static const authPanelMaxWidth = 520.0;
  static const divider = 1.0;
  static const youtubeLoadingIndicator = 28.0;
  static const youtubeEmptyStateIcon = 76.0;
  static const youtubeAction = 44.0;
  static const youtubeConnectedIcon = 78.0;
  static const navigationRailWidth = 72.0;
  static const shellBottomNavigationHeight = 176.0;
  static const shellCompactAppBarHeight = 72.0;
  static const shellToolbarHeight = 80.0;
  static const videoHeroHeight = 360.0;
  static const videoPanelHeight = 200.0;
  static const videoProgressStroke = 1.5;
  static const feedHeroHeight = 220.0;
  static const avatarSmall = 36.0;
  static const thumbnailWidth = 120.0;
  static const thumbnailHeight = 90.0;
  static const thumbnailLandscapeWidth = 100.0;
  static const thumbnailLandscapeHeight = 56.0;
  static const thumbnailCompactWidth = 80.0;
  static const thumbnailCompactHeight = 45.0;
  static const thumbnailTinyWidth = 50.0;
  static const thumbnailTinyHeight = 36.0;
  static const skeletonTitleHeight = 14.0;
  static const skeletonTitleWidth = 120.0;
  static const skeletonMetaHeight = 10.0;
  static const skeletonMetaWidth = 80.0;
  static const skeletonWideTitleWidth = 200.0;
  static const skeletonWideMetaWidth = 120.0;
  static const skeletonPlaylistTitleWidth = 100.0;
  static const skeletonPlaylistMetaWidth = 60.0;
  static const skeletonDetailTitleWidth = 160.0;
  static const playlistAccentHeight = 60.0;
  static const bottomContentInset = 96.0;
  static const playControlHeight = 56.0;
  static const notificationActionWidth = 56.0;
  static const notificationActionHeight = 42.0;
  static const emptyStateSmallIcon = 48.0;
  static const feedbackOffset = 8.0;
  static const preferencesPanelWidth = 160.0;
  static const compactDividerHeight = 8.0;
  static const statsShortChartHeight = 100.0;
  static const statsMediumChartHeight = 200.0;
  static const statsTallChartHeight = 300.0;
  static const statsSummaryHeight = 80.0;
  static const noteThumbnailWidth = 50.0;
  static const noteDetailHeaderHeight = 60.0;
  static const noteDetailMetaHeight = 30.0;
  static const noteDetailMetaWidth = 80.0;
  static const noteDetailEditorHeight = 100.0;
  static const noteActionWidth = 64.0;
  static const noteActionHeight = 36.0;
}

/// Central theme configuration for ReplayGlows.
///
/// Provides fully-specified [ThemeData] for light and dark modes using the
/// design tokens defined in [AppColors]. Typography uses Inter for body text,
/// Instrument Sans for headings, and DM Sans (weight 700) for display styles.
abstract final class AppTheme {
  // ---------------------------------------------------------------------------
  // Typography
  // ---------------------------------------------------------------------------

  static const _fontBody = AppTypography.bodyFont;
  static const _fontHeading = AppTypography.headingFont;
  static const _fontDisplay = AppTypography.displayFont;

  static TextTheme _buildTextTheme(Color foreground, Color muted) {
    return TextTheme(
      // Display styles — DM Sans 700
      displayLarge: TextStyle(
        fontFamily: _fontDisplay,
        fontWeight: FontWeight.w700,
        fontSize: AppTypography.displayLarge,
        color: foreground,
      ),
      displayMedium: TextStyle(
        fontFamily: _fontDisplay,
        fontWeight: FontWeight.w700,
        fontSize: AppTypography.displayMedium,
        color: foreground,
      ),
      displaySmall: TextStyle(
        fontFamily: _fontDisplay,
        fontWeight: FontWeight.w700,
        fontSize: AppTypography.displaySmall,
        color: foreground,
      ),

      // Headline styles — Instrument Sans
      headlineLarge: TextStyle(
        fontFamily: _fontHeading,
        fontWeight: FontWeight.w600,
        fontSize: AppTypography.headlineLarge,
        color: foreground,
      ),
      headlineMedium: TextStyle(
        fontFamily: _fontHeading,
        fontWeight: FontWeight.w600,
        fontSize: AppTypography.headlineMedium,
        color: foreground,
      ),
      headlineSmall: TextStyle(
        fontFamily: _fontHeading,
        fontWeight: FontWeight.w600,
        fontSize: AppTypography.headlineSmall,
        color: foreground,
      ),

      // Title styles — Instrument Sans
      titleLarge: TextStyle(
        fontFamily: _fontHeading,
        fontWeight: FontWeight.w600,
        fontSize: AppTypography.titleLarge,
        color: foreground,
      ),
      titleMedium: TextStyle(
        fontFamily: _fontHeading,
        fontWeight: FontWeight.w500,
        fontSize: AppTypography.titleMedium,
        color: foreground,
      ),
      titleSmall: TextStyle(
        fontFamily: _fontHeading,
        fontWeight: FontWeight.w500,
        fontSize: AppTypography.titleSmall,
        color: foreground,
      ),

      // Body styles — Inter
      bodyLarge: TextStyle(
        fontFamily: _fontBody,
        fontWeight: FontWeight.w400,
        fontSize: AppTypography.bodyLarge,
        color: foreground,
      ),
      bodyMedium: TextStyle(
        fontFamily: _fontBody,
        fontWeight: FontWeight.w400,
        fontSize: AppTypography.bodyMedium,
        color: foreground,
      ),
      bodySmall: TextStyle(
        fontFamily: _fontBody,
        fontWeight: FontWeight.w400,
        fontSize: AppTypography.bodySmall,
        color: muted,
      ),

      // Label styles — Inter
      labelLarge: TextStyle(
        fontFamily: _fontBody,
        fontWeight: FontWeight.w500,
        fontSize: AppTypography.labelLarge,
        color: foreground,
      ),
      labelMedium: TextStyle(
        fontFamily: _fontBody,
        fontWeight: FontWeight.w500,
        fontSize: AppTypography.labelMedium,
        color: foreground,
      ),
      labelSmall: TextStyle(
        fontFamily: _fontBody,
        fontWeight: FontWeight.w500,
        fontSize: AppTypography.labelSmall,
        color: muted,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Light theme
  // ---------------------------------------------------------------------------

  static final light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: AppColors.primaryForeground,
      secondary: AppColors.lightSecondary,
      onSecondary: AppColors.lightSecondaryForeground,
      surface: AppColors.lightCard,
      onSurface: AppColors.lightCardForeground,
      error: AppColors.lightDestructive,
      onError: AppColors.primaryForeground,
      outline: AppColors.lightBorder,
    ),
    scaffoldBackgroundColor: AppColors.lightBackground,
    textTheme: _buildTextTheme(
      AppColors.lightForeground,
      AppColors.lightMutedForeground,
    ),
    cardTheme: CardThemeData(
      color: AppColors.lightCard,
      elevation: AppElevation.none,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        side: const BorderSide(color: AppColors.lightBorder),
      ),
      shadowColor: Colors.black.withValues(alpha: 0.06),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.lightCard,
      foregroundColor: AppColors.lightForeground,
      elevation: AppElevation.none,
      scrolledUnderElevation: AppElevation.raised,
      surfaceTintColor: Colors.transparent,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.lightCard,
      indicatorColor: AppColors.primary.withValues(
        alpha: AppElevation.focusOpacity,
      ),
      labelTextStyle: const WidgetStatePropertyAll(
        TextStyle(
          fontFamily: _fontBody,
          fontSize: AppTypography.labelMedium,
          fontWeight: FontWeight.w500,
          color: AppColors.lightForeground,
        ),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: AppColors.lightCard,
      indicatorColor: AppColors.primary.withValues(
        alpha: AppElevation.focusOpacity,
      ),
      selectedLabelTextStyle: const TextStyle(
        fontFamily: _fontBody,
        fontSize: AppTypography.labelMedium,
        fontWeight: FontWeight.w600,
        color: AppColors.primary,
      ),
      unselectedLabelTextStyle: const TextStyle(
        fontFamily: _fontBody,
        fontSize: AppTypography.labelMedium,
        fontWeight: FontWeight.w500,
        color: AppColors.lightMutedForeground,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.lightBorder,
      thickness: AppElevation.raised,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.lightMuted,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.lightBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.lightBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        elevation: AppElevation.none,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        textStyle: const TextStyle(
          fontFamily: _fontBody,
          fontWeight: FontWeight.w600,
          fontSize: AppTypography.labelLarge,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.lightForeground,
        side: const BorderSide(color: AppColors.lightBorder),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        textStyle: const TextStyle(
          fontFamily: _fontBody,
          fontWeight: FontWeight.w600,
          fontSize: AppTypography.labelLarge,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.lightSecondary,
      labelStyle: const TextStyle(
        fontFamily: _fontBody,
        fontSize: AppTypography.labelMedium,
        fontWeight: FontWeight.w500,
        color: AppColors.lightSecondaryForeground,
      ),
      side: const BorderSide(color: AppColors.lightBorder),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.lightForeground,
      contentTextStyle: const TextStyle(
        fontFamily: _fontBody,
        color: AppColors.lightCard,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      behavior: SnackBarBehavior.floating,
    ),
  );

  // ---------------------------------------------------------------------------
  // Dark theme
  // ---------------------------------------------------------------------------

  static final dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.primary,
      onPrimary: AppColors.primaryForeground,
      secondary: AppColors.darkSecondary,
      onSecondary: AppColors.darkSecondaryForeground,
      surface: AppColors.darkCard,
      onSurface: AppColors.darkCardForeground,
      error: AppColors.darkDestructive,
      onError: AppColors.primaryForeground,
      outline: AppColors.darkBorder,
    ),
    scaffoldBackgroundColor: AppColors.darkBackground,
    textTheme: _buildTextTheme(
      AppColors.darkForeground,
      AppColors.darkMutedForeground,
    ),
    cardTheme: CardThemeData(
      color: AppColors.darkCard,
      elevation: AppElevation.none,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        side: const BorderSide(color: AppColors.darkBorder),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.darkCard,
      foregroundColor: AppColors.darkForeground,
      elevation: AppElevation.none,
      scrolledUnderElevation: AppElevation.raised,
      surfaceTintColor: Colors.transparent,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.darkCard,
      indicatorColor: AppColors.primary.withValues(
        alpha: AppElevation.focusOpacity,
      ),
      labelTextStyle: const WidgetStatePropertyAll(
        TextStyle(
          fontFamily: _fontBody,
          fontSize: AppTypography.labelMedium,
          fontWeight: FontWeight.w500,
          color: AppColors.darkForeground,
        ),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: AppColors.darkCard,
      indicatorColor: AppColors.primary.withValues(
        alpha: AppElevation.focusOpacity,
      ),
      selectedLabelTextStyle: const TextStyle(
        fontFamily: _fontBody,
        fontSize: AppTypography.labelMedium,
        fontWeight: FontWeight.w600,
        color: AppColors.primary,
      ),
      unselectedLabelTextStyle: const TextStyle(
        fontFamily: _fontBody,
        fontSize: AppTypography.labelMedium,
        fontWeight: FontWeight.w500,
        color: AppColors.darkMutedForeground,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.darkBorder,
      thickness: AppElevation.raised,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.darkMuted,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.darkBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.darkBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        elevation: AppElevation.none,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        textStyle: const TextStyle(
          fontFamily: _fontBody,
          fontWeight: FontWeight.w600,
          fontSize: AppTypography.labelLarge,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.darkForeground,
        side: const BorderSide(color: AppColors.darkBorder),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        textStyle: const TextStyle(
          fontFamily: _fontBody,
          fontWeight: FontWeight.w600,
          fontSize: AppTypography.labelLarge,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.darkSecondary,
      labelStyle: const TextStyle(
        fontFamily: _fontBody,
        fontSize: AppTypography.labelMedium,
        fontWeight: FontWeight.w500,
        color: AppColors.darkSecondaryForeground,
      ),
      side: const BorderSide(color: AppColors.darkBorder),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.darkForeground,
      contentTextStyle: const TextStyle(
        fontFamily: _fontBody,
        color: AppColors.darkCard,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
