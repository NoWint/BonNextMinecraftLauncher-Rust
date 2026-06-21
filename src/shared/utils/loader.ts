import type { IconName } from '../../shells/zzz/components/ui/Icon';

/**
 * Unified loader type helpers shared across shells.
 */

/** Returns the icon name for a given loader type. */
export function getLoaderIcon(loaderType: string | null): IconName {
  switch (loaderType) {
    case 'fabric':
      return 'fabric';
    case 'forge':
      return 'forge';
    case 'quilt':
      return 'quilt';
    case 'neoforge':
      return 'neoforge';
    default:
      return 'vanilla';
  }
}

/** Returns the human-readable label for a given loader type. */
export function getLoaderLabel(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return 'Fabric';
    case 'forge':
      return 'Forge';
    case 'quilt':
      return 'Quilt';
    case 'neoforge':
      return 'NeoForge';
    default:
      return 'Vanilla';
  }
}

/** Returns the CSS class identifier for a given loader type. */
export function getLoaderClass(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return 'fabric';
    case 'forge':
      return 'forge';
    case 'quilt':
      return 'quilt';
    case 'neoforge':
      return 'neoforge';
    default:
      return 'vanilla';
  }
}

/** Returns an emoji representation for a given loader type. */
export function getLoaderEmoji(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return '\u{1F9F5}';
    case 'forge':
      return '\u{2692}';
    case 'quilt':
      return '\u{1F9F5}';
    case 'neoforge':
      return '\u{2699}';
    default:
      return '\u{1F4E6}';
  }
}
