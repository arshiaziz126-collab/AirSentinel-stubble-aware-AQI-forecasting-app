@echo off
taskkill /FI "WINDOWTITLE eq AirSentinel API*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq AirSentinel Web*" /T /F >nul 2>nul
echo AirSentinel stopped.
