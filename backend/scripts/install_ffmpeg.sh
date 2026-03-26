#!/bin/bash
# Install FFmpeg (required for Varin / ManimGL video merging)
# Run: ./scripts/install_ffmpeg.sh

echo "Installing FFmpeg..."

if command -v brew &> /dev/null; then
    brew install ffmpeg
    echo "FFmpeg installed via Homebrew."
elif command -v apt-get &> /dev/null; then
    sudo apt-get update && sudo apt-get install -y ffmpeg
    echo "FFmpeg installed via apt."
else
    echo "Install FFmpeg manually: https://ffmpeg.org/download.html"
fi
