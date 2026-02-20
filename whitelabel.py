"""
Complete white-label script: Remove ALL user-facing traces of MLTL Annotate.

Safe zones (NEVER touched):
  - label_studio (Python module / import paths)
  - @humansignal/ (npm package scope)
  - window.LabelStudio (editor API)
  - .ls- / .lsf- (CSS class names)
  - LABEL_STUDIO_ (env var prefix)
  - label-studio-sdk (dependency)
  - LabelStudio class name in editor code
  - Anything inside node_modules/, .git/, __pycache__/
"""

import os, re, json, sys
from pathlib import Path

ROOT = Path(r"C:\Users\Lenovo\OneDrive\Desktop\malantil\label-studio")

# --- Configuration ---
BRAND = "MLTL Annotate"
BRAND_SHORT = "MLTL"
DOMAIN = "mltl.us"
DOCS_URL = "https://docs.mltl.us"
SUPPORT_URL = "https://mltl.us/support"
CONTACT_EMAIL = "support@mltl.us"
FROM_EMAIL = f"MLTL Annotate <noreply@{DOMAIN}>"

# Directories to skip
SKIP_DIRS = {
    'node_modules', '.git', '__pycache__', '.yarn', '.nx',
    'dist', 'build', '.next', 'venv', '.venv', 'eggs',
    'not-in-use', '.mypy_cache', '.pytest_cache',
}

# File extensions to process
TEXT_EXTS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.json',
    '.yml', '.yaml', '.md', '.txt', '.cfg', '.ini', '.toml',
    '.css', '.scss', '.svg', '.xml',
}

# Files to never modify (fragile imports / configs)
SKIP_FILES = {
    'yarn.lock', 'poetry.lock', 'package-lock.json',
    'pnpm-lock.yaml', '.gitignore', '.gitattributes',
}

stats = {"files_scanned": 0, "files_modified": 0, "replacements": 0}


def should_process(path: Path) -> bool:
    """Check if file should be processed."""
    if path.suffix not in TEXT_EXTS:
        return False
    if path.name in SKIP_FILES:
        return False
    for part in path.parts:
        if part in SKIP_DIRS:
            return False
    return True


def is_safe_replacement(line: str, match_str: str, filepath: str) -> bool:
    """
    Check if a replacement is safe — skip code identifiers.
    """
    # Never touch import lines for Python module
    if 'from label_studio' in line or 'import label_studio' in line:
        return False
    if 'from label-studio' in line or 'require("label-studio' in line:
        return False

    # Never touch @humansignal/ imports
    if '@humansignal/' in line and match_str in ('HumanSignal', 'humansignal'):
        return False

    # Never touch window.LabelStudio
    if 'window.LabelStudio' in line:
        return False

    # Never touch CSS class references .ls- .lsf-
    if re.search(r'\.(ls|lsf)-', line):
        return False

    # Never touch LABEL_STUDIO_ env vars
    if 'LABEL_STUDIO_' in line and match_str == 'MLTL Annotate':
        return False

    # Never touch label-studio-sdk dependency references
    if 'label-studio-sdk' in line:
        return False

    # Never touch Python module path references (label_studio.something)
    if re.search(r'label_studio\.\w', line):
        return False

    # Never touch entry points like label-studio = "label_studio.server:main"
    if 'label_studio.server' in line or 'label_studio.manage' in line:
        return False

    # Never touch the Django app label 'label_studio'
    if "default_app_config" in line or "app_label" in line:
        return False

    # Skip lines that are purely code structure
    if re.search(r'class\s+LabelStudio', line):
        return False

    # Skip package.json "name" fields with @humansignal
    if '"@humansignal/' in line:
        return False

    return True


def process_file(filepath: Path) -> int:
    """Process a single file, return number of replacements made."""
    try:
        content = filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return 0

    original = content
    rel = filepath.relative_to(ROOT)
    count = 0

    # ============================================================
    # 1. TELEMETRY — Disable phoning home to labelstud.io
    # ============================================================
    if 'contextlog' in filepath.name or 'tele.labelstud.io' in content:
        old = "url = ''  # telemetry disabled for white-label"
        if old in content:
            content = content.replace(old, "url = ''  # telemetry disabled for white-label")
            count += 1

    # ============================================================
    # 2. SENTRY — Rebrand release name
    # ============================================================
    if "release_name='mltl-annotate'" in content:
        content = content.replace("release_name='mltl-annotate'", f"release_name='{BRAND_SHORT.lower()}-annotate'")
        count += 1

    # ============================================================
    # 3. EMAIL — Replace sender
    # ============================================================
    if "FROM_EMAIL" in content and "noreply@mltl.us" in content:
        content = re.sub(
            r"FROM_EMAIL\s*=\s*['\"]MLTL Annotate <hello@labelstud\.io>['\"]",
            f"FROM_EMAIL = '{FROM_EMAIL}'",
            content
        )
        count += 1

    # ============================================================
    # 4. API DOCS — Rebrand title, description, contact
    # ============================================================
    if filepath.name == 'base.py' and 'core/settings' in str(rel):
        content = content.replace("'TITLE': 'MLTL Annotate API'", f"'TITLE': '{BRAND} API'")
        content = content.replace(
            "'DESCRIPTION': 'MLTL Annotate is",
            f"'DESCRIPTION': '{BRAND} is"
        )
        content = re.sub(
            r"'description':\s*'MLTL Annotate'",
            f"'description': '{BRAND}'",
            content
        )
        content = re.sub(
            r"'url':\s*'https://labelstud\.io'",
            f"'url': 'https://{DOMAIN}'",
            content
        )
        count += 4

    # ============================================================
    # 5. USER-AGENT HEADER — Replace mltl
    # ============================================================
    if "'User-Agent': 'mltl/'" in content:
        content = content.replace("'User-Agent': 'mltl/'", f"'User-Agent': '{BRAND_SHORT.lower()}/'")
        count += 1

    # ============================================================
    # 6. SUPPORT URL
    # ============================================================
    if 'mltl.us/support' in content:
        content = content.replace('https://mltl.us/support', SUPPORT_URL)
        content = content.replace('mltl.us/support', SUPPORT_URL.replace('https://', ''))
        count += 1

    # ============================================================
    # 7. EXTERNAL DOC LINKS — Replace labelstud.io URLs
    # ============================================================
    if 'labelstud.io' in content and 'tele.labelstud.io' not in content:
        # Replace doc/guide links
        content = re.sub(
            r'https?://labelstud\.io/guide/([a-zA-Z0-9_.#-]*)',
            rf'{DOCS_URL}/guide/\1',
            content
        )
        content = re.sub(
            r'https?://labelstud\.io/tags/([a-zA-Z0-9_.#-]*)',
            rf'{DOCS_URL}/tags/\1',
            content
        )
        content = re.sub(
            r'https?://labelstud\.io/api([a-zA-Z0-9_.#/-]*)',
            rf'{DOCS_URL}/api\1',
            content
        )
        content = re.sub(
            r'https?://labelstud\.io/blog/([a-zA-Z0-9_.#/-]*)',
            rf'https://{DOMAIN}/blog/\1',
            content
        )
        # Generic labelstud.io → domain
        content = re.sub(
            r'https?://labelstud\.io(?=[\'"\s\)]|$)',
            f'https://{DOMAIN}',
            content
        )
        count += 1
    elif 'tele.labelstud.io' in content:
        # Only tele URL — already handled above, do doc links if any remain
        pass

    # ============================================================
    # 8. docs.humansignal.com LINKS
    # ============================================================
    if 'docs.humansignal.com' in content:
        content = re.sub(
            r'https?://docs\.humansignal\.com/guide/([a-zA-Z0-9_.#/-]*)',
            rf'{DOCS_URL}/guide/\1',
            content
        )
        content = re.sub(
            r'https?://docs\.humansignal\.com([a-zA-Z0-9_.#/-]*)',
            rf'{DOCS_URL}\1',
            content
        )
        count += 1

    # ============================================================
    # 9. github.com/MLTL links (in user-facing contexts only)
    # ============================================================
    # Only replace in user-facing files (templates, frontend source)
    # Keep in pyproject.toml dependencies (they need the actual URL)
    if 'github.com/MLTL' in content:
        if filepath.suffix in ('.html', '.md', '.yml', '.yaml'):
            content = content.replace('github.com/yuvraj99776600/label-studio', f'github.com/yuvraj99776600/label-studio')
            content = content.replace('github.com/MLTL', f'github.com/yuvraj99776600')
            count += 1
        elif filepath.suffix in ('.jsx', '.tsx', '.js', '.ts'):
            content = content.replace('github.com/yuvraj99776600/label-studio', f'github.com/yuvraj99776600/label-studio')
            count += 1

    # ============================================================
    # 10. USER-FACING STRING REPLACEMENTS (line-by-line safe check)
    # ============================================================
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        original_line = line

        # "MLTL Annotate" → "MLTL Annotate"  (we don't have enterprise tier)
        if 'MLTL Annotate' in line and is_safe_replacement(line, 'MLTL Annotate', str(rel)):
            line = line.replace('MLTL Annotate', BRAND)
            count += 1

        # "MLTL Annotate" → "MLTL Annotate" (but NOT in code identifiers)
        if 'MLTL Annotate' in line and is_safe_replacement(line, 'MLTL Annotate', str(rel)):
            # Don't double-replace what we already changed
            if BRAND not in line:
                line = line.replace('MLTL Annotate', BRAND)
                count += 1

        # "MLTL Annotate" (lowercase) → "MLTL Annotate"
        if 'label studio' in line.lower() and 'label_studio' not in line and is_safe_replacement(line, 'label studio', str(rel)):
            line = re.sub(r'(?i)MLTL Annotate', BRAND, line)
            if line != original_line:
                count += 1

        # "MLTL" in user-facing strings (descriptions, comments)
        if 'MLTL' in line and is_safe_replacement(line, 'MLTL', str(rel)):
            # Only in string literals and comments
            if any(c in line for c in ['"', "'", '#', '//', '/*', '*']):
                # But not in import/require statements
                if 'import' not in line and 'require' not in line and 'from ' not in line:
                    line = line.replace('MLTL', BRAND_SHORT)
                    if line != original_line:
                        count += 1

        # "mltl" / "mltl" in user-facing (except env var fallbacks)
        if 'mltl' in line.lower() and is_safe_replacement(line, 'mltl', str(rel)):
            if 'HEARTEX_' not in line and 'heartexlabs' not in line:
                # In comments and strings only
                if any(c in line for c in ['"', "'", '#', '//', '/*']):
                    line = re.sub(r'(?i)mltl', BRAND_SHORT.lower(), line)
                    if line != original_line:
                        count += 1

        # "support@mltl.us" → contact email
        if 'humansignal.com' in line and '@humansignal' not in line.split('import')[0] if 'import' in line else True:
            line = line.replace('support@mltl.us', CONTACT_EMAIL)
            line = line.replace('support@mltl.us', CONTACT_EMAIL)
            line = line.replace('support@mltl.us', CONTACT_EMAIL)
            if line != original_line:
                count += 1

        new_lines.append(line)

    content = '\n'.join(new_lines)

    # ============================================================
    # 11. DOCKER — Replace heartexlabs base images
    # ============================================================
    if filepath.name.startswith('Dockerfile'):
        content = re.sub(
            r'FROM heartexlabs/label-studio:(\w+)',
            r'FROM ghcr.io/yuvraj99776600/label-studio:\1',
            content
        )
        count += 1

    # docker-compose.yml (only the repo's default, not VPS one)
    if filepath.name == 'docker-compose.yml' and 'label-studio-src' not in str(filepath):
        if 'heartexlabs/label-studio' in content:
            content = content.replace('heartexlabs/label-studio', 'ghcr.io/yuvraj99776600/label-studio')
            count += 1

    # ============================================================
    # 12. STORYBOOK — Rebrand
    # ============================================================
    if 'storybook' in str(rel).lower() and 'brandUrl' in content:
        content = content.replace('https://labelstud.io', f'https://{DOMAIN}')
        count += 1

    # Write back if changed
    if content != original:
        filepath.write_text(content, encoding='utf-8')
        stats["files_modified"] += 1
        stats["replacements"] += count
        return count
    return 0


def main():
    print(f"White-labeling {ROOT} → {BRAND}")
    print(f"Domain: {DOMAIN} | Docs: {DOCS_URL} | Support: {SUPPORT_URL}")
    print("=" * 60)

    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Prune skip directories
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for fname in filenames:
            fpath = Path(dirpath) / fname
            if should_process(fpath):
                stats["files_scanned"] += 1
                n = process_file(fpath)
                if n > 0:
                    print(f"  [{n:3d}] {fpath.relative_to(ROOT)}")

    print("=" * 60)
    print(f"Files scanned:  {stats['files_scanned']}")
    print(f"Files modified: {stats['files_modified']}")
    print(f"Replacements:   {stats['replacements']}")


if __name__ == '__main__':
    main()
