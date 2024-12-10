#!/bin/bash

# This script setup basic tools for running zx scripts
# 1. Installl nodejs and npm(using volta)
# 2. Install zx and tsx using npm

# Function to install Node.js and npm using apt (Debian/Ubuntu)
install_node_npm() {
	curl https://get.volta.sh | bash
	source ~/.bashrc
	volta install node
	npm_install_packages
}

npm_install_packages() {
	echo "Installing npm packages..."
	npm install -g tsx
	npm install ..
}

echo "Installing Node.js and npm..."
install_node_npm

echo "installing npm packages..."
npm_install_packages

echo "installing build environment..."
tsx setupTools.mts
