/// This script sets up the environment for the project
/// It did the following things:
/// 1. install build essentials and package manager(we use conan here)
/// 2. configure conan's profile and global configuration

import 'zx/globals'
import { quotePowerShell } from 'zx'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.platform === 'win32') {
  $.quote = quotePowerShell
  $.shell = 'powershell'
}

if (process.platform != 'win32') {
  $.prefix = "set -eo pipefail;"
}

class ConfigModifier {
  setupConan = async function () {
    if (process.platform === 'win32') {
      await $`$Env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") ;
          conan profile detect --force 2>&1`
      await $`Copy-Item -Recurse -Force ${__dirname}/../.github/config_files/.conan2/* $env:USERPROFILE/.conan2`
      console.log("=========conan global config=========")
      await $`type $env:USERPROFILE/.conan2/global.conf 1>&2`
    }
    else {
      await $`conan profile detect --force 1>&2`
      await $`cp -rf ${__dirname}/../.github/config_files/.conan2/* ~/.conan2`
      console.log("=========conan global config=========")
      await $`cat ~/.conan2/global.conf 1>&2`
    }
  }
}

class PackageManager {
  packageManager: string
  constructor() {
    this.packageManager = ''
  }
  installToolchain = async function () {
    switch (this.packageManager) {
      case 'choco':
        await this._chocoInstallPackage(['visualstudio2022buildtools', 'cmake'])
        break
      case 'apt':
        await this._aptInstallPackage(['build-essential', 'cmake', 'zlib1g-dev', 'libffi-dev', 'libssl-dev', 'libbz2-dev', 'libreadline-dev', 'libsqlite3-dev',
          'liblzma-dev', 'libncurses-dev', 'tk-dev'])
        break
      case 'pacman':
        await this._pacmanInstallPackage(['base-devel', 'cmake'])
        break
      case 'yum':
        await this._yumInstallPackage(['gcc-c++', 'cmake'])
        break
      case 'brew':
        await this._brewInstallPackage(['gcc', 'g++', 'cmake'])
        break
      default:
        console.error("Unknown package manager")
        process.exit(1)
    }
  }

  installConfigPy = async function () {
    if (process.platform === 'win32')
      await this._chocoInstallPackage(['python'])
    else {
      const home = process.env.HOME
      if (fs.existsSync(`${home}/.pyenv`)) {
        console.log("pyenv already installed")
        return
      }
      await $`curl https://pyenv.run | bash`
      await $`echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc && 
            echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc && 
            echo 'eval "$(pyenv init -)"' >> ~/.bashrc`
      await $`source ~/.bashrc &&
            pyenv install -s 3 && 
            pyenv global 3 &&
            curl -s https://bootstrap.pypa.io/get-pip.py | python`
    }
  }

  installConan = async function () {
    if (process.platform === 'win32')
      await this._chocoInstallPackage(['conan'])
    else
      await this._pipInstallPackage(['conan'])
  }

  detectSystemPackageManager = async function () {
    if (process.platform === 'win32') {
      this.packageManager = 'choco'
    } else if (process.platform === 'linux') {
      try {
        await $`command -v apt-get`
        this.packageManager = "apt"
      } catch {
        try {
          await $`command -v yum`
          this.packageManager = "yum"
        } catch {
          try {
            await $`command -v pacman`
            this.packageManager = "pacman"
          } catch {
            console.error("Unknown package manager")
            process.exit(1)
          }
        }
      }
    } else if (process.platform === 'darwin') {
      this.packageManager = "brew"
    } else {
      console.error("Unknown platform")
      process.exit(1)
    }
  }

  _chocoInstallPackage = async function (packageList: string[]) {
    for (const pkg of packageList) {
      await $`choco install -y ${pkg} 2>&1`
    }
  }
  _aptInstallPackage = async function (packageList: string[]) {
    await $`sudo apt-get update 1>&2`
    for (const pkg of packageList) {
      await $`sudo apt-get -y install ${pkg} 1>&2`
    }
  }
  _pacmanInstallPackage = async function (packageList: string[]) {
    await $`sudo pacman -Syyu 1>&2`
    for (const pkg of packageList) {
      await $`sudo pacman -S ${pkg} 1>&2`
    }
  }
  _yumInstallPackage = async function (packageList: string[]) {
    await $`sudo yum update 1>&2`
    for (const pkg of packageList) {
      await $`sudo yum install -y ${pkg} 1>&2`
    }
  }
  _brewInstallPackage = async function (packageList: string[]) {
    await $`brew update 1>&2`
    for (const pkg of packageList) {
      await $`brew install ${pkg} 1>&2`
    }
  }
  _pipInstallPackage = async function (packageList: string[]) {
    for (const pkg of packageList) {
      await $`source ~/.bashrc && pip install ${pkg} 1>&2`
    }
  }
}

async function main() {
  const packageManager = new PackageManager()
  await packageManager.detectSystemPackageManager()
  console.log(`Detected package manager: ${packageManager.packageManager}`)
  await packageManager.installToolchain()
  await packageManager.installConfigPy()
  await packageManager.installConan()

  const configModifier = new ConfigModifier()
  await configModifier.setupConan()
}

main()
