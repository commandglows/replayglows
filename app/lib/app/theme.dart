import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:replayglowz_app/models/settings.dart';
import 'package:replayglowz_app/providers/providers.dart';

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

/// Design tokens for the ReplayGlowz app.
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
}

/// Central theme configuration for ReplayGlowz.
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
