# Run POLAR PULSE on your laptop

## Before starting

Use a laptop with 64-bit Python 3.11–3.13, a recent Chrome/Edge/Firefox browser, and internet for first-time Python package installation. The actual demo uses only local assets after setup. No Node, Docker, GPU, external map account or AI key is required for normal use. The build was tested on Linux/Python 3.13.5; native Windows setup must be checked on your machine.

1. Right-click the downloaded ZIP and choose **Extract All**.
2. Open the extracted folder. You should see `START_HERE.html`, `SETUP_WINDOWS.bat` and `START_WINDOWS.bat` directly. Do not start from a ZIP preview.
3. Double-click `SETUP_WINDOWS.bat`. Let it finish and display **Setup complete**. It installs into this folder's `.venv`, not into your whole computer.
4. Double-click `START_WINDOWS.bat`. Keep the terminal open.
5. The browser opens `http://127.0.0.1:8000` after the engine is ready. The first scenario takes a few seconds to calculate.
6. Press **Run judge demo**. Use Pause/Next to narrate.

The app runs on **your own laptop**. The local address is not a public hosted link, and the download does not install an internet service.

## Normal commands in PowerShell

Open the project folder, then use the address bar in File Explorer to type `powershell`.

```powershell
.\SETUP_WINDOWS.bat
.\START_WINDOWS.bat
```

Manual alternative with an already-installed Python:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe start.py
```

No PowerShell execution-policy changes are needed. Do not disable antivirus or firewall protections to run a demo.

## Common issues

**Python is not recognized / Microsoft Store opens:** install Python from the official Python website; select **Add python.exe to PATH**. Close and reopen the terminal. The setup launcher tries the `py` launcher before `python`.

**Python 3.14 or newer is selected:** the supplied dependency set was tested with 3.13. Use a side-by-side 3.11–3.13 installation; setup prefers those versions. Do not assume every future Python release has compatible dependency wheels.

**Package installation fails:** check the actual terminal error, internet/proxy and available disk space. Run setup again. Corporate proxies may need IT assistance. Do not proceed until imports succeed.

**Port 8000 is already in use:** close the previous POLAR PULSE terminal, or use:

```powershell
.\START_WINDOWS.bat --port 8001
```

Then open `http://127.0.0.1:8001`.

**Browser did not open:** keep the terminal running and enter the local address manually. Look for Uvicorn's ready/listening line. A remote browser/device cannot use your laptop's `127.0.0.1` address.

**Blank page after changing frontend source:** run `python scripts/build_frontend.py` after installing the optional frontend development dependency, restart the server, then hard-refresh the browser. Normal users should use the included compiled frontend.

**No admissible route:** this can be an honest result for severe scenarios, land waypoints or a search budget limit. Use Route planner → Restore default waypoints, or restart Run judge demo. Never switch off exclusions just to draw a line.

**Map is small on a projector:** use the browser fullscreen button/F11 and 100% zoom. Prefer a 1366×768 or larger display. Phone/tablet layouts are secondary, not the recommended presentation mode.

**Report does not open:** allow a popup for the local site. Briefing → Open printable briefing opens a plain HTML report. Choose Print → Save as PDF in your browser if needed. No PDF is automatically uploaded anywhere.

**Offline API docs:** `/docs` is a bundled, same-origin API explorer with editable example requests. It has no CDN assets. The schema is at `/openapi.json`, and the supplied `docs/api.md` is a second offline reference.

## Presentation setup

Connect the projector before opening the demo. Run one complete rehearsal, reset to the default mission, close unnecessary tabs, and leave the terminal open. Keep the downloaded source and screenshots as a backup. Demonstrate the synthetic status honestly rather than describing it as a live satellite feed.
