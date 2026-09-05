/**
 * Settings Type Definitions for ReplayGlows Extension
 * 
 * Defines the structure for user preferences and provides
 * default values for all configurable options.
 */

/**
 * Represents all user-configurable settings for the extension.
 */
export interface Settings {
  /**
   * Notification preferences for bookmark actions.
   */
  notifications: {
    enabled: boolean;  // Show toast notifications for actions
    sound: boolean;    // Play sound on bookmark creation
  };
  
  /**
   * Automatic synchronization settings.
   * Reserved for future cloud sync functionality.
   */
  autoSync: {
    enabled: boolean;  // Enable automatic syncing
    interval: number;  // Sync interval in minutes
  };
  
  /**
   * Visual appearance options.
   */
  appearance: {
    theme: 'light' | 'dark' | 'system';  // Color theme preference
    iconStyle: 'minimal' | 'colorful';    // Bookmark icon style
  };
}

/**
 * Default settings applied when no user preferences are saved.
 * These values provide a sensible starting configuration.
 */
export const defaultSettings: Settings = {
  notifications: {
    enabled: true,   // Notifications on by default for feedback
    sound: false     // Sound off by default to avoid annoyance
  },
  autoSync: {
    enabled: false,  // Sync disabled until user configures it
    interval: 30     // 30-minute default interval
  },
  appearance: {
    theme: 'system',      // Follow system preference
    iconStyle: 'colorful' // Colorful icons for visibility
  }
} 