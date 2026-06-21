import { useState } from 'react';
import { formatError } from '../../../../shared/utils/errorMapping';
import { api } from '../../../../shared/api';
import { useToast } from '../../../../shared/stores/toastStore';
import { useDownloads } from '../../../../shared/stores/downloadStore';
import type { DownloadTask } from '../../../../shared/stores/downloadStore';
import { Button } from './Button';

interface InstallButtonProps {
  contentSlug: string;
  contentTitle: string;
  instanceId: string;
  gameVersion?: string;
  loader?: string;
  contentType?: string;
  source?: 'modrinth' | 'curseforge';
  onInstalled?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

async function downloadSingle(
  slug: string,
  title: string,
  fileUrl: string,
  filename: string,
  instanceId: string,
  contentType: string,
  versionId: string,
  sha1: string | undefined,
  addTask: (t: DownloadTask) => void,
  updateTask: (
    id: string,
    status: DownloadTask['status'],
    err?: string,
    progress?: number,
    speed?: number,
    eta?: number,
  ) => void,
  source: string,
) {
  const taskId = `${slug}-${Date.now()}`;
  addTask({ id: taskId, title, filename, status: 'pending', startedAt: Date.now() });
  updateTask(taskId, 'downloading');

  const unlisten = await api.onContentDownloadProgress((p) => {
    // 兼容 Rust 端 slug 为 None 时发射空字符串的情况：
    // 任一方 slug 为空时退化为仅 filename 匹配，避免进度丢失
    const slugMatch = !p.slug || !slug || p.slug === slug;
    if (slugMatch && p.filename === filename) {
      updateTask(taskId, 'downloading', undefined, p.progress, p.speed_bytes_per_sec, p.eta_seconds);
    }
  });

  try {
    if (source === 'curseforge') {
      await api.downloadCfMod(fileUrl, filename, instanceId, contentType, sha1, slug, versionId);
    } else {
      await api.installContent(fileUrl, filename, instanceId, contentType, sha1, slug, versionId, source);
    }
    updateTask(taskId, 'complete');
  } catch (e) {
    updateTask(taskId, 'failed', e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    unlisten();
  }
}

export function InstallButton({
  contentSlug,
  contentTitle,
  instanceId,
  gameVersion,
  loader,
  contentType,
  source = 'modrinth',
  onInstalled,
  size = 'sm',
}: InstallButtonProps) {
  const [installing, setInstalling] = useState(false);
  const { addToast } = useToast();
  const { addTask, updateTask } = useDownloads();

  const handleInstall = async () => {
    if (!instanceId) {
      addToast({ type: 'warning', title: 'No instance', message: 'Select an instance first.' });
      return;
    }

    setInstalling(true);
    const ct = contentType || 'mod';

    try {
      const versions =
        source === 'curseforge'
          ? await api.getCfModVersions(parseInt(contentSlug, 10))
          : await api.getModVersions(contentSlug, gameVersion, loader || undefined);
      if (versions.length === 0) {
        addToast({
          type: 'error',
          title: 'No compatible version',
          message: `${contentTitle} has no version for your config.`,
        });
        setInstalling(false);
        return;
      }

      const latest = versions[0];
      const primaryFile =
        latest.files.find((f) => !f.filename.includes('sources') && !f.filename.includes('javadoc')) || latest.files[0];

      // Resolve required dependencies
      const requiredDeps = latest.dependencies.filter((d) => d.dependency_type === 'required');
      let depCount = 0;

      if (requiredDeps.length > 0) {
        // Fetch dep details in parallel
        const depDetails = await Promise.all(
          requiredDeps.map(async (dep) => {
            try {
              if (!dep.version_id || !dep.project_id) return null;
              const [version, project] = await Promise.all([
                api.getVersionById(dep.version_id),
                api.getModDetails(dep.project_id),
              ]);
              const file =
                version.files.find((f) => !f.filename.includes('sources') && !f.filename.includes('javadoc')) ||
                version.files[0];
              return { project, version, file };
            } catch {
              return null;
            }
          }),
        );

        // Install dependencies sequentially with queue tracking
        for (const dep of depDetails) {
          if (!dep) continue;
          try {
            await downloadSingle(
              dep.project.slug,
              dep.project.title,
              dep.file.url,
              dep.file.filename,
              instanceId,
              ct,
              dep.version.id,
              dep.file.hashes.sha1 || undefined,
              addTask,
              updateTask,
              source,
            );
            depCount++;
          } catch (e: unknown) {
            addToast({ type: 'error', title: 'Dep failed', message: `${dep.project.title}: ${formatError(e)}` });
          }
        }
      }

      // Install main item
      await downloadSingle(
        contentSlug,
        contentTitle,
        primaryFile.url,
        primaryFile.filename,
        instanceId,
        ct,
        latest.id,
        primaryFile.hashes.sha1 || undefined,
        addTask,
        updateTask,
        source,
      );

      const msg =
        depCount > 0
          ? `${contentTitle} ${latest.version_number} + ${depCount} dependencies`
          : `${contentTitle} ${latest.version_number}`;

      addToast({ type: 'success', title: 'Installed', message: msg });
      onInstalled?.();
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Install failed', message: formatError(e) || 'Unknown error' });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Button variant="secondary-highlight" size={size} disabled={installing} onClick={handleInstall}>
      {installing ? '...' : 'Install'}
    </Button>
  );
}
