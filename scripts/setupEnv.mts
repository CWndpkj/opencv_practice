/// This script sets up the environment for the project
/// It did the following things:
/// 1. install build essentials and package manager(we use conan here)
/// 2. configure conan's profile and global configuration

import 'zx/globals'
import { quotePowerShell } from 'zx'

if (process.platform === 'win32') {
  $.quote = quotePowerShell
}

class ConfigModifier {
  setupConan = async function () {
    await $`conan profile detect --force 1>&2`
    if (process.platform === 'win32') {
      await $`Copy-Item -Recurse -Force ..\.github\config_files\.conan2\* $env:USERPROFILE\.conan2`
      console.log("=========conan global config=========")
      await $`cat $env:USERPROFILE/.conan2/global.conf 1>&2`
    }
    else {
      await $`cp -rf ../.github/config_files/.conan2/* ~/.conan2`
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
        await this._chocoInstallPackage(['vcredist140', 'cmake', 'conan'])
        break
      case 'apt':
        await this._aptInstallPackage(['build-essential', 'cmake'])
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
    await $`curl https://pyenv.run | bash &&echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc &&echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc&&echo 'eval "$(pyenv init -)"' >> ~/.bashrc && source ~/.bashrc &&pyenv install 3 && pyenv global 3 &&curl -s https://bootstrap.pypa.io/get-pip.py | python`
  }

  installConan = async function () {
    await this._pipInstallPackage('conan')
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
    await $`choco install -y ${packageList.join(' ')} 1>&2`
  }
  _aptInstallPackage = async function (packageList: string[]) {
    await $`sudo apt-get update 1>&2`
    for (const pkg of packageList) {
      await $`sudo apt-get -y install ${pkg} 1>&2`
    }
  }
  _pacmanInstallPackage = async function (packageList: string[]) {
    await $`sudo pacman -Syu 1>&2`
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
      await $`pip install -g ${pkg} 1>&2`
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
