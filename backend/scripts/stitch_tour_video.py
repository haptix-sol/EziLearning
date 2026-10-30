import os
import subprocess
import shutil
import imageio_ffmpeg

def stitch_video():
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    print("Using FFmpeg at:", ffmpeg_exe)

    base_dir = os.path.abspath(os.path.dirname(__file__))
    audio_dir = os.path.join(base_dir, "temp_tour_assets", "audio")
    slides_dir = os.path.join(base_dir, "temp_tour_assets", "slides")
    clips_dir = os.path.join(base_dir, "temp_tour_assets", "clips")
    os.makedirs(clips_dir, exist_ok=True)

    concat_file_path = os.path.join(clips_dir, "concat_list.txt")
    clip_paths = []

    for i in range(1, 11):
        png_path = os.path.join(slides_dir, f"slide_{i}.png")
        mp3_path = os.path.join(audio_dir, f"slide_{i}.mp3")
        clip_path = os.path.join(clips_dir, f"clip_{i}.mp4")

        print(f"Encoding Slide {i} clip...")
        cmd = [
            ffmpeg_exe,
            "-y",
            "-loop", "1",
            "-i", png_path,
            "-i", mp3_path,
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#fdfbf9",
            "-shortest",
            clip_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode != 0:
            print(f"Error encoding slide {i}:", res.stderr.decode('utf-8', errors='ignore'))
            raise RuntimeError(f"FFmpeg failed on slide {i}")
        clip_paths.append(clip_path)

    # Write concat list
    with open(concat_file_path, "w", encoding="utf-8") as f:
        for p in clip_paths:
            # Format path with forward slashes for ffmpeg concat
            formatted = p.replace("\\", "/")
            f.write(f"file '{formatted}'\n")

    output_root_mp4 = os.path.abspath(os.path.join(base_dir, "../../EziLearning_Platform_Tour_and_Pitch.mp4"))
    public_videos_dir = os.path.abspath(os.path.join(base_dir, "../../frontend/public/videos"))
    os.makedirs(public_videos_dir, exist_ok=True)
    output_public_mp4 = os.path.join(public_videos_dir, "EziLearning_Platform_Tour_and_Pitch.mp4")

    print("Concatenating all clips into final 1080p tour video:", output_root_mp4)
    concat_cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file_path,
        "-c", "copy",
        output_root_mp4
    ]
    res = subprocess.run(concat_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        print("Concat error:", res.stderr.decode('utf-8', errors='ignore'))
        raise RuntimeError("Concat failed")

    # Copy to frontend public videos
    shutil.copyfile(output_root_mp4, output_public_mp4)
    print("Copied video to:", output_public_mp4)
    print("Tour video build complete! Size:", os.path.getsize(output_root_mp4), "bytes")

if __name__ == "__main__":
    stitch_video()
