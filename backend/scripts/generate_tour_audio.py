import asyncio
import os
import subprocess
import imageio_ffmpeg
import edge_tts

VOICE = "en-US-ChristopherNeural"  # Professional, articulate, warm narrative voice

SLIDES = [
    {
        "id": 1,
        "text": (
            "Welcome to EziLearning. I'm Owlbert, your AI mentor. "
            "EziLearning is reimagining engineering education for the AI era. "
            "We unify academic theory, custom video generation, live coding, and 24/7 WhatsApp mentoring into one seamless notebook workspace."
        )
    },
    {
        "id": 2,
        "text": (
            "Today, higher education faces a fragmented learning crisis. "
            "Traditional LMS platforms like Canvas and Moodle are static lecture archives that only test passive recall. "
            "Students juggle up to six disconnected platforms, and over 84% of engineering graduates lack day-one coding readiness."
        )
    },
    {
        "id": 3,
        "text": (
            "Meet EziLearning, the all-in-one tactile notebook. "
            "From day one of college to day one on the job, we connect every stage: "
            "adaptive skill roadmaps, AI-synthesized videos, hands-on coding sandboxes, and continuous streak compounding."
        )
    },
    {
        "id": 4,
        "text": (
            "Our first breakthrough is the Varin Video Engine. "
            "When a student struggles with an algorithm, the system detects the exact misconception and synthesizes a targeted 90-second animated explainer. "
            "Seen here at 1 minute 58 seconds, our Dijkstra relaxation visualizer delivers over three times higher retention than passive lectures."
        )
    },
    {
        "id": 5,
        "text": (
            "To build unstoppable daily momentum, we bring mentoring directly to WhatsApp, where students already spend their time. "
            "Every morning at 8:30 AM, I send a 60-second micro-challenge. "
            "Students can snap photos of compiler bugs or send voice notes late at night for instant Socratic guidance."
        )
    },
    {
        "id": 6,
        "text": (
            "In our zero-friction in-browser coding arena, students execute Python, C++, Java, and TypeScript with live test cases and memory benchmarks. "
            "Every project checkpoint generates verified proof of authorship for recruiters."
        )
    },
    {
        "id": 7,
        "text": (
            "We replace arbitrary course completion bars with our holistic 5-factor Readiness Index, "
            "evaluating algorithmic mastery, project commits, WhatsApp streak consistency, and AI mock interview communication."
        )
    },
    {
        "id": 8,
        "text": (
            "This unlocks a $34 billion global market across more than 4,200 accredited engineering colleges facing strict placement mandates. "
            "Generative AI makes bespoke tutoring scalable at near-zero marginal cost per student."
        )
    },
    {
        "id": 9,
        "text": (
            "Our high-margin B2B2C business model combines institutional campus enterprise agreements, student pro passes, and recruiter placement fees, "
            "delivering over 120% net revenue retention."
        )
    },
    {
        "id": 10,
        "text": (
            "With our interactive prototype live, Varin video engine proven, and WhatsApp bot active, "
            "we are expanding to 50 flagship engineering institutions. "
            "Join us at EziLearning as we build real engineering momentum."
        )
    }
]

async def generate_all_audio(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    audio_paths = []
    for item in SLIDES:
        out_path = os.path.join(output_dir, f"slide_{item['id']}.mp3")
        print(f"Generating audio for Slide {item['id']}...")
        communicate = edge_tts.Communicate(item["text"], VOICE)
        await communicate.save(out_path)
        audio_paths.append(out_path)
    print("All audio files generated successfully.")
    return audio_paths

if __name__ == "__main__":
    audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "temp_tour_assets/audio"))
    asyncio.run(generate_all_audio(audio_dir))
