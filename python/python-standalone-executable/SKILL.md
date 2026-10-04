---
name: python-standalone-executable
description: Package Python applications into standalone executables with embedded Python runtime and zero external dependencies
keywords: ['packaging', 'executable', 'PyInstaller', 'standalone', 'distribution', 'Windows', 'Python']
applyTo: '**'
relatedSkills: []
---

# Python Standalone Executable Packaging

Package any Python application (CLI or GUI) into a single standalone executable that runs on Windows without requiring Python, pip, or external dependencies on the target machine. The executable contains the Python 3.12+ runtime, all dependencies, and application code bundled together.

## Use This Skill When

- Distributing a Python CLI tool, GUI application, or hybrid (CLI+GUI) to end users
- Creating executable installers for automated workflows or batch processing
- Building tools that must run on machines without Python, pip, or any package managers installed
- Reducing deployment friction and environment setup overhead
- Creating reproducible, deterministic builds using UV for dependency management
- Supporting legacy Windows environments (7+) with zero Python knowledge required from users

## Not For

- Applications requiring dynamic package installation at runtime
- Projects with native C/Rust extensions requiring compilation on the target system
- Applications that need to update themselves without redistributing the full executable

---

## Architecture Overview

Your Python application is bundled into a single executable that:

```
Application Code (src/)
    ↓
Dependencies (exported via UV to requirements.txt)
    ↓
PyInstaller (analysis, collection, bundling)
    ↓
Python 3.12 Runtime (embedded)
    ↓
Standalone .exe (~50-200 MB, zero dependencies)
```

**Key insight:** PyInstaller statically analyzes your Python code, imports all dependencies, and packages them with a Python runtime into a self-extracting executable. When launched, it extracts everything to a temporary directory and runs your application.

---

## Prerequisites

- **Python 3.12+** (locally for building; not needed on target machines)
- **UV** (0.9+) for dependency management and export
- **PyInstaller** (6.1+) as a dev dependency in `pyproject.toml`
- **Windows 10+** for building (builds are platform-specific; build on Windows 10/11 to target Windows)
- **Tkinter** (included with Python; auto-bundled if using GUI)
- **Target system:** Windows 7+ (officially supported by Python 3.12)

### Add to pyproject.toml

```toml
[dependency-groups]
dev = [
    "pyinstaller>=6.1.0",
    # ... other dev deps
]
```

---

## Phase 1: Project Setup

### 1.1 Structure Your Project

Use `src/` layout with a proper entry point:

```
your_project/
├── src/
│   ├── __init__.py
│   ├── main.py              # Main application logic; contains main() function
│   ├── package/             # Application modules
│   │   ├── __init__.py
│   │   └── module.py
│   └── utils/               # Utilities, helpers
├── data/                    # Static data files (CSV, config, etc.)
├── pyproject.toml           # Project metadata + dependencies
├── __main__.py              # Entry point wrapper for PyInstaller
├── devkee_excel.spec        # PyInstaller spec file (generated, then committed)
└── requirements.txt         # Frozen dependencies (exported from UV)
```

**Critical:** Your `src/main.py` must have a `main()` function that handles both CLI and GUI modes:

```python
# src/main.py
import sys

def main() -> None:
    """Application entry point supporting CLI and GUI modes."""
    if len(sys.argv) > 1:
        # CLI mode: process arguments
        handle_cli(sys.argv[1:])
    else:
        # GUI mode: no arguments
        launch_gui()

if __name__ == "__main__":
    main()
```

**Pattern:** If command-line arguments are provided, run in CLI mode. If none, launch GUI. Both modes can coexist.

### 1.2 Create the PyInstaller Wrapper

Create `__main__.py` at the project root. This is **not** the same as `src/__main__.py`:

```python
"""Wrapper entry point for PyInstaller bundling."""
from src.main import main

if __name__ == "__main__":
    main()
```

**Why:** PyInstaller needs a single, simple entry point at the root. The wrapper imports your actual application from `src/`.

### 1.3 Export Dependencies with UV

Create `requirements.txt` from your `uv.lock`:

```bash
uv export --format requirements-txt -o requirements.txt
```

PyInstaller analyses imports from the active build environment; it does not read `requirements.txt`. Use the lockfile to create a reproducible build environment. Export `requirements.txt` only if needed for distribution or audit, and inspect it for local paths, private index URLs, and credentials before committing.

---

## Phase 2: Initial PyInstaller Configuration

### 2.1 Generate Initial Spec File

Run PyInstaller once to create a spec file:

```bash
uv run pyinstaller __main__.py \
  --onefile \
  --name=your_app_name \
  --specpath=. \
  --distpath=dist \
  --buildpath=build
```

This creates `your_app_name.spec` in the current directory.

When a spec file needs paths relative to itself, use PyInstaller's `SPECPATH`. The spec execution context may not define `__file__`.

### 2.2 Identify Hidden Imports

PyInstaller's static analysis sometimes misses dynamically imported modules. Common culprits:

| Package | Hidden Import | Reason |
|---------|---------------|--------|
| **pydantic v2** | `--hidden-import=pydantic.json_schema` | Dynamic submodule loading |
| **openpyxl** | `--collect-all=openpyxl` | C extensions + data files |
| **python-dotenv** | `--hidden-import=dotenv` | Lazy imports |
| **tkinter** | Usually auto-detected | May need explicit import if not in entry point |
| **typing, dataclasses** | Usually auto-detected | Stdlib modules |

**How to find hidden imports:**
1. Run the packaged executable: `dist/your_app.exe`
2. If you get `ModuleNotFoundError: No module named 'X'`, note the module name
3. Add `--hidden-import=module_name` or `--collect-all=module_name` to your `.spec` file
4. Rebuild: `uv run pyinstaller your_app.spec`
5. Test again

**Tip:** Use `uv run pyinstaller --collect-all=openpyxl --analyze-imports __main__.py` to preview what will be bundled before building.

### 2.3 Identify Data Files

If your application loads static files (CSV, config, images), you must bundle them:

```bash
--add-data="data;data"
```

This copies the `data/` folder into the executable and makes it accessible at `sys._MEIPASS/data/` at runtime (or `./data/` in development mode).

**Windows syntax:** Use semicolon (`;`) as separator: `data;data`  
**Linux/Mac syntax:** Use colon (`:`) as separator: `data:data`

**Why two arguments:** First is source path (relative to project root), second is destination path inside the bundle.

Bundle only application-owned static resources. Keep `.env`, credentials, user inputs, and writable outputs external. Use `sys._MEIPASS` only to locate bundled resources; resolve user files from explicit paths, the working directory, or an appropriate user-data directory. Never write outputs under the extraction directory.

---

## Special Case: Hybrid CLI+GUI Applications

If your application supports both CLI and GUI modes (like devkee_excel), follow this pattern:

### Architecture

```
application.exe                    # Single executable
├─ No arguments → Launch GUI
└─ With arguments → Run CLI mode
```

### Implementation Pattern

**1. In `src/main.py`, detect the mode:**

```python
import sys
from pathlib import Path

def main() -> None:
    """Entry point supporting both CLI and GUI modes."""
    if len(sys.argv) > 1:
        # CLI mode: process arguments
        base_file = sys.argv[1]
        compare_file = sys.argv[2]
        
        # Validate files
        if not Path(base_file).exists():
            print(f"Error: File not found: {base_file}")
            sys.exit(1)
        
        # Run comparison
        result = run_comparison(base_file, compare_file)
        print_results(result)
    else:
        # GUI mode: no arguments
        from src.gui.main_window import MainWindow
        app = MainWindow()
        app.mainloop()

if __name__ == "__main__":
    main()
```

**2. In `.spec` file, keep `console=True`:**

```python
exe = EXE(
    ...,
    console=True,  # Keep True for hybrid apps (CLI needs visible console)
    ...
)
```

**Why `console=True`?**
- CLI mode needs console output for printing results
- GUI mode doesn't require hidden console; having it visible doesn't hurt
- If you set `console=False`, CLI output won't display

### Testing Hybrid Applications

```bash
# Test GUI mode (double-click or no arguments)
dist/your_app.exe

# Test CLI mode (command line)
dist/your_app.exe base_file.xlsx compare_file.xlsx
dist/your_app.exe --help
dist/your_app.exe --version
```

### Distribution Notes

For hybrid applications:
- Document both usage modes in README/help text
- Provide shortcut in installer that launches GUI mode (double-click executable)
- Provide CLI documentation for automation scenarios
- Real-world example: **devkee_excel** (19.4 MB) demonstrates this pattern perfectly

---

## Phase 3: Build the Spec File

Edit your `.spec` file to include all hidden imports and data files. Here's a template:

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Define data files to bundle
datas = [('data', 'data')]  # Copy data/ folder
binaries = []
hiddenimports = [
    'pydantic.json_schema',      # For pydantic v2
    'openpyxl',                  # For Excel handling
    'dotenv',                    # For environment variables
]

# Collect all submodules for openpyxl
tmp_ret = collect_all('openpyxl')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Define Analysis (what to bundle)
a = Analysis(
    ['__main__.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

# Package everything
pyz = PYZ(a.pure)

# Create executable
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='your_app_name',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,                    # Enable UPX compression (optional)
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,                # Set to False for GUI apps (no console window)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

**Key Parameters:**

| Parameter | Purpose | Pure GUI | Pure CLI | Hybrid (CLI+GUI) |
|-----------|---------|---------|---------|------------------|
| `console=True` | Show console window | False | True | **True** (CLI needs console) |
| `upx=True` | Compress executable (30-50% smaller) | Optional | Optional | Optional |
| `datas` | Bundle static files | ✅ | ✅ | ✅ |
| `hiddenimports` | Dynamically imported modules | ✅ | ✅ | ✅ |
| `collect_all('module')` | Deep collection of submodules | ✅ | ✅ | ✅ |

### 3.1 Handle Data Files at Runtime

If bundling data files, access them at runtime using `sys._MEIPASS`. **Important:** When running as a PyInstaller bundle, `__file__` is unreliable; always use `sys._MEIPASS`:

```python
import sys
from pathlib import Path

def get_data_file(filename: str) -> Path:
    """Get path to bundled data file."""
    if getattr(sys, 'frozen', False):
        # Running as PyInstaller bundle
        base_path = Path(sys._MEIPASS)
    else:
        # Running as normal Python script (development)
        base_path = Path(__file__).parent.parent  # Go up to project root
    return base_path / 'data' / filename

# Usage
csv_file = get_data_file('sic_codes_2007.csv')
with open(csv_file) as f:
    data = f.read()
```

**Best practice:** Use this utility function in your application initialization to load all data files once.

---

## Phase 4: Build the Executable

### 4.1 Build with Spec File

```bash
uv run pyinstaller your_app_name.spec
```

### 4.2 Expected Output

```
dist/
├── your_app_name.exe        # Your standalone executable
build/                       # Temporary build files (can delete)
.spec                        # PyInstaller spec file (keep, commit to version control)
```

**Executable size:** 30-300 MB depending on dependencies. Real examples:
- **Small:** CLI tools with minimal dependencies (~30-50 MB)
- **Medium:** Excel tools with pydantic + openpyxl + Tkinter GUI (~60-100 MB)
- **Large:** Data science apps with numpy, scipy, pandas, matplotlib (~150-300 MB)

The devkee_excel project (pydantic + openpyxl + Tkinter GUI) = **19.4 MB** (with UPX compression)

### 4.3 Test the Executable Thoroughly

**For hybrid (CLI+GUI) applications:**
```bash
# Test GUI mode (no arguments)
dist/your_app_name.exe

# Test CLI mode with arguments
dist/your_app_name.exe arg1 arg2
dist/your_app_name.exe --help
```

**For pure CLI applications:**
```bash
dist/your_app_name.exe file1.xlsx file2.xlsx
dist/your_app_name.exe --version
```

**For pure GUI applications:**
```bash
dist/your_app_name.exe
```

**Verification checklist:**
- [ ] All command-line arguments work correctly
- [ ] Data files load successfully (if bundled)
- [ ] Run CLI checks from a working directory outside the source tree; verify external configuration and user input/output paths
- [ ] GUI renders properly and is interactive (if applicable)
- [ ] No `ModuleNotFoundError` or import exceptions
- [ ] Review PyInstaller warning output; investigate missing imports and hook warnings, but distinguish warnings from build failures
- [ ] File dialogs work and can read/write files
- [ ] Application exits cleanly without crashes
- [ ] Test on a Windows machine without Python installed (if possible)

---

## Phase 5: Optimization

### 5.1 Enable UPX Compression

**Install UPX** (optional, reduces size by 30-50%):

```bash
# Windows: download from https://upx.github.io/
# Or via Chocolatey: choco install upx
```

Then in your `.spec`:

```python
exe = EXE(
    ...,
    upx=True,
    upx_exclude=['vcruntime140.dll'],  # Exclude DLLs from compression
    ...
)
```

**Trade-off:** Smaller file size, slightly slower startup (decompression overhead ~1-2 sec).

### 5.2 Reduce Included Modules

Check what PyInstaller bundled:

```bash
uv run pyinstaller --analyze-imports your_app_name.spec
```

Exclude unnecessary modules in the `.spec`:

```python
a = Analysis(
    ...,
    excludes=['matplotlib', 'pandas'],  # If not used
)
```

### 5.3 Code Obfuscation (Optional)

To protect your code from reverse engineering, use **PyArmor**:

```bash
uv pip install pyarmor
pyarmor obfuscate --restrict src/main.py
```

Integrate with PyInstaller by bundling obfuscated code.

---

## Phase 6: Distribution

### 6.1 Direct Executable Distribution

Simply distribute the `.exe` file. End users can:
- Copy to any Windows directory
- Run directly (no installation needed)
- No Python installation required on target machine

### 6.2 Create an Installer (NSIS)

For professional distribution, create an NSIS installer:

```nsis
; installer.nsi
Name "Your App"
OutFile "your_app_installer.exe"
InstallDir "$PROGRAMFILES\YourApp"

Section "Install"
  SetOutPath "$INSTDIR"
  File "dist\your_app_name.exe"
  CreateDirectory "$SMPROGRAMS\YourApp"
  CreateShortCut "$SMPROGRAMS\YourApp\Your App.lnk" "$INSTDIR\your_app_name.exe"
SectionEnd
```

Build with: `makensis installer.nsi`

### 6.3 Version the Executable

Tag releases in Git with the build version:

```bash
git tag -a v1.0.0-build -m "Release: devkee_excel 1.0.0"
git push origin v1.0.0-build
```

Include version info in your `.spec`:

```python
exe = EXE(
    ...,
    version='your_app_version_info',  # Windows version info
)
```

---

## Common Issues & Solutions

### Issue 1: ModuleNotFoundError at Runtime

**Symptom:** Executable crashes immediately with `ModuleNotFoundError: No module named 'X'`

**Root cause:** PyInstaller's static analysis didn't detect dynamic imports or optional dependencies.

**Solution:**
1. Run the executable and note the missing module name
2. Add to `.spec` file:
   ```python
   hiddenimports = [..., 'missing_module']
   ```
3. Or rebuild with command-line flag:
   ```bash
   uv run pyinstaller --hidden-import=missing_module your_app_name.spec
   ```
4. Rebuild and test:
   ```bash
   rm -rf build dist
   uv run pyinstaller your_app_name.spec
   dist/your_app_name.exe
   ```

**Common offenders:**
- `pydantic.json_schema` (Pydantic v2 introspection)
- `lxml` (openpyxl's optional C extension)
- Any module imported dynamically in conditional code
- Any package with optional features you use

**Prevention:** Test your CLI and GUI modes thoroughly before packaging.

### Issue 2: Data Files Not Found

**Symptom:** `FileNotFoundError: [Errno 2] No such file or directory: 'data/sic_codes_2007.csv'`

**Root cause:** Data files aren't bundled with the executable (missing `--add-data` flag or `datas` in `.spec`).

**Solution:**
1. **In your `.spec` file**, add:
   ```python
   datas = [('data', 'data')]  # Copy data/ folder into bundle
   ```
2. **At runtime**, use this utility:
   ```python
   import sys
   from pathlib import Path
   
   if getattr(sys, 'frozen', False):
       data_dir = Path(sys._MEIPASS) / 'data'
   else:
       data_dir = Path(__file__).parent.parent / 'data'  # Development mode
   
   csv_file = data_dir / 'sic_codes_2007.csv'
   ```
3. Rebuild and verify:
   ```bash
   rm -rf build dist
   uv run pyinstaller your_app_name.spec
   ```

**Verification:** Extract the built `.exe` with 7-Zip and check if `data/` folder exists inside.

### Issue 3: Slow Startup (5+ seconds)

**Symptom:** Executable takes 5-10 seconds to start

**Causes:** 
- Large bundled modules (scipy, numpy, pandas)
- UPX compression (adds decompression time)
- Extraction to temp directory on every run

**Solutions:**
1. Use `--onedir` mode instead of `--onefile` (faster on repeated launches):
   ```bash
   uv run pyinstaller --onedir your_app_name.spec
   ```
2. Disable UPX if it's overhead:
   ```python
   exe = EXE(..., upx=False, ...)
   ```
3. Pre-cache imports in your app startup
4. Consider PyOxidizer (see alternatives section)

### Issue 4: Antivirus False Positives

**Symptom:** Windows Defender or antivirus flags the executable as malware

**Causes:**
- UPX compression (looks like packing/obfuscation)
- Self-extracting behavior (legitimate apps do this too)
- PyInstaller bootstrap code

**Solutions:**
1. **Sign the executable:**
   ```bash
   signtool sign /f certificate.pfx /p password /t http://timestamp.server dist/your_app.exe
   ```
2. **Disable UPX:**
   ```python
   exe = EXE(..., upx=False, ...)
   ```
3. **Submit to antivirus vendors for whitelisting**
4. **Use codesigning certificate from a trusted CA**

### Issue 5: Missing Tkinter (GUI Framework)

**Symptom:** `tkinter.TclError` or import fails

**Solution:**
1. Tkinter should auto-detect with PyInstaller
2. If missing, add:
   ```python
   hiddenimports = [..., 'tkinter']
   ```
3. Ensure your build Python has Tkinter (install with Python)

---

## Advanced Topics

### Custom PyInstaller Hooks

For complex packages PyInstaller doesn't handle well, create a custom hook:

```python
# hooks/hook-my_package.py
from PyInstaller.utils.hooks import collect_data_files

datas = collect_data_files('my_package')
hiddenimports = ['my_package.submodule']
```

Pass to PyInstaller:
```bash
uv run pyinstaller --hookspath=./hooks your_app_name.spec
```

### Multi-File Distribution (--onedir)

For faster iteration and smaller updates, use `--onedir`:

```python
exe = EXE(
    ...
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='your_app_name'
)
```

This creates:
```
dist/your_app_name/
├── your_app_name.exe
├── python312.dll
├── pydantic/
└── ... (all dependencies)
```

### PyOxidizer: The Modern Alternative

**When to use:** If you need true embedding (executable inside executable), fast startup, or smallest file size.

**Setup:**

```bash
pip install pyoxidizer
pyoxidizer init-rust-project --package-root src your_project
```

**Trade-off:** Requires Rust toolchain; steeper learning curve; not needed for most use cases.

---

## Complete Workflow Checklist

### Setup Phase
- [ ] **Create entry point wrapper**
  - [ ] Create `__main__.py` at project root (import from `src.main`)
  - [ ] Verify `src/main.py` has `main()` function with CLI + GUI mode detection

- [ ] **Freeze dependencies**
    - [ ] Run: `uv export --format requirements-txt -o requirements.txt`
  - [ ] Commit `requirements.txt` to version control
  - [ ] Add `pyinstaller>=6.1.0` to `[dependency-groups.dev]` in `pyproject.toml`

### Configuration Phase
- [ ] **Generate initial spec file**
  - [ ] Run: `uv run pyinstaller __main__.py --onefile --specpath=. --name=your_app`
  - [ ] Verify `your_app.spec` created in project root

- [ ] **First test**
  - [ ] Run: `dist/your_app.exe`
  - [ ] Identify any `ModuleNotFoundError` exceptions
  - [ ] Document missing modules

- [ ] **Identify hidden imports**
  - [ ] For each `ModuleNotFoundError`, add to `hiddenimports` in `.spec`
  - [ ] Common: `pydantic.json_schema`, `openpyxl`, `dotenv`
  - [ ] If package has C extensions: use `collect_all('package_name')`

- [ ] **Identify data files**
  - [ ] List all data files your app loads (CSV, config, images)
  - [ ] Add to `.spec`: `datas = [('data', 'data')]`
  - [ ] Update code to use `sys._MEIPASS` for file access

### Building Phase
- [ ] **Final build**
  - [ ] Run: `rm -rf build dist` (clean old builds)
  - [ ] Run: `uv run pyinstaller your_app.spec`
  - [ ] Verify: `dist/your_app.exe` exists

### Testing Phase
- [ ] **Comprehensive testing**
  - [ ] **GUI mode:** Launch without arguments → `dist/your_app.exe`
  - [ ] **CLI mode:** Test with arguments → `dist/your_app.exe arg1 arg2`
  - [ ] **Data files:** Verify all CSV/config files load
  - [ ] **Exit:** Test clean shutdown and error handling
  - [ ] **(Optional) Cross-machine:** Test on Windows machine without Python

### Distribution Phase
- [ ] **Version control**
  - [ ] Commit `.spec` file to Git
  - [ ] Tag release: `git tag -a v1.0.0-build`

- [ ] **Distribution**
  - [ ] Copy `dist/your_app.exe` to releases folder
  - [ ] (Optional) Create NSIS installer for professional distribution

- [ ] **Documentation**
  - [ ] Document system requirements (Windows 7+)
  - [ ] Document command-line usage and GUI usage
  - [ ] Mention antivirus whitelisting if needed

---

## Reference: Configuration Parameters

### PyInstaller Spec File Parameters

```python
Analysis(
    scripts=['__main__.py'],           # Entry point
    pathex=[],                         # Import search paths
    binaries=[],                       # Additional binaries to include
    datas=[('data', 'data')],          # Data files: (src, dest)
    hiddenimports=['module'],          # Modules to force-include
    excludes=['unused'],               # Modules to exclude
    optimize=0,                        # Optimization level (0, 1, 2)
)

EXE(
    name='app',                        # Output executable name
    console=True,                      # Show console (False for GUI)
    upx=True,                          # Enable UPX compression
)
```

### Command-Line Equivalents

```bash
# One-file executable with hidden imports and data
pyinstaller \
  --onefile \
  --hidden-import=module1 \
  --hidden-import=module2 \
  --add-data="data;data" \
  --collect-all=openpyxl \
  --name=my_app \
  __main__.py

# One-directory (faster on relaunch)
pyinstaller --onedir --name=my_app __main__.py

# No console window (GUI apps)
pyinstaller --windowed --onefile --name=my_app __main__.py
```

---

## Tools & Resources

**Essential:**
- [PyInstaller Documentation](https://pyinstaller.org/)
- [UV Documentation](https://docs.astral.sh/uv/)
- [Python Packaging Guide](https://packaging.python.org/)

**Optional:**
- [UPX Compressor](https://upx.github.io/) — Reduce executable size
- [NSIS Installer](https://nsis.sourceforge.io/) — Create Windows installers
- [PyArmor](https://pyarmor.readthedocs.io/) — Code obfuscation
- [PyOxidizer](https://gregoryszorc.com/docs/pyoxidizer/stable/) — Modern Rust-based packaging

**Comparison with PyOxidizer:**
| Aspect | PyInstaller | PyOxidizer |
|--------|-------------|------------|
| Maturity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Learning Curve | Easy | Moderate (Rust) |
| Startup Speed | 2-5 sec | <1 sec |
| File Size | 100-200 MB | 50-120 MB |
| Data Files | ✅ (sys._MEIPASS) | ✅ |
| Recommended For | Most projects | Fast startup, embedded runtime |

---

## Example: Complete Implementation

### Project Structure
```
my_app/
├── src/
│   ├── __init__.py
│   ├── main.py              # Contains main() function
│   └── processor.py
├── data/
│   └── config.csv
├── __main__.py              # PyInstaller entry point
├── my_app.spec              # PyInstaller configuration
├── requirements.txt         # Exported from UV
└── pyproject.toml
```

### Step 1: Create __main__.py
```python
from src.main import main

if __name__ == "__main__":
    main()
```

### Step 2: Export Dependencies
```bash
uv export --format requirements-txt -o requirements.txt
```

### Step 3: Generate Spec
```bash
uv run pyinstaller __main__.py --onefile --name=my_app --specpath=.
```

### Step 4: Edit my_app.spec
```python
from PyInstaller.utils.hooks import collect_all

datas = [('data', 'data')]
binaries = []
hiddenimports = ['csv', 'json']
tmp_ret = collect_all('openpyxl')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

a = Analysis(
    ['__main__.py'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, name='my_app', console=True, upx=True)
```

### Step 5: Build
```bash
uv run pyinstaller my_app.spec
```

### Step 6: Distribute
```bash
# Test
dist/my_app.exe --help

# Distribute
cp dist/my_app.exe ~/releases/my_app_v1.0.0.exe
```

---

## Success Criteria

You've successfully created a standalone executable when:

✅ **Runs independently:** Executable runs on Windows 7+ without Python, pip, or any package manager installed  
✅ **CLI mode works:** All command-line arguments, flags, and options function correctly  
✅ **GUI mode works:** (If applicable) GUI launches, renders correctly, and is interactive  
✅ **Data files load:** All CSV, config, and static files are accessible at runtime  
✅ **No import errors:** Zero `ModuleNotFoundError` or missing package exceptions  
✅ **File I/O works:** Application can read/write files, open file dialogs, save results  
✅ **Exit cleanly:** Application handles errors gracefully and exits without crashes  
✅ **Performance:** Startup time <5 seconds (typical); <1 second on subsequent runs if using `--onedir`  
✅ **File size:** Reasonable for dependencies (~50-150 MB typical for business apps)  
✅ **Antivirus compatible:** Doesn't trigger false positives (or can be whitelisted/code-signed)  

---

## Summary

**5-Phase Process:**

1. **Setup** — Create `__main__.py` wrapper, export UV dependencies to `requirements.txt`, add PyInstaller to dev dependencies
2. **Configure** — Generate `.spec` file with hidden imports (pydantic, openpyxl, etc.) and data bundling
3. **Build** — Run `pyinstaller your_app.spec` to create standalone executable
4. **Test** — Thoroughly test CLI mode, GUI mode, data file loading, and error handling
5. **Distribute** — Share single `.exe` file; users need nothing else

**Result:** A single, self-contained `.exe` file that runs on any Windows 7+ machine without Python, pip, or any external dependencies installed. Your application is now truly standalone.

**Typical workflow time:** 30-60 minutes from project to packaged executable (for straightforward applications).

