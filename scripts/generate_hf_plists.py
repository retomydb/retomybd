#!/usr/bin/env python3
"""Generate launchd plists for HF workers 6-30.

Run this script and it will create files in ~/Library/LaunchAgents named
com.retomy.hf.workerNN.plist where NN is 06..30. It will not overwrite the
already-created 01-05 files unless present.
"""
import os
from pathlib import Path

home = Path.home()
out_dir = home / 'Library' / 'LaunchAgents'
out_dir.mkdir(parents=True, exist_ok=True)

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
        <string>0.05</string>
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

py = str(Path.cwd() / '.venv' / 'bin' / 'python')
script = str(Path.cwd() / 'scraper' / 'hf_mass_import.py')
cwd = str(Path.cwd())

for i in range(6, 31):
    nn = f"{i:02d}"
    fname = out_dir / f"com.retomy.hf.worker{nn}.plist"
    if fname.exists():
        print(f"Skipping existing {fname}")
        continue
    content = template.format(num=nn, py=py, script=script, id=i, cwd=cwd)
    with open(fname, 'w') as f:
        f.write(content)
    print(f"Wrote {fname}")

print("Done")
