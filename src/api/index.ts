import { invoke } from '@tauri-apps/api/core';
import * as versions from './versions';
import * as auth from './auth';
import * as instances from './instances';
import * as modrinth from './modrinth';
import * as curseforge from './curseforge';
import * as collections from './collections';
import * as content from './content';
import * as security from './security';
import * as system from './system';
import { invalidateCache } from './cache';
import { socialApi } from './social';
import { chatApi } from './chat';

export type * from './types';
export { invalidateCache } from './cache';

const downloadVersion = (versionId: string, versionUrl: string) =>
  invoke<void>('download_version', { versionId, versionUrl });

export const api = {
  onDownloadProgress: versions.onDownloadProgress,
  onContentDownloadProgress: versions.onContentDownloadProgress,
  onJreDownloadProgress: versions.onJreDownloadProgress,
  checkJreAvailable: versions.checkJreAvailable,
  getJreSources: versions.getJreSources,
  fetchAvailableJreVersions: versions.fetchAvailableJreVersions,
  downloadJavaVersion: versions.downloadJavaVersion,
  listDownloadedJres: versions.listDownloadedJres,
  getVersions: versions.getVersions,
  getLaunchState: versions.getLaunchState,
  getInstanceLaunchState: versions.getInstanceLaunchState,
  getRunningGames: versions.getRunningGames,
  resetLaunchState: versions.resetLaunchState,
  resetInstanceLaunchState: versions.resetInstanceLaunchState,

  getConfig: instances.getConfig,
  saveConfig: instances.saveConfig,
  findJava: instances.findJava,
  findAllJava: instances.findAllJava,
  checkJavaVersion: instances.checkJavaVersion,
  offlineLogin: auth.offlineLogin,
  startMicrosoftAuth: auth.startMicrosoftAuth,
  pollMicrosoftAuth: auth.pollMicrosoftAuth,
  downloadVersion,
  pauseDownload: versions.pauseDownload,
  resumeDownload: versions.resumeDownload,
  cancelDownload: versions.cancelDownload,
  isDownloadPaused: versions.isDownloadPaused,
  launchGame: instances.launchGame,
  debugLaunch: instances.debugLaunch,
  getGameDir: instances.getGameDir,
  getDefaultGameDir: instances.getDefaultGameDir,
  listInstances: instances.listInstances,
  createInstance: instances.createInstance,
  deleteInstance: instances.deleteInstance,
  softDeleteInstance: instances.softDeleteInstance,
  restoreInstance: instances.restoreInstance,
  cleanupTrash: instances.cleanupTrash,
  updateInstance: instances.updateInstance,
  getInstance: instances.getInstance,
  openFolder: instances.openFolder,

  listAccounts: auth.listAccounts,
  getActiveAccount: auth.getActiveAccount,
  setActiveAccount: auth.setActiveAccount,
  removeAccount: auth.removeAccount,
  refreshAuthToken: auth.refreshAuthToken,

  getLoaderVersions: instances.getLoaderVersions,
  installLoader: instances.installLoader,

  searchMods: modrinth.searchMods,
  getPopularMods: modrinth.getPopularMods,
  getModDetails: modrinth.getModDetails,
  getModVersions: modrinth.getModVersions,
  getVersionById: modrinth.getVersionById,
  installMod: modrinth.installMod,
  installContent: modrinth.installContent,
  getOptimizationPresets: modrinth.getOptimizationPresets,
  applyOptimizationPreset: modrinth.applyOptimizationPreset,

  searchContent: modrinth.searchContent,
  getProjectDetails: modrinth.getProjectDetails,
  getTrendingContent: modrinth.getTrendingContent,
  getRecentlyUpdated: modrinth.getRecentlyUpdated,
  batchGetProjects: modrinth.batchGetProjects,

  listInstanceMods: content.listInstanceMods,
  listInstanceResourcepacks: content.listInstanceResourcepacks,
  listInstanceShaders: content.listInstanceShaders,
  listInstanceSaves: content.listInstanceSaves,
  listInstanceLogs: content.listInstanceLogs,
  readLogFile: content.readLogFile,
  getRecentLogs: content.getRecentLogs,
  removeInstalledMod: content.removeInstalledMod,
  getContentCounts: content.getContentCounts,
  checkContentUpdates: content.checkContentUpdates,
  bulkUpdateContent: content.bulkUpdateContent,
  pinMod: content.pinMod,
  unpinMod: content.unpinMod,
  isModPinned: content.isModPinned,
  atomicInstallContent: content.atomicInstallContent,

  addToCollection: collections.addToCollection,
  removeFromCollection: collections.removeFromCollection,
  isInCollection: collections.isInCollection,
  listCollection: collections.listCollection,

  searchCfMods: curseforge.searchCfMods,
  getCfMod: curseforge.getCfMod,
  getCfProjectDetails: curseforge.getCfProjectDetails,
  getCfModVersions: curseforge.getCfModVersions,
  getCfFeatured: curseforge.getCfFeatured,
  getCfModFiles: curseforge.getCfModFiles,
  downloadCfMod: curseforge.downloadCfMod,

  quickStart: system.quickStart,
  selectFastestMirror: system.selectFastestMirror,
  getSystemInfo: system.getSystemInfo,
  autoTuneMemory: system.autoTuneMemory,
  smartTuneMemory: instances.smartTuneMemory,
  preLaunchCheck: instances.preLaunchCheck,
  toggleMod: instances.toggleMod,
  getPlaytimeStats: system.getPlaytimeStats,
  recordPlaytime: instances.recordPlaytime,
  checkInstanceReady: instances.checkInstanceReady,
  healthCheck: instances.healthCheck,
  getInstanceCoverImage: instances.getInstanceCoverImage,
  getLastPlayedInstance: instances.getLastPlayedInstance,
  duplicateInstance: instances.duplicateInstance,
  exportInstance: instances.exportInstance,
  importModpack: instances.importModpack,
  importModpackAuto: instances.importModpackAuto,
  detectModpackFormat: instances.detectModpackFormat,
  exportMrpack: instances.exportMrpack,

  detectLaunchers: instances.detectLaunchers,
  scanLauncherInstances: instances.scanLauncherInstances,
  scanCustomDirectory: instances.scanCustomDirectory,
  migrateInstance: instances.migrateInstance,

  createSnapshot: instances.createSnapshot,
  listSnapshots: instances.listSnapshots,
  restoreSnapshot: instances.restoreSnapshot,
  deleteSnapshot: instances.deleteSnapshot,

  checkModConflicts: instances.checkModConflicts,

  pingServer: system.pingServer,

  exportInstanceConfig: instances.exportInstanceConfig,
  importInstanceConfig: instances.importInstanceConfig,

  getHardwareProfile: system.getHardwareProfile,
  getDiskUsage: system.getDiskUsage,

  listInstalledVersions: system.listInstalledVersions,
  deleteVersion: system.deleteVersion,
  getDirSize: system.getDirSize,

  getRecommendations: instances.getRecommendations,
  checkMigrationReadiness: instances.checkMigrationReadiness,

  warmupLaunch: instances.warmupLaunch,
  createGuestInstance: instances.createGuestInstance,

  listScreenshots: instances.listScreenshots,

  getAchievements: system.getAchievements,
  unlockAchievement: system.unlockAchievement,
  checkAchievements: system.checkAchievements,

  setInstanceIcon: instances.setInstanceIcon,

  getDownloadScheduleConfig: system.getDownloadScheduleConfig,
  setDownloadScheduleConfig: system.setDownloadScheduleConfig,

  getGcRecommendations: instances.getGcRecommendations,

  detectAnomalies: instances.detectAnomalies,

  readConfigFile: instances.readConfigFile,
  writeConfigFile: instances.writeConfigFile,

  getBatteryStatus: system.getBatteryStatus,

  cliLaunch: system.cliLaunch,
  getWebApiStatus: system.getWebApiStatus,

  listFriends: system.listFriends,
  addFriend: system.addFriend,
  removeFriend: system.removeFriend,

  startLanDiscovery: system.startLanDiscovery,
  stopLanDiscovery: system.stopLanDiscovery,
  getLanWorlds: system.getLanWorlds,

  scanP2PPeers: system.scanP2PPeers,
  sendFileP2P: system.sendFileP2P,

  startDiscordRpc: system.startDiscordRpc,
  stopDiscordRpc: system.stopDiscordRpc,
  updateDiscordPresence: system.updateDiscordPresence,

  getLaunchProfilingData: instances.getLaunchProfilingData,
  getFrameTimeData: instances.getFrameTimeData,

  nlpSearchContent: system.nlpSearchContent,

  getMinecraftNews: system.getMinecraftNews,
  getMinecraftArticle: system.getMinecraftArticle,
  openUrl: system.openUrl,

  downloadTerracotta: system.downloadTerracotta,
  isTerracottaInstalled: system.isTerracottaInstalled,
  startTerracotta: system.startTerracotta,
  stopTerracotta: system.stopTerracotta,
  getTerracottaState: system.getTerracottaState,
  terracottaSetHost: system.terracottaSetHost,
  terracottaSetGuest: system.terracottaSetGuest,
  terracottaSetIdle: system.terracottaSetIdle,

  getSecurityConfig: security.getSecurityConfig,
  saveSecurityConfig: security.saveSecurityConfig,
  getSecurityScore: security.getSecurityScore,
  getAuditLog: security.getAuditLog,
  getLoginHistory: security.getLoginHistory,
  migrateCredentials: security.migrateCredentials,
  getEncryptionStatus: security.getEncryptionStatus,
  saveApiKey: security.saveApiKey,
  deleteApiKey: security.deleteApiKey,
  getApiKeyStatus: security.getApiKeyStatus,
  checkFilePermissions: security.checkFilePermissions,
  fixFilePermissions: security.fixFilePermissions,
  validateJvmArgs: security.validateJvmArgs,
  getSandboxAvailability: security.getSandboxAvailability,

  yggdrasilLogin: auth.yggdrasilLogin,
  yggdrasilRefreshToken: auth.yggdrasilRefreshToken,
  yggdrasilGetProfile: auth.yggdrasilGetProfile,
  yggdrasilUploadSkin: auth.yggdrasilUploadSkin,
  yggdrasilResetSkin: auth.yggdrasilResetSkin,
  yggdrasilSelectProfile: auth.yggdrasilSelectProfile,
  getYggdrasilPresets: auth.getYggdrasilPresets,
  ensureAuthlibInjector: auth.ensureAuthlibInjector,
  setLocalSkin: auth.setLocalSkin,
  readSkinFile: auth.readSkinFile,
  validateSkinFile: auth.validateSkinFile,
  microsoftGetSkinProfile: auth.microsoftGetSkinProfile,
  microsoftUploadSkin: auth.microsoftUploadSkin,
  microsoftDeleteSkin: auth.microsoftDeleteSkin,
  checkAuthlibInjector: auth.checkAuthlibInjector,

  checkForUpdates: system.checkForUpdates,
  installUpdate: system.installUpdate,

  autoSelectJre: system.autoSelectJre,
  downloadJreVersionCmd: system.downloadJreVersionCmd,
  listJreVersions: system.listJreVersions,
  getCachedImage: system.getCachedImage,
  getRecommendedConfig: system.getRecommendedConfig,

  invalidateCache,

  social: socialApi,
  chat: chatApi,
};
