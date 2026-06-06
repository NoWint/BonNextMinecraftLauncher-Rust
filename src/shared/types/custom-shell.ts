export interface CustomShellMeta {
  id: string;
  name: string;
  description?: string;
  author?: string;
  icon?: string;
  supported_routes: string[];
  supported_themes: string[];
  entry_path: string;
  css_path?: string;
}
