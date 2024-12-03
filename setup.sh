#!/bin/bash

# This script setup basic tools for running zx scripts
# 1. Installl nodejs and npm
# 2. Install zx and tsx using npm

# Function to install zx using npm
install_using_npm() {
	echo "Installing npm packages..."
	npm install -g tsx
	npm install zx
}

# Function to install Node.js and npm using apt (Debian/Ubuntu)
install_node_apt() {
	echo "Installing Node.js and npm using apt..."
	sudo apt update
	sudo apt install -y nodejs npm
	install_using_npm
}

# Function to install Node.js and npm using yum (CentOS/RHEL)
install_node_yum() {
	echo "Installing Node.js and npm using yum..."
	sudo yum install -y epel-release
	sudo yum install -y nodejs npm
	install_using_npm
}

# Arch
install_node_pacman() {
	echo "Installing Node.js and npm using pacman..."
	sudo pacman -S nodejs npm
	install_using_npm
}

# Function to install Node.js and npm using dnf (Fedora)
install_node_dnf() {
	echo "Installing Node.js and npm using dnf..."
	sudo dnf install -y nodejs npm
	install_using_npm
}

# Function to install Node.js and npm using brew (macOS)
install_node_brew() {
	echo "Installing Node.js and npm using brew..."
	brew install node
	install_using_npm
}

# Detect platform and package manager
if [ "$(uname)" == "Darwin" ]; then
	# macOS
	if command -v brew >/dev/null 2>&1; then
		install_node_brew
	else
		echo "Homebrew is not installed. Please install Homebrew first."
		exit 1
	fi
elif [ "$(uname)" == "Linux" ]; then
	# Linux
	if command -v apt >/dev/null 2>&1; then
		install_node_apt
	elif command -v yum >/dev/null 2>&1; then
		install_node_yum
	elif command -v pacman >/dev/null 2>&1; then
		install_node_pacman
	elif command -v dnf >/dev/null 2>&1; then
		install_node_dnf
	else
		echo "Unsupported package manager. Please install Node.js and npm manually."
		exit 1
	fi
else
	echo "Unsupported platform. Please install Node.js and npm manually."
	exit 1
fi

echo "zx installation completed."
