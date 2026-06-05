export interface DownloadProgressEvent {
  completed: number;
  total: number;
  bytes_downloaded: number;
  current_url: string;
  phase: string;
  finished: boolean;
  speed_bytes_per_sec: number;
  eta_seconds: number;
}

export interface ContentDownloadProgress {
  filename: string;
  slug: string;
  bytes_downloaded: number;
  total: number;
  speed_bytes_per_sec: number;
  eta_seconds: number;
  progress: number;
  finished: boolean;
}

export interface VersionEntry {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

export interface AppConfig {
  game_dir: string | null;
  java_path: string | null;
  max_memory: number;
  min_memory: number;
  window_width: number;
  window_height: number;
  fullscreen: boolean;
  download_source: string;
  max_concurrent_downloads: number;
  jvm_args: string | null;
  selected_instance: string | null;
  auth_type: string | null;
  keep_launcher_open: boolean;
  show_log_on_crash: boolean;
  auto_update_java: boolean;
  java_download_source: string;
  force_memory: boolean;
  force_java_path: boolean;
  git_proxy_enabled: boolean;
  git_proxy_url: string;
  security: SecurityConfig;
}

export interface SecurityConfig {
  credential_encryption: boolean;
  strict_verification: boolean;
  enforce_https: boolean;
  jvm_args_mode: string;
  sandbox_mode: string;
  proxy_enabled: boolean;
  proxy_url: string | null;
  proxy_username: string | null;
  proxy_password: string | null;
  audit_log_enabled: boolean;
  secure_launch_check: boolean;
}

export interface AuditEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  metadata: unknown | null;
}

export interface LoginHistoryEntry {
  timestamp: string;
  auth_type: string;
  success: boolean;
  username: string;
}

export interface KeyStatus {
  name: string;
  configured: boolean;
  source: string;
}

export interface SandboxAvailability {
  platform: string;
  available: boolean;
  tool: string | null;
  supported_modes: string[];
}

export interface FilePermissionResult {
  path: string;
  secure: boolean;
}

export interface FilePermissionFixResult {
  path: string;
  fixed: boolean;
}

export interface JreSourceInfo {
  id: string;
  label: string;
  available: boolean;
}

export interface JreRelease {
  major_version: number;
  os: string;
  arch: string;
  image_type: string;
  download_url: string;
  size_mb: number;
}

export interface JavaInfo {
  path: string;
  version: number | null;
  vendor: string | null;
}

export interface GameInstance {
  id: string;
  name: string;
  version_id: string;
  version_url: string;
  loader_type: string | null;
  loader_version: string | null;
  description: string;
  max_memory: number;
  min_memory: number;
  java_path: string | null;
  jvm_args: string | null;
  created_at: string;
  last_played: string | null;
  playtime_seconds: number;
}

export interface DetectedLauncher {
  launcher_type: string;
  name: string;
  game_dir: string;
  instance_count: number;
}

export interface MigrateableInstance {
  name: string;
  version_id: string;
  loader_type: string | null;
  loader_version: string | null;
  game_dir: string;
  launcher_type: string;
  has_mods: boolean;
  has_saves: boolean;
  size_mb: number;
  java_path: string | null;
  jvm_args: string | null;
  min_memory: number | null;
  max_memory: number | null;
}

export interface MigrationIssue {
  issue_type: string;
  severity: string;
  description: string;
  auto_fixable: boolean;
  instance_id: string | null;
  path: string | null;
}

export interface MigrationFixResult {
  total_issues: number;
  fixed: number;
  unfixed: number;
  details: string[];
}

export interface OfflineAuthResult {
  username: string;
  uuid: string;
  access_token: string;
}

export interface MicrosoftAuthResult {
  username: string;
  uuid: string;
  access_token: string;
  refresh_token: string;
}

export interface DeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

export interface YggdrasilProfile {
  id: string;
  name: string;
}

export interface YggdrasilAuthResult {
  username: string;
  uuid: string;
  access_token: string;
  client_token: string;
  server_url: string;
  available_profiles: YggdrasilProfile[];
  selected_profile: YggdrasilProfile | null;
}

export interface YggdrasilSkinProfile {
  id: string;
  name: string;
  properties: Array<{
    name: string;
    value: string;
    signature: string | null;
  }>;
}

export interface YggdrasilTexturesValue {
  timestamp: number;
  profile_id: string;
  profile_name: string;
  textures: {
    SKIN?: { url: string | null; metadata?: { model: string } };
    CAPE?: { url: string | null; metadata?: { model: string } };
  };
}

export interface StoredAccount {
  id: string;
  username: string;
  uuid: string;
  access_token: string;
  refresh_token: string | null;
  account_type: string;
  last_used: string;
  expires_at: string | null;
  avatar_url: string | null;
  yggdrasil_client_token: string | null;
  yggdrasil_server_url: string | null;
  yggdrasil_selected_profile: string | null;
  local_skin_path: string | null;
  local_skin_model: string | null;
}

export interface McSkinInfo {
  id: string;
  state: string;
  url: string;
  variant: string;
}

export interface McCapeInfo {
  id: string;
  state: string;
  url: string;
  alias: string;
}

export interface McSkinProfile {
  id: string;
  name: string;
  skins: McSkinInfo[];
  capes: McCapeInfo[];
}

export interface SkinValidationResult {
  valid: boolean;
  width: number | null;
  height: number | null;
  model: string;
  size_bytes: number;
}

export interface AuthlibCheckResult {
  exists: boolean;
  path: string;
  size: number;
  ready: boolean;
}

export interface LoaderInstallResult {
  version_id: string;
  main_class: string;
  extra_libraries: unknown[];
  extra_jvm_args: string[];
  extra_game_args: string[];
}

export interface ModResult {
  slug: string;
  title: string;
  description: string;
  author: string;
  categories: string[];
  downloads: number;
  follows: number;
  icon_url: string;
  client_side: string;
  server_side: string;
  latest_version: string | null;
  date_created: string;
  date_modified: string;
}

export interface ModVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ModFile[];
  dependencies: ModDependency[];
  date_published: string;
}

export interface ModFile {
  url: string;
  filename: string;
  size: number;
  hashes: { sha1: string | null; sha512: string | null };
}

export interface ModDependency {
  project_id: string | null;
  dependency_type: string;
  version_id: string | null;
}

export interface ModProjectFull {
  slug: string;
  title: string;
  description: string;
  body: string;
  author: string;
  categories: string[];
  downloads: number;
  follows: number;
  icon_url: string;
  client_side: string;
  server_side: string;
  project_type: string;
  gallery: { url: string; featured: boolean; title?: string; description?: string; created: string }[];
  issues_url: string | null;
  source_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  license: { id: string; name: string; url: string | null } | null;
  date_created: string;
  date_modified: string;
}

export interface InstalledModInfo {
  filename: string;
  size: number;
  installed_at: string;
  pinned: boolean;
  enabled: boolean;
  slug?: string;
  source?: string;
}

export interface WorldInfo {
  name: string;
  last_played: string | null;
  game_mode: string;
  game_mode_name: string | null;
  seed: number | null;
  difficulty: string;
  difficulty_name: string | null;
  size_mb: number;
  spawn_x: number | null;
  spawn_y: number | null;
  spawn_z: number | null;
  time_played_ticks: number | null;
  hardcore: boolean | null;
  version_name: string | null;
  level_name: string | null;
}

export interface LogFileInfo {
  filename: string;
  size: number;
  modified_at: string;
}

export interface ContentCounts {
  mods: number;
  resourcepacks: number;
  shaders: number;
  worlds: number;
}

export interface CollectionItem {
  slug: string;
  title: string;
  author: string;
  icon_url: string;
  content_type: string;
  description: string;
  downloads: number;
  categories: string[];
  added_at: string;
}

export interface UpdateInfo {
  filename: string;
  slug: string;
  installed_version: string | null;
  latest_version: string;
  content_type: string;
  pinned: boolean;
}

export type LaunchState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'validating'
  | 'launching'
  | 'running'
  | 'exited'
  | 'crashed'
  | 'error';

export interface RunningGameInfo {
  instance_id: string;
  state: LaunchState;
  pid: number;
  elapsed_secs: number;
}

export interface SystemInfo {
  total_ram_mb: number;
  used_ram_mb: number;
  cpu_name: string;
  cpu_count: number;
  java_version: string | null;
  os: string;
  arch: string;
}

export interface JreDownloadProgress {
  downloaded: number;
  total: number;
  version: number;
}

export interface CrashInfo {
  description: string;
  suggestion: string;
  severity: string;
  error_type: string;
}

export interface CrashFinding {
  finding: string;
  severity: string;
  category: string;
  detail: string;
}

export interface CrashDiagnosis {
  crash_info: CrashInfo;
  additional_findings: CrashFinding[];
  auto_fix_available: boolean;
  auto_fix_action: string | null;
}

export interface PresetMod {
  slug: string;
  name: string;
}

export interface OptimizationPreset {
  id: string;
  name: string;
  description: string;
  mods: PresetMod[];
  min_ram_mb: number;
  performance_level: string;
}

export interface PlaytimeStats {
  total_seconds: number;
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  top_instances: { id: string; name: string; seconds: number }[];
}

export interface ServerStatus {
  id: string;
  name: string;
  address: string;
  online: boolean;
  players_online: number;
  players_max: number;
  latency_ms: number;
  motd: string;
  version: string;
  favicon: string | null;
}

export interface FriendInfo {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'gaming' | 'away';
  current_game: string | null;
  avatar_url: string | null;
}

export interface HardwareProfile {
  cpu_name: string;
  cpu_count: number;
  total_ram_mb: number;
  gpu_name: string;
  performance_score: number;
  performance_level: string;
}

export interface MinecraftNewsEntry {
  title: string;
  category: string;
  date: string;
  text: string;
  read_more_link: string;
  id: string;
  image_url: string | null;
  tag: string | null;
  news_type: string[] | null;
}

export interface ArticleImage {
  url: string;
  caption: string | null;
}

export interface ArticleSection {
  heading: string | null;
  paragraphs: string[];
  images: ArticleImage[];
  list_items: string[];
}

export interface MinecraftArticle {
  title: string;
  subtitle: string | null;
  author: string | null;
  date: string | null;
  header_image: string | null;
  sections: ArticleSection[];
}

export interface TerracottaState {
  state: string;
  [key: string]: unknown;
}

export interface DiskUsage {
  total_bytes: number;
  instances_bytes: number;
  versions_bytes: number;
  libraries_bytes: number;
  assets_bytes: number;
  logs_bytes: number;
  other_bytes: number;
  breakdown: { name: string; bytes: number; path: string }[];
}

export interface RecentLogLine {
  line: string;
  level: string;
}

export interface PreLaunchCheckItem {
  name: string;
  status: string;
  message: string;
}

export interface PreLaunchReport {
  items: PreLaunchCheckItem[];
  can_launch: boolean;
}

export interface AppUpdateInfo {
  version: string;
  date: string;
  body: string | null;
  download_url: string | null;
}

export interface JreVersionInfo {
  major_version: number;
  path: string | null;
  installed: boolean;
  required_for: string[];
}

export interface RecommendedConfig {
  max_memory: number;
  min_memory: number;
  detected_java_path: string | null;
  detected_java_version: number | null;
  total_ram_mb: number;
}

export interface HealthCheckItem {
  name: string;
  status: string;
  message: string;
  suggestion: string | null;
}

export interface HealthCheckReport {
  instance_id: string;
  items: HealthCheckItem[];
  overall: string;
}

export interface RepairAction {
  action: string;
  description: string;
  success: boolean;
  message: string;
}

export interface RepairResult {
  instance_id: string;
  actions: RepairAction[];
  fixed: boolean;
}

export interface InstanceGroup {
  name: string;
  instance_ids: string[];
  collapsed: boolean;
}

export interface InstanceCheckResult {
  instance_id: string;
  is_ready: boolean;
  has_anomalies: boolean;
  anomaly_details: string[];
}

export interface AtomicInstallFile {
  url: string;
  filename: string;
  sha1: string | null;
  size: number;
  slug: string | null;
  version_id: string | null;
  content_type: string | null;
  source: string | null;
}

export interface AtomicInstallResult {
  session_id: string;
  installed_files: string[];
  rolled_back: boolean;
  error: string | null;
}

export interface ModpackPlan {
  plan_id: string;
  theme: string;
  game_version: string;
  loader: { loader_type: string; version: string };
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_config: { max_memory_mb: number; min_memory_mb: number; jvm_args: string };
  estimated_size_mb: number;
  warnings: Array<{ warning_type: string; message: string }>;
}

export interface ModpackPlanRequest {
  theme: string;
  game_version: string;
  loader_type: string;
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_args?: string;
  max_memory_mb?: number;
}

export interface WorkflowHandle {
  id: string;
  workflow_type: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'rolling_back';
  current_step: number;
  total_steps: number;
  step_name: string;
  snapshot_id: string | null;
  error_message: string | null;
  started_at: number;
}

export interface CompatibilityReport {
  conflicts: Array<{ mod_a: string; mod_b: string; reason: string; severity: string }>;
  missing_deps: Array<{ mod_slug: string; required_by: string }>;
  warnings: Array<{ mod_slug: string; issue: string }>;
  score: number;
}

export interface FixPlan {
  instance_id: string;
  crash_report_path: string;
  diagnosis: CrashDiagnosis;
  fix_actions: Array<{ action_type: string; description: string; target: string; value: string }>;
  knowledge_base_matches: Array<{
    signature: string;
    mod_context: string[];
    cause: string;
    fix: string;
    source: string;
    confidence: number;
    occurrences: number;
  }>;
}

export interface WorkflowProgressEvent {
  workflow_id: string;
  step: number;
  total_steps: number;
  step_name: string;
  detail?: string;
}

export interface WorkflowErrorEvent {
  workflow_id: string;
  step: string;
  error: string;
  recoverable: boolean;
}

export interface WorkflowCompleteEvent {
  workflow_id: string;
  result: string;
  instance_id?: string;
}

export interface CrashDetectedEvent {
  instance_id: string;
  crash_report_path: string;
  severity: 'fatal' | 'warning';
  timestamp: string;
}

export interface P2PStatus {
  connections: number;
  signaling_connected: boolean;
  local_port: number | null;
}

export interface PeerInfo {
  peer_id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
  latency_ms: number | null;
  display_name: string | null;
}

export interface MirrorStat {
  url: string;
  success_rate: number;
  avg_latency_ms: number;
}
