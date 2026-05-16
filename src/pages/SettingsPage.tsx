import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./SettingsPage.css";

interface UserConfig {
  java_path: string;
  max_memory_mb: number;
  extra_jvm_args: string[];
  window_width: number;
  window_height: number;
  launch_behavior: string;
  game_dir: string | null;
}

interface Props {
  onBack: () => void;
  onSave: (config: UserConfig) => void;
}

function SettingsPage({ onBack, onSave }: Props) {
  const [config, setConfig] = useState<UserConfig>({
    java_path: "java",
    max_memory_mb: 4096,
    extra_jvm_args: [],
    window_width: 854,
    window_height: 480,
    launch_behavior: "Keep",
    game_dir: null,
  });
  const [saved, setSaved] = useState(false);
  const [defaultDir, setDefaultDir] = useState("");

  useEffect(() => {
    invoke<UserConfig>("get_config")
      .then((cfg) => setConfig(cfg))
      .catch(console.error);
    invoke<string>("get_default_game_dir")
      .then(setDefaultDir)
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await invoke("save_config", { config });
      onSave(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  const handleAutoDetect = async () => {
    try {
      const path = await invoke<string>("auto_detect_java");
      setConfig({ ...config, java_path: path });
    } catch {
      // Java not found, ignore
    }
  };

  const handleSelectDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择游戏目录",
    });
    if (selected) {
      setConfig({ ...config, game_dir: selected });
    }
  };

  const handleResetDir = () => {
    setConfig({ ...config, game_dir: null });
  };

  const displayDir = config.game_dir || defaultDir || "默认路径";

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h2 className="settings-title">设置</h2>
      </header>

      <div className="settings-form">
        <div className="setting-group">
          <label>游戏目录</label>
          <div className="dir-display">
            <span className="dir-path" title={displayDir}>
              {displayDir}
            </span>
            {config.game_dir && (
              <span className="dir-custom-badge">自定义</span>
            )}
          </div>
          <div className="dir-input-row">
            <button className="detect-btn" onClick={handleSelectDir}>
              选择目录
            </button>
            {config.game_dir && (
              <button className="detect-btn reset-dir-btn" onClick={handleResetDir}>
                恢复默认
              </button>
            )}
          </div>
          <p className="dir-hint">
            游戏文件（versions、libraries、assets）将存储在此目录
          </p>
        </div>

        <div className="setting-group">
          <label>Java 路径</label>
          <div className="java-input-row">
            <input
              type="text"
              value={config.java_path}
              onChange={(e) =>
                setConfig({ ...config, java_path: e.target.value })
              }
              placeholder="java 或完整路径"
            />
            <button className="detect-btn" onClick={handleAutoDetect}>
              自动检测
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label>最大内存: {config.max_memory_mb} MB</label>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={config.max_memory_mb}
            onChange={(e) =>
              setConfig({ ...config, max_memory_mb: Number(e.target.value) })
            }
          />
          <div className="range-labels">
            <span>1 GB</span>
            <span>16 GB</span>
          </div>
        </div>

        <div className="setting-group">
          <label>窗口分辨率</label>
          <div className="resolution-inputs">
            <input
              type="number"
              value={config.window_width}
              onChange={(e) =>
                setConfig({ ...config, window_width: Number(e.target.value) })
              }
            />
            <span>×</span>
            <input
              type="number"
              value={config.window_height}
              onChange={(e) =>
                setConfig({ ...config, window_height: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="setting-group">
          <label>启动后行为</label>
          <select
            value={config.launch_behavior}
            onChange={(e) =>
              setConfig({ ...config, launch_behavior: e.target.value })
            }
          >
            <option value="Keep">保持启动器</option>
            <option value="Close">关闭启动器</option>
            <option value="Minimize">最小化到托盘</option>
          </select>
        </div>

        <div className="setting-group">
          <label>JVM 额外参数</label>
          <textarea
            value={config.extra_jvm_args.join("\n")}
            onChange={(e) =>
              setConfig({
                ...config,
                extra_jvm_args: e.target.value
                  .split("\n")
                  .filter((s) => s.trim()),
              })
            }
            placeholder="每行一个参数"
            rows={4}
          />
        </div>

        <button className="save-btn" onClick={handleSave}>
          {saved ? "已保存 ✓" : "保存设置"}
        </button>
      </div>
    </div>
  );
}

export default SettingsPage;
