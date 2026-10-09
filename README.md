# Atlas — High-Performance Native File Manager & Developer Workspace

<div align="center">
  <h3>Next-Generation Desktop File Manager & Tool Launcher for Windows</h3>
  <p>Built with <b>Tauri 2</b>, <b>Rust</b>, <b>React 19</b>, and <b>TypeScript</b>.</p>
</div>

---

## 🚀 Overview

**Atlas** combines high-performance file management, Miller-column cascading navigation, fast Windows Explorer mechanics, dual split panes, and integrated developer tools. It bridges sister tools like **UltraViewer**, **FeedLens**, and **TransformLab** with direct 1-click launch support.

---

## ✨ Key Features

1. **Cascading Miller Columns & Classic Details View**
   - Miller-column cascading directory navigation dynamically loaded from the Rust backend.
   - High-density details list view with multi-sort (Name, Type, Size, Modified Date).
   - Fast folder size computation and item counting.

2. **Tabs & Split Panes**
   - Independent multi-tab browsing with isolated forward/back navigation history.
   - Side-by-side dual pane split (`Ctrl+\`) for direct side-by-side comparison and transfers.

3. **Built-in Viewers & Integrated Editors**
   - **Spreadsheet / CSV Viewer**: Built-in tabbed data grid for `.csv`, `.tsv`, `.xlsx`, `.xls` with search and pagination.
   - **PDF Viewer**: Native in-app PDF previewing.
   - **Large File Editor**: Chunked memory-mapped reader/editor for multi-gigabyte text, XML, JSON, and log files.
   - **Media & Code Previews**: Syntax-highlighted code viewer and image viewer with zoom/pan controls.

4. **Power Tools & Sister Apps Integration**
   - Right-click or 1-click preview launch directly into:
     - 👁️ **UltraViewer**: Specialized large XML/JSON file viewer and editor.
     - 📊 **FeedLens**: Streaming feed analyzer powered by embedded DuckDB.
     - ⚡ **TransformLab**: High-speed XSLT 3.0 / JOLT transformation lab.

5. **Drop Zone (Stash Area)**
   - Persistent staging area in the sidebar to collect files across different directories before executing bulk copy, move, or archive operations.

6. **Native Rust Engine & Win32 Integration**
   - Direct Win32 drive enumeration and disk utilization indicators.
   - Safe deletion using the Windows Recycle Bin (`trash` crate).
   - Streaming asynchronous I/O copy & move engine with cancellation support.
   - Fast fuzzy path and file indexing with instant search.

---

## 🛠️ Prerequisites & Installation

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v18.0+` (LTS recommended)
- **Rust**: `v1.78+` with `cargo` installed ([rustup.rs](https://rustup.rs/))
- **C++ Build Tools**: Visual Studio 2022 with the "Desktop development with C++" workload installed.
- **WebView2**: Built into Windows 10/11.

---

### Installation & Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/iqbal-danish/Atlas.git
   cd Atlas
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run tauri dev
   ```

---

### Building the Release Executable

To produce the optimized standalone Windows executable:

```bash
npm run tauri build -- --no-bundle
```

The compiled binary will be located at:
```
src-tauri/target/release/Atlas.exe
```

You can copy and run `Atlas.exe` as a portable standalone desktop application on Windows.

---

## 📁 Project Architecture

```
Atlas/
├── src/                        # React 19 / TypeScript Frontend
│   ├── components/
│   │   ├── ContextMenu.tsx     # Context menu & Power Tools integration
│   │   ├── LargeFileEditor.tsx # High-performance chunked file viewer/editor
│   │   ├── ListView.tsx         # Details sortable table view
│   │   ├── MillerColumns.tsx    # Miller-column browser
│   │   ├── PreviewPanel.tsx     # Built-in PDF, CSV/Excel & text inspector
│   │   ├── Sidebar.tsx          # Drives, favorites & drop zone
│   │   ├── StatusBar.tsx        # Task status & path context
│   │   ├── TabBar.tsx           # Multi-tab strip & split-pane toggle
│   │   └── Toolbar.tsx          # Breadcrumb navigation & search filter
│   ├── api.ts                  # Typed Tauri 2 IPC bridge
│   ├── App.tsx                 # Main application layout
│   ├── store.ts                # Zustand global state store
│   └── types.ts                # TypeScript interfaces
├── src-tauri/                  # Rust Backend (Tauri 2)
│   ├── src/
│   │   ├── commands.rs         # Tauri IPC commands & tool launchers
│   │   ├── fs_service.rs       # Win32 file operations, drives & clipboard
│   │   ├── large_file_service.rs # Memory-mapped chunked reading/editing
│   │   ├── lib.rs              # Tauri app builder and event loop
│   │   └── main.rs             # Windows subsystem entrypoint
│   ├── Cargo.toml              # Rust crate dependencies
│   └── tauri.conf.json         # Tauri configuration & window settings
├── package.json
└── vite.config.ts
```

---

## 📄 License

MIT License. Designed and built with ❤️.
