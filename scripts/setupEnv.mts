/// This script sets up the environment for the project
/// It did the following things:
/// 1. install build essentials and package manager(we use conan here)
/// 2. configure conan's profile and global configuration

import 'zx/globals'
import { quotePowerShell } from 'zx'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export const MSVCInstallDir = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools'

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
  paltform: string
  constructor() {
    this.paltform = process.platform
  }
  mod = async function () {
    if (this.paltform === 'linux') {
      await this.unixMod()
    } else if (this.paltform === 'win32') {
      await this.windowsMod()
    } else {
      console.error("Unsupported platform")
      process.exit
    }
  }
  private unixMod = async function () {
    await this.modConan()
  }
  private windowsMod = async function () {
    await this.modPowerShell()
  }
  // For linux to use System package manager to install packages
  private modConan = async function () {
    const conanHome = `${process.env.HOME}/.conan2`
    await $`source ~/.bashrc && conan profile detect --force`.pipe(process.stderr)
    const content = fs.readFileSync(`${conanHome}/global.conf`, 'utf8')
    if (content.includes("tools.system.package_manager:mode")) {
      console.log("conan global config already configured")
      return
    } else {
      fs.appendFileSync(`${conanHome}/global.conf`, `
tools.system.package_manager:mode = install
tools.system.package_manager:sudo = True
tools.build:skip_test = True`)
    }
    console.log("=========conan global config=========")
    console.log(fs.readFileSync(`${conanHome}/global.conf`, 'utf8'))
  }

  // For windows to use PowerShell to invoke .bat script with environment variables saved
  private modPowerShell = async function () {
    const powerShellProfile = (await $`echo $PROFILE`).toString()
    if (powerShellProfile) {
      const content = await fs.readFile(powerShellProfile, 'utf8')
      if (content.includes("Invoke-CmdScript")) {
        console.log("PowerShell profile already configured")
        return
      } else {
        await fs.appendFile(powerShellProfile, `
function
  Invoke-CmdScript {
    param(
      [String] $scriptName
    )
    $cmdLine = """$scriptName"" $args & set"
    & $Env:SystemRoot\system32\cmd.exe /c $cmdLine |
    select-string '^([^=]*)=(.*)$' | foreach-object {
      $varName = $_.Matches[0].Groups[1].Value
      $varValue = $_.Matches[0].Groups[2].Value
      set-item Env:$varName $varValue
    }
}`)
        console.log("PowerShell profile configured")
      }
    } else {
      console.error("PowerShell profile not found")
      process.exit
    }
  }
}

// class setupCpp {
//   async run() {
//     // WARN: Need to source ~/.cpprc # activate cpp environment variables
//     if (process.platform === 'win32') {
//       await $`npx setup-cpp --compiler msvc-2022 --vcvarsall true --cmake true --conan true --ninja true --ccache true`.pipe(process.stderr)
//     }
//     else if (process.platform === 'linux') {
//       await $`sudo npx setup-cpp --compiler gcc --cmake true --conan true --ninja true --ccache true`.pipe(process.stderr)
//     }
//   }
// }

class PackageManager {
  packageManager: string
  constructor() {
    this.packageManager = ''
  }
  installToolchain = async function () {
    switch (this.packageManager) {
      case 'choco':
        await this._chocoInstallPackage(['ninja', 'cmake'])
        // FIXME: Doesn't work
        // await this._chocoInstallPackageWithArgs(['visualstudio2022buildtools'], [`--package-parameters "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --remove Microsoft.VisualStudio.Component.VC.CMake.Project --path install=${MSVCInstallDir}"`])
        await $`choco install -y visualstudio2022buildtools --package-parameters "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --remove Microsoft.VisualStudio.Component.VC.CMake.Project --path install=${MSVCInstallDir}"`
          .pipe(process.stderr)
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
      await $`curl https://pyenv.run | bash`.pipe(process.stderr)
      await $`echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc && 
            echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc && 
            echo 'eval "$(pyenv init -)"' >> ~/.bashrc`.pipe(process.stderr)
      await $`source ~/.bashrc &&
            pyenv install -s 3 && 
            pyenv global 3 &&
            curl -s https://bootstrap.pypa.io/get-pip.py | python`.pipe(process.stderr)
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
      await $`choco install -y ${pkg}`.pipe(process.stderr)
    }
  }

  _chocoInstallPackageWithArgs = async function (packageList: string[], argsList: string[]) {
    for (let i = 0; i < packageList.length; i++) {
      const pkgWithArgs = `${packageList[i]} ${argsList[i]}`
      await $`choco install -y ${pkgWithArgs}`.pipe(process.stderr)
    }
  }

  _aptInstallPackage = async function (packageList: string[]) {
    await $`sudo apt-get update`.pipe(process.stderr)
    for (const pkg of packageList) {
      await $`sudo apt-get -y install ${pkg}`.pipe(process.stderr)
    }
  }
  _pacmanInstallPackage = async function (packageList: string[]) {
    await $`sudo pacman -Syyu`.pipe(process.stderr)
    for (const pkg of packageList) {
      await $`sudo pacman -S ${pkg}`.pipe(process.stderr)
    }
  }
  _yumInstallPackage = async function (packageList: string[]) {
    await $`sudo yum update`.pipe(process.stderr)
    for (const pkg of packageList) {
      await $`sudo yum install -y ${pkg}`.pipe(process.stderr)
    }
  }
  _brewInstallPackage = async function (packageList: string[]) {
    await $`brew update`.pipe(process.stderr)
    for (const pkg of packageList) {
      await $`brew install ${pkg}`.pipe(process.stderr)
    }
  }
  _pipInstallPackage = async function (packageList: string[]) {
    for (const pkg of packageList) {
      await $`source ~/.bashrc && pip install ${pkg}`.pipe(process.stderr)
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
  await configModifier.mod()
}

main()
