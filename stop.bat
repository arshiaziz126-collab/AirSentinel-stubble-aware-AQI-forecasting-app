@echo off
taskkill /FI "WINDOWTITLE eq PyroAQ API*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq PyroAQ Web*" /T /F >nul 2>nul
echo PyroAQ stopped.
