"""
ManimGL reference scenes for Varin golden-frame workflow.
Pinned stack: manimgl 1.7.x (see backend/manim/pyproject.toml).

Run from backend/manim:
  uv run manimgl scenes/golden_reference/golden_scenes.py GoldenStaticSquare -s
"""
from manimlib import *


class GoldenStaticSquare(Scene):
    def construct(self):
        sq = Square(side_length=2)
        sq.set_color(BLUE)
        self.add(sq)


class GoldenFadeInSquare(Scene):
    def construct(self):
        sq = Square(side_length=2)
        sq.set_color(GREEN)
        self.play(FadeIn(sq))
        self.wait(0.2)


class GoldenTransformSquareToCircle(Scene):
    def construct(self):
        a = Square(side_length=2)
        a.set_color(RED)
        b = Circle(radius=1.2)
        b.set_color(YELLOW)
        self.add(a)
        self.play(Transform(a, b))
        self.wait(0.2)


class GoldenMovingSquare(Scene):
    def construct(self):
        sq = Square(side_length=1)
        sq.set_color(PURPLE)
        sq.shift(LEFT * 3)
        self.add(sq)
        self.play(sq.animate.shift(RIGHT * 6), run_time=1.5)
        self.wait(0.1)
