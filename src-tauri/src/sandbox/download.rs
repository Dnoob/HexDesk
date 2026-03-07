use std::path::Path;

use reqwest::Client;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use super::{DownloadProgress, SandboxConfig};

/// 镜像下载管理器
pub struct ImageDownloader;

/// 下载项（镜像、内核等）
struct DownloadItem {
    filename: String,
    dest: String,
    phase: String,
}

/// 镜像源（按优先级排序）
const MIRROR_URLS: &[&str] = &[
    // CNB（国内高速）
    "https://cnb.cool/noobcool/HexDesk/-/releases/download/vm-latest",
    // GitHub（海外）
    "https://github.com/Dnoob/HexDesk/releases/download/vm-latest",
];

impl ImageDownloader {
    /// 检查镜像是否已安装（镜像 + 内核 + initrd 都存在）
    pub fn is_installed(config: &SandboxConfig) -> bool {
        Path::new(&config.image_path()).exists()
            && Path::new(&config.kernel_path()).exists()
            && Path::new(&config.initrd_path()).exists()
    }

    /// 下载所有必需文件，通过 Tauri event 报告进度
    pub async fn download(
        app: &AppHandle,
        config: &SandboxConfig,
    ) -> Result<(), String> {
        // 确保目录存在
        tokio::fs::create_dir_all(&config.vm_dir)
            .await
            .map_err(|e| format!("Failed to create vm dir: {}", e))?;

        let mut items = vec![
            DownloadItem {
                filename: "ubuntu.img".to_string(),
                dest: config.image_path(),
                phase: "downloading_image".to_string(),
            },
            DownloadItem {
                filename: "vmlinuz".to_string(),
                dest: config.kernel_path(),
                phase: "downloading_kernel".to_string(),
            },
            DownloadItem {
                filename: "initrd".to_string(),
                dest: config.initrd_path(),
                phase: "downloading_initrd".to_string(),
            },
            DownloadItem {
                filename: "ubuntu.img.sha256".to_string(),
                dest: config.checksum_path(),
                phase: "downloading_checksum".to_string(),
            },
        ];

        // Windows: 额外下载 QEMU 二进制和 WinNFSd
        if cfg!(target_os = "windows") {
            let qemu_dir = format!("{}/qemu", config.vm_dir);
            tokio::fs::create_dir_all(&qemu_dir)
                .await
                .map_err(|e| format!("Failed to create qemu dir: {}", e))?;

            items.push(DownloadItem {
                filename: "qemu-system-x86_64.exe".to_string(),
                dest: config.qemu_binary(),
                phase: "downloading_qemu".to_string(),
            });

            let winnfsd_dir = format!("{}/winnfsd", config.vm_dir);
            tokio::fs::create_dir_all(&winnfsd_dir)
                .await
                .map_err(|e| format!("Failed to create winnfsd dir: {}", e))?;

            items.push(DownloadItem {
                filename: "WinNFSd.exe".to_string(),
                dest: config.winnfsd_path(),
                phase: "downloading_winnfsd".to_string(),
            });
        }

        // 构建镜像源列表：用户自定义 > 内置镜像源
        let mirrors: Vec<String> = if config.download_url.is_empty() {
            MIRROR_URLS.iter().map(|s| s.to_string()).collect()
        } else {
            // 用户自定义源放最前，内置源作为 fallback
            let mut m = vec![config.download_url.clone()];
            m.extend(MIRROR_URLS.iter().map(|s| s.to_string()));
            m
        };

        let client = Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        for item in &items {
            // 如果文件已存在则跳过
            if Path::new(&item.dest).exists() {
                continue;
            }

            Self::download_with_fallback(
                app,
                &client,
                &mirrors,
                &item.filename,
                &item.dest,
                &item.phase,
            )
            .await?;
        }

        // 校验镜像
        let _ = app.emit("sandbox:download-progress", DownloadProgress {
            downloaded: 0,
            total: 0,
            speed: 0,
            phase: "verifying".to_string(),
        });

        Self::verify_image(config).await?;

        Ok(())
    }

    /// 尝试多个镜像源下载，第一个成功即返回
    async fn download_with_fallback(
        app: &AppHandle,
        client: &Client,
        mirrors: &[String],
        filename: &str,
        dest: &str,
        phase: &str,
    ) -> Result<(), String> {
        let mut last_error = String::new();

        for (i, base_url) in mirrors.iter().enumerate() {
            let url = format!("{}/{}", base_url, filename);
            let mirror_name = if url.contains("cnb.cool") {
                "CNB"
            } else if url.contains("github.com") {
                "GitHub"
            } else {
                "Custom"
            };

            eprintln!("Trying mirror {} ({}/{}): {}", mirror_name, i + 1, mirrors.len(), url);

            match Self::download_file(app, client, &url, dest, phase).await {
                Ok(()) => {
                    eprintln!("Download succeeded from {}: {}", mirror_name, filename);
                    return Ok(());
                }
                Err(e) => {
                    eprintln!("Mirror {} failed: {}", mirror_name, e);
                    last_error = format!("{} ({})", e, mirror_name);
                    // 清理失败的临时文件
                    let tmp = format!("{}.tmp", dest);
                    let _ = tokio::fs::remove_file(&tmp).await;
                    continue;
                }
            }
        }

        Err(format!(
            "All mirrors failed for {}: {}",
            filename, last_error
        ))
    }

    /// 下载单个文件，实时报告进度
    async fn download_file(
        app: &AppHandle,
        client: &Client,
        url: &str,
        dest: &str,
        phase: &str,
    ) -> Result<(), String> {
        use futures::StreamExt;

        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Download request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Download failed with status {}: {}",
                response.status(),
                url
            ));
        }

        let total = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut last_emit = std::time::Instant::now();
        let start_time = std::time::Instant::now();

        let tmp_dest = format!("{}.tmp", dest);
        let mut file = tokio::fs::File::create(&tmp_dest)
            .await
            .map_err(|e| format!("Failed to create file {}: {}", tmp_dest, e))?;

        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Write error: {}", e))?;

            downloaded += chunk.len() as u64;

            // 每 200ms 发一次进度
            if last_emit.elapsed().as_millis() >= 200 {
                let elapsed = start_time.elapsed().as_secs().max(1);
                let speed = downloaded / elapsed;

                let _ = app.emit(
                    "sandbox:download-progress",
                    DownloadProgress {
                        downloaded,
                        total,
                        speed,
                        phase: phase.to_string(),
                    },
                );
                last_emit = std::time::Instant::now();
            }
        }

        file.flush()
            .await
            .map_err(|e| format!("Flush error: {}", e))?;

        // 原子重命名
        tokio::fs::rename(&tmp_dest, dest)
            .await
            .map_err(|e| format!("Rename error: {}", e))?;

        Ok(())
    }

    /// 校验镜像 SHA256
    async fn verify_image(config: &SandboxConfig) -> Result<(), String> {
        let checksum_path = config.checksum_path();
        if !Path::new(&checksum_path).exists() {
            // 没有校验文件，跳过校验
            return Ok(());
        }

        let expected = tokio::fs::read_to_string(&checksum_path)
            .await
            .map_err(|e| format!("Read checksum file error: {}", e))?;
        let expected = expected.trim().split_whitespace().next().unwrap_or("").to_lowercase();

        if expected.is_empty() {
            return Ok(());
        }

        let image_data = tokio::fs::read(&config.image_path())
            .await
            .map_err(|e| format!("Read image error: {}", e))?;

        let mut hasher = Sha256::new();
        hasher.update(&image_data);
        let actual = format!("{:x}", hasher.finalize());

        if actual != expected {
            // 删除损坏的镜像
            let _ = tokio::fs::remove_file(&config.image_path()).await;
            return Err(format!(
                "Image checksum mismatch: expected {}, got {}",
                expected, actual
            ));
        }

        Ok(())
    }
}
