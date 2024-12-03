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
  installPackage = async function (packageList: string[]) {
    switch (this.packageManager) {
      case 'choco':
        await this._chocoInstallPackage(packageList)
        break
      case 'apt':
        await this._aptInstallPackage(packageList)
        break
      case 'pacman':
        await this._pacmanInstallPackage(packageList)
        break
      case 'yum':
        await this._yumInstallPackage(packageList)
        break
      case 'brew':
        await this._brewInstallPackage(packageList)
        break
      case 'pip':
        await this._pipInstallPackage(packageList)
        break
    }
  }

  detectSystemPackageManager = async function () {
    if (process.platform === 'win32') {
      this.packageManager = 'choco'
    } else if (process.platform === 'linux') {
      try {
        await $`command -v apt-get`
        this.packageManager = "apt"
      } catch { }
      try {
        await $`command -v yum`
        this.packageManager = "yum"
      } catch { }
      try {
        await $`command -v pacman`
        this.packageManager = "pacman"
      } catch {
        console.error("Unknown package manager")
        process.exit(1)
      }
    } else if (process.platform === 'darwin') {
      this.packageManager = "brew"
    } else {
      console.error("Unknown platform")
      process.exit(1)
    }
  }

  _chocoInstallPackage = async function (packageList: string[]) {
    await $`choco install -y ${packageList.concat(' ')}`
  }
  _aptInstallPackage = async function (packageList: string[]) {
    await $`sudo apt-get update`
    await $`sudo apt-get -y install ${packageList.concat(' ')}`
  }
  _pacmanInstallPackage = async function (packageList: string[]) {
    await $`sudo pacman -Syu`
    await $`sudo pacman -S ${packageList.concat(' ')}`
  }
  _yumInstallPackage = async function (packageList: string[]) {
    await $`sudo yum update`
    await $`sudo yum install -y ${packageList.concat(' ')}`
  }
  _brewInstallPackage = async function (packageList: string[]) {
    await $`brew update`
    await $`brew install ${packageList.concat(' ')}`
  }
  _pipInstallPackage = async function (packageList: string[]) {
    await $`pip install -g ${packageList.concat(' ')}`
  }
}


async function main() {
  const packageManager = new PackageManager()
  await packageManager.detectSystemPackageManager()
  console.log(`Detected package manager: ${packageManager.packageManager}`)
  switch (packageManager.packageManager) {
    case 'apt':
      packageManager.installPackage(['build-essential', 'cmake', 'conan'])
      break
    case 'yum':
      packageManager.installPackage(['gcc-c++', 'cmake', 'conan'])
      break
    case 'pacman':
      packageManager.installPackage(['base-devel', 'cmake', 'conan'])
      break
    case 'brew':
      packageManager.installPackage(['cmake', 'conan'])
      break
    case 'choco':
      packageManager.installPackage(['vcredist140', 'cmake', 'conan'])
      break
    default:
      console.error("Install failed")
      break
  }

  const configModifier = new ConfigModifier()
  configModifier.setupConan()
}

main()
