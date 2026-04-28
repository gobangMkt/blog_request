@echo off
cd /d "%~dp0"
start "" "http://localhost:4321/landing/"
npx serve -p 4321 .
