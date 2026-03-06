#!/usr/bin/env bash
# HexDesk VM 镜像构建脚本
# 在 Ubuntu 环境中以 root 运行（GitHub Actions runner 或本地 sudo）
# 产出: ubuntu.img (qcow2), vmlinuz, initrd, ubuntu.img.sha256
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${BUILD_DIR:-/tmp/hexdesk-vm-build}"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR/vm-output}"
ROOTFS_DIR="$BUILD_DIR/rootfs"
IMAGE_SIZE="2G"
SUITE="noble"  # Ubuntu 24.04
MIRROR="http://archive.ubuntu.com/ubuntu"

echo "=== HexDesk VM Image Builder ==="
echo "Build dir: $BUILD_DIR"
echo "Output dir: $OUTPUT_DIR"

# 检查 root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root"
    exit 1
fi

# 清理函数
cleanup() {
    echo "=== Cleanup ==="
    umount "$ROOTFS_DIR/proc" 2>/dev/null || true
    umount "$ROOTFS_DIR/sys" 2>/dev/null || true
    umount "$ROOTFS_DIR/dev/pts" 2>/dev/null || true
    umount "$ROOTFS_DIR/dev" 2>/dev/null || true
    rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

# 安装构建依赖
echo "=== Installing build dependencies ==="
apt-get update -qq
apt-get install -y -qq debootstrap qemu-utils e2fsprogs

# 准备目录
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$OUTPUT_DIR" "$ROOTFS_DIR"

# Step 1: debootstrap
echo "=== Step 1: debootstrap (Ubuntu $SUITE) ==="
debootstrap --variant=minbase --include=systemd,systemd-sysv,dbus,sudo,locales \
    "$SUITE" "$ROOTFS_DIR" "$MIRROR"

# Step 2: 挂载伪文件系统
echo "=== Step 2: Mount pseudo filesystems ==="
mount --bind /dev "$ROOTFS_DIR/dev"
mount --bind /dev/pts "$ROOTFS_DIR/dev/pts"
mount -t proc proc "$ROOTFS_DIR/proc"
mount -t sysfs sys "$ROOTFS_DIR/sys"

# Step 3: chroot 内安装软件
echo "=== Step 3: Install packages in chroot ==="
cat > "$ROOTFS_DIR/tmp/setup.sh" << 'CHROOT_SCRIPT'
#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C

# 配置 apt 源（含 universe）
cat > /etc/apt/sources.list.d/ubuntu.sources << 'APT_EOF'
Types: deb
URIs: http://archive.ubuntu.com/ubuntu
Suites: noble noble-updates noble-security
Components: main universe
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
APT_EOF

apt-get update -qq

# 基础工具
apt-get install -y -qq --no-install-recommends \
    python3 python3-pip python3-venv \
    curl wget git jq unzip tree htop \
    nfs-common \
    iproute2 iputils-ping net-tools \
    ca-certificates gnupg \
    systemd-resolved \
    linux-image-virtual

# Node.js 20 LTS (via NodeSource)
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
    gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > \
    /etc/apt/sources.list.d/nodesource.list
apt-get update -qq
apt-get install -y -qq nodejs

# Python 常用包
pip3 install --break-system-packages --no-cache-dir \
    numpy pandas requests pillow matplotlib

# 配置 locale
echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
locale-gen

# 配置网络（QEMU NAT 模式下的 DHCP）
cat > /etc/systemd/network/80-dhcp.network << 'NET_EOF'
[Match]
Name=en*

[Network]
DHCP=yes
NET_EOF
systemctl enable systemd-networkd
systemctl enable systemd-resolved

# 配置 hostname
echo "hexdesk-vm" > /etc/hostname

# 创建 workspace 目录
mkdir -p /workspace

# 配置 root 密码（调试用，生产环境可删除）
echo "root:hexdesk" | chpasswd

# 配置串口 console（让 -serial stdio 能看到启动日志）
systemctl enable serial-getty@ttyS0.service

# 清理
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
rm -rf /var/cache/apt/archives/*
CHROOT_SCRIPT

chmod +x "$ROOTFS_DIR/tmp/setup.sh"
chroot "$ROOTFS_DIR" /tmp/setup.sh

# Step 4: 安装 hexdesk-agent
echo "=== Step 4: Install hexdesk-agent ==="
cp "$PROJECT_DIR/vm/hexdesk-agent" "$ROOTFS_DIR/usr/local/bin/hexdesk-agent"
chmod +x "$ROOTFS_DIR/usr/local/bin/hexdesk-agent"

cp "$PROJECT_DIR/vm/hexdesk-agent.service" "$ROOTFS_DIR/etc/systemd/system/hexdesk-agent.service"
cp "$PROJECT_DIR/vm/hexdesk-nfs-mount.service" "$ROOTFS_DIR/etc/systemd/system/hexdesk-nfs-mount.service"

# 启用服务
chroot "$ROOTFS_DIR" systemctl enable hexdesk-agent.service
chroot "$ROOTFS_DIR" systemctl enable hexdesk-nfs-mount.service

# Step 5: 提取内核和 initrd
echo "=== Step 5: Extract kernel and initrd ==="
VMLINUZ=$(ls "$ROOTFS_DIR/boot/vmlinuz-"* | sort -V | tail -1)
INITRD=$(ls "$ROOTFS_DIR/boot/initrd.img-"* | sort -V | tail -1)
cp "$VMLINUZ" "$OUTPUT_DIR/vmlinuz"
cp "$INITRD" "$OUTPUT_DIR/initrd"
echo "Kernel: $(basename "$VMLINUZ")"
echo "Initrd: $(basename "$INITRD")"

# Step 6: 卸载伪文件系统
echo "=== Step 6: Unmount pseudo filesystems ==="
umount "$ROOTFS_DIR/proc" || true
umount "$ROOTFS_DIR/sys" || true
umount "$ROOTFS_DIR/dev/pts" || true
umount "$ROOTFS_DIR/dev" || true

# Step 7: 创建 raw 磁盘镜像
echo "=== Step 7: Create disk image ==="
RAW_IMG="$BUILD_DIR/ubuntu.raw"
truncate -s "$IMAGE_SIZE" "$RAW_IMG"

# 创建 ext4 文件系统
mkfs.ext4 -F -L hexdesk-root "$RAW_IMG"

# 挂载并复制 rootfs
MOUNT_DIR="$BUILD_DIR/mnt"
mkdir -p "$MOUNT_DIR"
mount -o loop "$RAW_IMG" "$MOUNT_DIR"
cp -a "$ROOTFS_DIR/." "$MOUNT_DIR/"
umount "$MOUNT_DIR"

# Step 8: 转为 qcow2
echo "=== Step 8: Convert to qcow2 ==="
qemu-img convert -f raw -O qcow2 -c "$RAW_IMG" "$OUTPUT_DIR/ubuntu.img"
rm "$RAW_IMG"

# Step 9: 生成校验文件
echo "=== Step 9: Generate checksums ==="
cd "$OUTPUT_DIR"
sha256sum ubuntu.img > ubuntu.img.sha256

# 输出结果
echo ""
echo "=== Build Complete ==="
ls -lh "$OUTPUT_DIR/"
echo ""
echo "Files:"
echo "  ubuntu.img     - VM disk image (qcow2)"
echo "  vmlinuz        - Linux kernel"
echo "  initrd         - Initial ramdisk"
echo "  ubuntu.img.sha256 - SHA256 checksum"
