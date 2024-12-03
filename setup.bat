@echo off

@powershell -NoProfile -Command "Set-ExecutionPolicy RemoteSigned"

:: Install Chocolatey if not already installed
@powershell -NoProfile -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"

:: Reload the PATH environment variable
SET $Env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")  

:: Install Node.js using Chocolatey
choco install nodejs-lts -y

:: Reload the PATH environment variable
SET $Env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

:: Install tsx globally using npm
call npm install -g tsx

:: Install zx using npm
call npm install zx
