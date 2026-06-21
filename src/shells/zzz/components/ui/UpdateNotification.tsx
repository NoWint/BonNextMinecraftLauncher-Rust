import { useState, useEffect } from 'react';
import { api } from '../../../../shared/api';
import type { AppUpdateInfo } from '../../../../shared/api';
import UpdateBanner, { getSkippedVersion } from './UpdateBanner';

/**
 * 应用启动后自动检查更新。
 * 检查到更新时渲染 UpdateBanner（支持跳过版本、changelog 展示、应用内安装）。
 * 跳过的版本不再弹出横幅。
 */
export function UpdateNotification() {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .checkForUpdates()
        .then((info) => {
          if (info && getSkippedVersion() === info.version) {
            // 用户已跳过此版本，不弹出横幅
            return;
          }
          setUpdate(info);
        })
        .catch((e) => {
          // 更新检查失败不应打扰用户，仅记录日志
          console.warn('[UpdateNotification] check for updates failed:', e);
        });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!update || dismissed) return null;

  return <UpdateBanner updateInfo={update} onDismiss={() => setDismissed(true)} />;
}
