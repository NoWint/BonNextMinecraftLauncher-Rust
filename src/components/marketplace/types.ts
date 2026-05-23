export type ContentType = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'plugin';
export type DataSource = 'modrinth' | 'curseforge';
export type SubView = 'discover' | 'results';
export type ViewMode = 'grid' | 'list';

export interface MarketplaceState {
  activeTab: ContentType;
  subView: SubView;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  page: number;
  viewMode: ViewMode;
}

export type MarketplaceAction =
  | { type: 'SET_TAB'; payload: ContentType }
  | { type: 'SET_SUB_VIEW'; payload: SubView }
  | { type: 'SET_SOURCE'; payload: DataSource }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'TOGGLE_TAG'; payload: string }
  | { type: 'CLEAR_TAGS' }
  | { type: 'SET_VERSION'; payload: string }
  | { type: 'SET_LOADER'; payload: string }
  | { type: 'SET_SORT'; payload: string }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SEARCH_TRIGGERED' };

export const CONTENT_TYPE_TABS: { id: ContentType; label: string; icon: string }[] = [
  { id: 'mod', label: 'MODS', icon: '🧵' },
  { id: 'modpack', label: 'MODPACKS', icon: '📦' },
  { id: 'resourcepack', label: 'RESOURCE PACKS', icon: '🎨' },
  { id: 'shader', label: 'SHADERS', icon: '✨' },
  { id: 'datapack', label: 'DATA PACKS', icon: '💿' },
  { id: 'plugin', label: 'PLUGINS', icon: '⚙' },
];

export const GAME_VERSIONS = [
  '', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19', '1.18.2', '1.16.5',
];

export const LOADER_OPTIONS = [
  { value: '', label: 'All loaders' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'forge', label: 'Forge' },
  { value: 'neoforge', label: 'NeoForge' },
  { value: 'quilt', label: 'Quilt' },
];

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Most downloads' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' },
];

export const TAGS_BY_TYPE: Record<ContentType, string[]> = {
  mod: ['optimization', 'tech', 'magic', 'decoration', 'worldgen', 'adventure', 'utility', 'storage'],
  modpack: ['popular', 'kitchen-sink', 'tech', 'magic', 'adventure', 'quests', 'lite', 'vanilla-plus'],
  resourcepack: ['realistic', 'cartoon', 'medieval', 'modern', 'vanilla-like', 'animated', '16x', '32x'],
  shader: ['realistic', 'cartoon', 'fantasy', 'vanilla-plus', 'cinematic', 'performance', 'potato'],
  datapack: ['vanilla-plus', 'game-mechanics', 'worldgen', 'mob', 'recipe', 'quest', 'utility'],
  plugin: ['admin', 'economy', 'chat', 'protection', 'world-management', 'gameplay', 'utility', 'api'],
};

export const PAGE_SIZE = 24;

export const INITIAL_STATE: MarketplaceState = {
  activeTab: 'mod',
  subView: 'results',
  source: 'modrinth',
  searchQuery: '',
  selectedTags: [],
  gameVersion: '',
  loader: '',
  sortBy: 'relevance',
  page: 1,
  viewMode: 'grid',
};

export function marketplaceReducer(state: MarketplaceState, action: MarketplaceAction): MarketplaceState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload, page: 1, searchQuery: '', selectedTags: [], subView: 'results' };
    case 'SET_SUB_VIEW':
      return { ...state, subView: action.payload };
    case 'SET_SOURCE':
      return { ...state, source: action.payload, page: 1 };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'TOGGLE_TAG': {
      const tags = state.selectedTags.includes(action.payload)
        ? state.selectedTags.filter((t) => t !== action.payload)
        : [...state.selectedTags, action.payload];
      return { ...state, selectedTags: tags, page: 1, subView: tags.length > 0 ? 'results' : state.subView };
    }
    case 'CLEAR_TAGS':
      return { ...state, selectedTags: [], page: 1 };
    case 'SET_VERSION':
      return { ...state, gameVersion: action.payload, page: 1, subView: action.payload ? 'results' : state.subView };
    case 'SET_LOADER':
      return { ...state, loader: action.payload, page: 1, subView: action.payload ? 'results' : state.subView };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'CLEAR_FILTERS':
      return { ...INITIAL_STATE, activeTab: state.activeTab, source: state.source, viewMode: state.viewMode };
    case 'SEARCH_TRIGGERED':
      return { ...state, page: 1, selectedTags: [], subView: 'results' };
    default:
      return state;
  }
}
