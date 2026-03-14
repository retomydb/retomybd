#!/usr/bin/env python3
"""Stagger sleep values in ~/Library/LaunchAgents/com.retomy.hf.workerNN.plist

Distributes sleep between min_sleep and max_sleep across workers 1..30.
Reloads the launchd plists after updating.
"""
import math
from pathlib import Path
import subprocess

home = Path.home()
out_dir = home / 'Library' / 'LaunchAgents'
min_sleep = 0.02
max_sleep = 0.20
n = 30
py = str(Path.cwd() / '.venv' / 'bin' / 'python')
script = str(Path.cwd() / 'scraper' / 'hf_mass_import.py')
cwd = str(Path.cwd())

template = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.retomy.hf.worker{num}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{py}</string>
        <string>{script}</string>
        <string>work</string>
        <string>--queue</string>
        <string>hf_models</string>
        <string>--worker-id</string>
        <string>{id}</string>
        <string>--sleep</string>
        <string>{sleep:.3f}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>{cwd}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PYTHONUNBUFFERED</key>
        <string>1</string>
    </dict>
    <key>StandardOutPath</key>
    <string>{cwd}/scraper/hf_worker{num}.log</string>
    <key>StandardErrorPath</key>
    <string>{cwd}/scraper/hf_worker{num}_err.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
</dict>
</plist>
'''

for i in range(1, n+1):
    nn = f"{i:02d}"
    fname = out_dir / f"com.retomy.hf.worker{nn}.plist"
    frac = (i-1)/(n-1) if n>1 else 0
    sleep = min_sleep + frac*(max_sleep-min_sleep)
    content = template.format(num=nn, py=py, script=script, id=i, sleep=sleep, cwd=cwd)
    if fname.exists():
        fname.write_text(content)
        print(f"Updated {fname} with sleep={sleep:.3f}")
    else:
        # create missing
        fname.write_text(content)
        print(f"Created {fname} with sleep={sleep:.3f}")

# Reload all plists
plist_paths = [str(out_dir / f"com.retomy.hf.worker{(i):02d}.plist") for i in range(1, n+1)]
for p in plist_paths:
    try:
        subprocess.run(["launchctl", "unload", p], check=False)
    except Exception:
        pass
for p in plist_paths:
    try:
        subprocess.run(["launchctl", "load", p], check=False)
    except Exception as e:
        print('load failed', p, e)

print('Reload complete')
