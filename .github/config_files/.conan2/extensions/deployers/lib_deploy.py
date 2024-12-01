import filecmp
import os
import re
import shutil

from conan.api.output import ConanOutput
from conan.errors import ConanException
from conan.internal.cache.home_paths import HomePaths
from conan.internal.errors import conanfile_exception_formatter
from conans.client.loader import load_python_file
from conans.util.files import mkdir, rmdir


def deploy(graph, output_folder):
    """
    Deploy all the shared libraries and the executables of the dependencies in a flat directory.
    """
    conanfile = graph.root.conanfile
    output = ConanOutput(scope="lib_deploy")
    output.info(f"Deploying dependencies runtime to folder: {output_folder}")
    output.warning(
        "This deployer is experimental and subject to change. "
        "Please give feedback at https://github.com/conan-io/conan/issues"
    )
    mkdir(output_folder)
    for req, dep in conanfile.dependencies.host.items():
        if not req.run:  # Avoid deploying unused binaries at runtime
            continue
        if dep.package_folder is None:
            output.warning(
                f"{dep.ref} does not have any package folder, skipping binary"
            )
            continue
        count = 0
        cpp_info = dep.cpp_info.aggregated_components()

        for libdir in cpp_info.libdirs:
            if not os.path.isdir(libdir):
                output.warning(f"{dep.ref} {libdir} does not exist")
                continue
            count += _flatten_directory(
                dep,
                libdir,
                output_folder,
                symlinks=False,
                pattern_filter=[r"\.so(\.\d+)*$", r".dylib", r".dll"],
            )

        output.info(f"Copied {count} files from {dep.ref}")
    conanfile.output.success(f"Runtime deployed to folder: {output_folder}")


def _flatten_directory(dep, src_dir, output_dir, symlinks, pattern_filter=None):
    """
    Copy all the files from the source directory in a flat output directory.
    An optional string, named extension_filter, can be set to copy only the files with
    the listed extensions.
    """
    file_count = 0

    output = ConanOutput(scope="lib_deploy")
    for src_dirpath, _, src_filenames in os.walk(src_dir, followlinks=symlinks):
        for src_filename in src_filenames:
            if pattern_filter and not any(
                re.search(pattern, src_filename) for pattern in pattern_filter
            ):
                continue

            src_filepath = os.path.join(src_dirpath, src_filename)
            dest_filepath = os.path.join(output_dir, src_filename)
            if os.path.exists(dest_filepath):
                if filecmp.cmp(
                    src_filepath, dest_filepath
                ):  # Be efficient, do not copy
                    output.verbose(
                        f"{dest_filepath} exists with same contents, skipping copy"
                    )
                    continue
                else:
                    output.warning(f"{dest_filepath} exists and will be overwritten")

            try:
                file_count += 1
                shutil.copy2(src_filepath, dest_filepath, follow_symlinks=symlinks)
                output.verbose(f"Copied {src_filepath} into {output_dir}")
            except Exception as e:
                if "WinError 1314" in str(e):
                    ConanOutput().error(
                        "runtime_deploy: Windows symlinks require admin privileges "
                        "or 'Developer mode = ON'",
                        error_type="exception",
                    )
                raise ConanException(
                    f"runtime_deploy: Copy of '{dep}' files failed: {e}.\nYou can "
                    f"use 'tools.deployer:symlinks' conf to disable symlinks"
                )
    return file_count
