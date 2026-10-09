import React from "react";

export type FolderIconName =
  | "default" | "documents" | "pictures" | "music" | "videos" | "downloads"
  | "desktop" | "favorites" | "archives" | "cloud" | "shared" | "locked"
  | "blue" | "green" | "red" | "orange" | "purple" | "pink" | "teal" | "indigo" | "grey"
  | "home" | "work" | "projects" | "personal" | "important" | "temp" | "sync" | "backup" | "network" | "offline";

export type FolderIconOverlay =
  | "shortcut" | "readonly" | "shared" | "syncing" | "synced"
  | "error" | "pending" | "pinned" | "compressed" | "encrypted";

const lightAssets = import.meta.glob("../assets/folder-icons/**/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function resolveAsset(name: string, theme: "light" | "dark" = "light") {
  const base = `../assets/folder-icons/${name}.svg`;
  const special = `../assets/folder-icons/special/${name}.svg`;
  const color = `../assets/folder-icons/colors/${name}.svg`;
  const dark = `../assets/folder-icons/dark/${name}.svg`;

  if (theme === "dark" && lightAssets[dark]) {
    return lightAssets[dark];
  }

  return (
    lightAssets[base] ??
    lightAssets[special] ??
    lightAssets[color] ??
    lightAssets["../assets/folder-icons/default.svg"]
  );
}

export interface FolderIconProps {
  name?: FolderIconName;
  size?: number;
  theme?: "light" | "dark";
  overlay?: FolderIconOverlay;
  label?: string;
  className?: string;
}

export function FolderIcon({
  name = "default",
  size = 24,
  theme = "light",
  overlay,
  label,
  className,
}: FolderIconProps) {
  const src = resolveAsset(name, theme);
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
      }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        width={size}
        height={size}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
      {overlay && (
        <span
          data-folder-overlay={overlay}
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            fontSize: Math.max(9, size * 0.32),
            lineHeight: 1,
            borderRadius: 99,
            background: "rgba(15, 23, 42, 0.9)",
            color: "#FFFFFF",
            padding: 1.5,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.2)",
          }}
        >
          {
            {
              shortcut: "↗",
              readonly: "🔒",
              shared: "👥",
              syncing: "⟳",
              synced: "✓",
              error: "!",
              pending: "◷",
              pinned: "📌",
              compressed: "⌁",
              encrypted: "◆",
            }[overlay]
          }
        </span>
      )}
    </span>
  );
}
