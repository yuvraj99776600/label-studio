#!/usr/bin/env python3
"""
Fix broken references from the aggressive whitelabel.py run.
Fixes:
1. MLTLCspMiddleware → HumanSignalCspMiddleware (class ref in settings)
2. github.com/MLTL/<repo> → correct URLs
3. raw.githubusercontent.com/MLTL/<repo> → correct URLs
4. FROM_EMAIL: noreply@mltl.us → noreply@mltl.us
5. mltl.atlassian.net → keep as-is (just a default, not breaking)
"""

import os
import re

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
EXTENSIONS = {'.py', '.js', '.jsx', '.tsx', '.ts', '.json', '.yml', '.yaml',
              '.xml', '.html', '.md', '.toml', '.cfg', '.txt', '.rst', '.svg',
              '.scss', '.css'}

SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist',
             'build', '.tox', '.mypy_cache', '.ruff_cache', '.eggs'}

changes = 0
files_modified = 0

def process_file(filepath):
    global changes, files_modified
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return

    original = content
    
    # 1. Fix broken middleware class reference
    content = content.replace(
        "core.middleware.HumanSignalCspMiddleware",
        "core.middleware.HumanSignalCspMiddleware"
    )
    
    # 2. Fix GitHub URLs for repos we don't own
    # These external repos still live under HumanSignal org
    external_repos = [
        'awesome-label-studio-configs',
        'label-studio-ml-backend', 
        'label-studio-sdk',
        'label-studio-converter',
        'label-studio-frontend',
        'label-studio-transformers',
    ]
    for repo in external_repos:
        content = content.replace(
            f'github.com/MLTL/{repo}',
            f'github.com/HumanSignal/{repo}'
        )
        content = content.replace(
            f'githubusercontent.com/MLTL/{repo}',
            f'githubusercontent.com/HumanSignal/{repo}'
        )
    
    # 3. Fix our own repo URL: MLTL/label-studio → yuvraj99776600/label-studio
    # But NOT in the whitelabel.py script itself (to avoid recursion issues)
    if 'fixup_whitelabel' not in filepath:
        content = content.replace(
            'github.com/MLTL/label-studio',
            'github.com/yuvraj99776600/label-studio'
        )
        content = content.replace(
            'githubusercontent.com/MLTL/label-studio',
            'githubusercontent.com/yuvraj99776600/label-studio'
        )
    
    # 4. Fix FROM_EMAIL - change noreply@mltl.us to noreply@mltl.us  
    content = content.replace(
        'noreply@mltl.us',
        'noreply@mltl.us'
    )
    
    # 5. Fix the whitelabel.py FROM_EMAIL regex pattern (was referencing old email)
    # This is handled naturally by the noreply@mltl.us replacement above
    
    if content != original:
        count = 0
        for old_c, new_c in zip(original, content):
            if old_c != new_c:
                count += 1
        # More accurate: count actual replacements
        n = len(content) - len(original) if len(content) != len(original) else 0
        # Just count differences by lines
        old_lines = original.splitlines()
        new_lines = content.splitlines()
        line_changes = sum(1 for o, n in zip(old_lines, new_lines) if o != n)
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        
        rel = os.path.relpath(filepath, REPO_ROOT)
        print(f"  [{line_changes:>4}] {rel}")
        changes += line_changes
        files_modified += 1


def walk_repo():
    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext in EXTENSIONS:
                process_file(os.path.join(root, fname))


if __name__ == '__main__':
    print(f"Fixing broken references in {REPO_ROOT}")
    print("=" * 60)
    walk_repo()
    print("=" * 60)
    print(f"Files modified: {files_modified}")
    print(f"Lines changed:  {changes}")
