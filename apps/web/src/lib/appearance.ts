export type AppearancePresetId = 'enervita' | 'executive' | 'focus' | 'night';
export type CrmDensity = 'comfortable' | 'compact' | 'spacious';
export type NavigationStyle = 'expanded' | 'compact' | 'icons';
export type CornerStyle = 'soft' | 'rounded' | 'sharp';
export type FontScale = 'normal' | 'large' | 'extra';
export type CardStyle = 'flat' | 'soft' | 'glass';
export type ContentWidth = 'fluid' | 'focused';

export type AppearanceSettings = {
  preset: AppearancePresetId;
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  graphiteColor: string;
  backgroundColor: string;
  density: CrmDensity;
  navigation: NavigationStyle;
  corners: CornerStyle;
  showHints: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  compactTables: boolean;
  highlightOverdue: boolean;
  executiveMode: boolean;
  fontScale: FontScale;
  cardStyle: CardStyle;
  contentWidth: ContentWidth;
};

export const APPEARANCE_STORAGE_KEY = 'enervita.crm.appearance.v1';

export const appearancePresets: Record<AppearancePresetId, Omit<AppearanceSettings, 'companyName'>> = {
  enervita: {
    preset: 'enervita',
    primaryColor: '#F58220',
    secondaryColor: '#2EAD5B',
    graphiteColor: '#17211B',
    backgroundColor: '#FAF7F0',
    density: 'comfortable',
    navigation: 'expanded',
    corners: 'soft',
    showHints: true,
    highContrast: false,
    reduceMotion: false,
    compactTables: false,
    highlightOverdue: true,
    executiveMode: false,
    fontScale: 'normal',
    cardStyle: 'soft',
    contentWidth: 'fluid',
  },
  executive: {
    preset: 'executive',
    primaryColor: '#C26A1B',
    secondaryColor: '#1F7A4A',
    graphiteColor: '#111816',
    backgroundColor: '#F6F1E7',
    density: 'compact',
    navigation: 'compact',
    corners: 'rounded',
    showHints: false,
    highContrast: true,
    reduceMotion: true,
    compactTables: true,
    highlightOverdue: true,
    executiveMode: true,
    fontScale: 'normal',
    cardStyle: 'flat',
    contentWidth: 'focused',
  },
  focus: {
    preset: 'focus',
    primaryColor: '#E97818',
    secondaryColor: '#0F8B55',
    graphiteColor: '#102018',
    backgroundColor: '#FFFDF8',
    density: 'spacious',
    navigation: 'expanded',
    corners: 'soft',
    showHints: true,
    highContrast: false,
    reduceMotion: false,
    compactTables: false,
    highlightOverdue: true,
    executiveMode: false,
    fontScale: 'large',
    cardStyle: 'soft',
    contentWidth: 'fluid',
  },
  night: {
    preset: 'night',
    primaryColor: '#FF9B42',
    secondaryColor: '#44C878',
    graphiteColor: '#0B1110',
    backgroundColor: '#EEF2E8',
    density: 'comfortable',
    navigation: 'compact',
    corners: 'rounded',
    showHints: false,
    highContrast: true,
    reduceMotion: true,
    compactTables: true,
    highlightOverdue: true,
    executiveMode: true,
    fontScale: 'large',
    cardStyle: 'glass',
    contentWidth: 'focused',
  },
};

export const defaultAppearanceSettings: AppearanceSettings = {
  ...appearancePresets.enervita,
  companyName: 'Enervita Energia Solar',
};

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return defaultAppearanceSettings;

  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return defaultAppearanceSettings;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return { ...defaultAppearanceSettings, ...parsed };
  } catch {
    return defaultAppearanceSettings;
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
}

export function applyAppearanceSettings(settings: AppearanceSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--color-solar-orange', settings.primaryColor);
  root.style.setProperty('--color-energy-green', settings.secondaryColor);
  root.style.setProperty('--color-energy-deep', settings.secondaryColor);
  root.style.setProperty('--color-graphite', settings.graphiteColor);
  root.style.setProperty('--color-warm-white', settings.backgroundColor);
  root.dataset.crmDensity = settings.density;
  root.dataset.crmNavigation = settings.navigation;
  root.dataset.crmCorners = settings.corners;
  root.dataset.crmContrast = settings.highContrast ? 'high' : 'standard';
  root.dataset.crmMotion = settings.reduceMotion ? 'reduced' : 'standard';
  root.dataset.crmExecutive = settings.executiveMode ? 'true' : 'false';
  root.dataset.crmFontScale = settings.fontScale;
  root.dataset.crmCardStyle = settings.cardStyle;
  root.dataset.crmContentWidth = settings.contentWidth;
}
