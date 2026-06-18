from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    import imageio.v2 as imageio
except ImportError as exc:  # pragma: no cover - dependency is installed on demand.
    raise SystemExit("Install imageio and imageio-ffmpeg before running this script.") from exc


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "launch-kit" / "LaxHornet-promo-demo.mp4"
THUMB = ROOT / "launch-kit" / "LaxHornet-promo-demo-thumbnail.png"
LOGO = ROOT / "assets" / "laxhornet-logo.png"

WIDTH = 1080
HEIGHT = 1920
FPS = 24
DURATION = 30
TOTAL_FRAMES = FPS * DURATION

RED = "#e81010"
BLACK = "#090909"
RICH_BLACK = "#111111"
DARK_GRAY = "#1b1b1b"
CARD = "#f5f6f7"
TEXT = "#111317"
MUTED = "#555d67"
WHITE = "#ffffff"
LINE = "#d8dadd"

OFFENSE = "#0d7a43"
EFFORT = "#8f1b1b"
DEFENSE = "#1f6f6a"
NEUTRAL = "#3c4652"
NEGATIVE = "#b84a24"
SPECIAL = "#5e5140"

STEPS = [
    ("groundBall", "Ground Ball", "+3 impact", "Wins the loose ball", "One tap captures possession."),
    ("shotOnGoal", "Shot on Goal", "+2 impact", "Dodges and gets a shot on cage", "Track quality chances instantly."),
    ("backedUpShot", "Backed Up Shot", "+2 impact", "Sprints to the endline", "Reward the hustle that saves possession."),
    ("assist", "Assist", "+4 impact", "Finds the open teammate", "Scoring plays update points and impact."),
    ("goal", "Goal", "+5 impact", "Finishes the chance", "Big plays land in the timeline."),
    ("causedTurnover", "Caused Turnover", "+3 impact", "Forces a rushed pass", "Defense gets counted too."),
    ("hustlePlay", "Hustle Play", "+1 impact", "Rides hard through the whistle", "Capture the plays box scores miss."),
]

STAT_BUTTONS = [
    ("goal", "Goal", "+5 impact", OFFENSE),
    ("assist", "Assist", "+4 impact", OFFENSE),
    ("shotOnGoal", "Shot on Goal", "+2 impact", OFFENSE),
    ("shot", "Shot", "+1 impact", NEUTRAL),
    ("backedUpShot", "Backed Up Shot", "+2 impact", EFFORT),
    ("groundBall", "Ground Ball", "+3 impact", EFFORT),
    ("turnover", "Turnover", "-2 impact", NEGATIVE),
    ("hustlePlay", "Hustle Play", "+1 impact", EFFORT),
    ("smartPlay", "Smart Play", "+1 impact", EFFORT),
    ("causedTurnover", "Caused Turnover", "+3 impact", DEFENSE),
    ("defensiveStop", "Defensive Stop", "+3 impact", DEFENSE),
    ("successfulClear", "Successful Clear", "+2 impact", DEFENSE),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


F_HEAVY_74 = font(74, True)
F_HEAVY_58 = font(58, True)
F_HEAVY_46 = font(46, True)
F_HEAVY_38 = font(38, True)
F_HEAVY_32 = font(32, True)
F_HEAVY_28 = font(28, True)
F_HEAVY_24 = font(24, True)
F_HEAVY_21 = font(21, True)
F_HEAVY_18 = font(18, True)
F_BODY_34 = font(34)
F_BODY_28 = font(28)
F_BODY_24 = font(24)
F_BODY_21 = font(21)
F_BODY_18 = font(18)


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def lerp(a: float, b: float, x: float) -> float:
    return a + (b - a) * x


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    current = size
    while current > 14:
        fnt = font(current, bold)
        if draw.textbbox((0, 0), text, font=fnt)[2] <= max_width:
            return fnt
        current -= 2
    return font(current, bold)


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt, fill=WHITE, anchor=None) -> None:
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor)


def draw_round(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_gradient_bg(img: Image.Image) -> None:
    arr = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    top = np.array(hex_to_rgb("#1b1b1b"))
    bottom = np.array(hex_to_rgb("#070707"))
    for y in range(HEIGHT):
        blend = y / (HEIGHT - 1)
        color = (top * (1 - blend) + bottom * blend).astype(np.uint8)
        arr[y, :, :] = color
    overlay = Image.fromarray(arr, "RGB")
    img.paste(overlay)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((650, 70, 1230, 650), fill=(232, 16, 16, 24))


def paste_logo(img: Image.Image, x: int, y: int, width: int) -> None:
    logo = Image.open(LOGO).convert("RGBA")
    ratio = width / logo.width
    size = (width, int(logo.height * ratio))
    logo = logo.resize(size, Image.Resampling.LANCZOS)
    img.alpha_composite(logo, (x, y))


def draw_header(draw: ImageDraw.ImageDraw, img: Image.Image, t: float) -> None:
    paste_logo(img, 58, 48, 390)
    draw_text(draw, (58, 170), "Fast stats for a fast game.", F_HEAVY_46, WHITE)
    draw_text(draw, (58, 226), "Track the game. Share the stats. See the season.", F_BODY_28, "#cfd3d8")
    if 2.5 < t < 26.5:
        draw_round(draw, (790, 64, 1018, 130), 33, (255, 255, 255, 230))
        draw_text(draw, (904, 84), "LIVE DEMO", F_HEAVY_24, RED, anchor="ma")


def draw_field_panel(draw: ImageDraw.ImageDraw, t: float, step_index: int, step_progress: float) -> None:
    x0, y0, x1, y1 = 58, 315, 520, 1412
    draw_round(draw, (x0, y0, x1, y1), 28, "#102817", outline=(255, 255, 255, 38), width=2)
    for i in range(1, 5):
        x = x0 + i * (x1 - x0) / 5
        draw.line((x, y0 + 12, x, y1 - 12), fill=(255, 255, 255, 30), width=2)
    for i in range(1, 7):
        y = y0 + i * (y1 - y0) / 7
        draw.line((x0 + 12, y, x1 - 12, y), fill=(255, 255, 255, 24), width=2)
    draw.ellipse((x0 + 95, y0 + 280, x1 - 95, y1 - 430), outline=(255, 255, 255, 72), width=4)
    draw.arc((x0 + 70, y0 + 60, x1 - 70, y0 + 360), 25, 155, fill=(255, 255, 255, 84), width=5)
    draw.arc((x0 + 70, y1 - 360, x1 - 70, y1 - 60), 205, 335, fill=(255, 255, 255, 84), width=5)

    path = [(160, 1110), (232, 1018), (328, 880), (404, 760), (426, 580), (356, 790), (264, 1030), (190, 1160)]
    total = len(path) - 1
    pos = (step_index + step_progress) / len(STEPS) * total
    idx = min(total - 1, int(pos))
    frac = pos - idx
    px = lerp(path[idx][0], path[idx + 1][0], ease(frac))
    py = lerp(path[idx][1], path[idx + 1][1], ease(frac))
    draw.line([(x0 + a, y0 + b - 315) for a, b in path[: idx + 2]], fill=(232, 16, 16, 130), width=5)
    draw.ellipse((x0 + px - 28, y0 + py - 315 - 28, x0 + px + 28, y0 + py - 315 + 28), fill=(232, 16, 16, 70))
    draw.ellipse((x0 + px - 17, y0 + py - 315 - 17, x0 + px + 17, y0 + py - 315 + 17), fill=RED, outline=WHITE, width=4)

    title = STEPS[step_index][3]
    caption = STEPS[step_index][2]
    draw_round(draw, (84, 1195, 494, 1375), 22, (8, 8, 8, 205), outline=(232, 16, 16, 190), width=3)
    draw_text(draw, (110, 1225), "ON-FIELD MOMENT", F_HEAVY_21, "#d7dadd")
    draw_text(draw, (110, 1260), title, fit_text(draw, title, 350, 34, True), WHITE)
    draw_text(draw, (110, 1315), caption, F_HEAVY_32, WHITE)


def draw_button(draw: ImageDraw.ImageDraw, box, label: str, points: str, accent: str, active: bool) -> None:
    fill = "#202020"
    outline = (255, 255, 255, 24)
    if active:
        fill = "#2a1717"
        outline = (232, 16, 16, 255)
        shadow_box = (box[0] - 5, box[1] - 5, box[2] + 5, box[3] + 5)
        draw_round(draw, shadow_box, 17, (232, 16, 16, 70))
    draw_round(draw, box, 14, fill, outline=outline, width=3 if active else 1)
    draw.rounded_rectangle((box[0], box[1], box[0] + 8, box[3]), radius=4, fill=accent)
    max_width = box[2] - box[0] - 32
    label_font = fit_text(draw, label, max_width, 24, True)
    draw_text(draw, (box[0] + 22, box[1] + 18), label, label_font, WHITE)
    draw_text(draw, (box[0] + 22, box[3] - 31), points, F_BODY_18, "#d8dde2")


def draw_phone_panel(draw: ImageDraw.ImageDraw, step_index: int) -> None:
    x0, y0, x1, y1 = 558, 315, 1022, 1608
    draw_round(draw, (x0, y0, x1, y1), 34, "#050505", outline=(255, 255, 255, 44), width=3)
    draw_round(draw, (x0 + 20, y0 + 20, x1 - 20, y1 - 20), 26, "#121212")
    draw_text(draw, (x0 + 42, y0 + 52), "LaxHornet Live Game", F_HEAVY_24, "#9ca3aa")
    draw_text(draw, (x0 + 42, y0 + 88), "CT Blazers vs Rival", F_HEAVY_32, WHITE)

    tab_x = x0 + 42
    for i, q in enumerate(["Q1", "Q2", "Q3", "Q4"]):
        box = (tab_x + i * 93, y0 + 145, tab_x + i * 93 + 76, y0 + 193)
        draw_round(draw, box, 10, (255, 255, 255, 28 if i == 0 else 14), outline=(255, 255, 255, 42), width=1)
        draw_text(draw, ((box[0] + box[2]) // 2, box[1] + 12), q, F_HEAVY_21, WHITE if i == 0 else "#aeb4ba", anchor="ma")

    metrics = [("20", "Impact"), ("2", "Points"), ("7", "Events")]
    for i, (value, label) in enumerate(metrics):
        bx = x0 + 42 + i * 124
        box = (bx, y0 + 218, bx + 108, y0 + 298)
        draw_round(draw, box, 12, CARD)
        draw_text(draw, (bx + 13, y0 + 232), value, F_HEAVY_32, TEXT)
        draw_text(draw, (bx + 13, y0 + 270), label.upper(), F_HEAVY_18, MUTED)

    draw_text(draw, (x0 + 42, y0 + 334), "OFFENSE", F_HEAVY_18, "#d5d9dd")
    active_key = STEPS[step_index][0]
    grid_x, grid_y = x0 + 42, y0 + 370
    bw, bh, gap = 180, 82, 12
    for idx, (key, label, points, accent) in enumerate(STAT_BUTTONS):
        row, col = divmod(idx, 2)
        box = (grid_x + col * (bw + gap), grid_y + row * (bh + gap), grid_x + col * (bw + gap) + bw, grid_y + row * (bh + gap) + bh)
        draw_button(draw, box, label, points, accent, key == active_key)

    log_y = y0 + 960
    draw_round(draw, (x0 + 42, log_y, x1 - 42, y1 - 56), 18, (245, 246, 247, 240))
    draw_text(draw, (x0 + 66, log_y + 22), "RECENT LOG", F_HEAVY_21, TEXT)
    for idx in range(min(step_index + 1, 4)):
        step = STEPS[step_index - idx]
        y = log_y + 62 + idx * 58
        draw_round(draw, (x0 + 66, y, x1 - 66, y + 44), 10, "#ffffff", outline=(216, 218, 221, 255))
        draw.rectangle((x0 + 66, y, x0 + 72, y + 44), fill=RED)
        draw_text(draw, (x0 + 84, y + 10), step[1], F_HEAVY_18, TEXT)
        draw_text(draw, (x1 - 88, y + 10), step[2].split()[0], F_HEAVY_18, RED)


def draw_action_scene(draw: ImageDraw.ImageDraw, t: float) -> None:
    action_start = 4.0
    step_duration = 2.45
    raw = max(0, t - action_start)
    step_index = min(len(STEPS) - 1, int(raw / step_duration))
    step_progress = (raw % step_duration) / step_duration
    draw_field_panel(draw, t, step_index, step_progress)
    draw_phone_panel(draw, step_index)


def draw_intro(draw: ImageDraw.ImageDraw, img: Image.Image, t: float) -> None:
    opacity = int(255 * ease(min(1, t / 1.2)))
    draw_round(draw, (58, 470, 1022, 1120), 34, (255, 255, 255, 238))
    paste_logo(img, 135, 540, 810)
    draw_text(draw, (540, 755), "Fast stats for a fast game.", F_HEAVY_58, TEXT, anchor="ma")
    draw_text(draw, (540, 835), "A real-time lacrosse stat tracker built for parents on the sideline.", F_BODY_34, MUTED, anchor="ma")
    draw_round(draw, (286, 930, 794, 1014), 42, RED)
    draw_text(draw, (540, 951), "Track every play in one tap", F_HEAVY_32, WHITE, anchor="ma")
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=(0, 0, 0, 255 - opacity))


def draw_dashboard_scene(draw: ImageDraw.ImageDraw, img: Image.Image, t: float) -> None:
    draw_round(draw, (58, 390, 1022, 1320), 32, "#f5f6f7")
    draw_text(draw, (102, 440), "Game Review", F_HEAVY_58, TEXT)
    draw_text(draw, (102, 508), "Impact updates instantly as plays are logged.", F_BODY_30 if False else F_BODY_28, MUTED)
    tiles = [("20", "Game Impact"), ("2", "Points"), ("7", "Events"), ("3", "Effort Plays"), ("1", "Goal"), ("1", "Assist")]
    for idx, (value, label) in enumerate(tiles):
        row, col = divmod(idx, 2)
        bx = 102 + col * 438
        by = 590 + row * 175
        draw_round(draw, (bx, by, bx + 398, by + 135), 18, "#ffffff", outline=(216, 218, 221, 255))
        draw_text(draw, (bx + 28, by + 26), value, F_HEAVY_58, TEXT)
        draw_text(draw, (bx + 28, by + 92), label.upper(), F_HEAVY_24, MUTED)
    draw_round(draw, (170, 1186, 910, 1266), 40, RED)
    draw_text(draw, (540, 1210), "Stats become a season story", F_HEAVY_32, WHITE, anchor="ma")


def draw_end_card(draw: ImageDraw.ImageDraw, img: Image.Image) -> None:
    draw_round(draw, (58, 420, 1022, 1260), 34, (255, 255, 255, 238))
    paste_logo(img, 155, 510, 770)
    draw_text(draw, (540, 735), "Track the game.", F_HEAVY_58, TEXT, anchor="ma")
    draw_text(draw, (540, 808), "Share the stats.", F_HEAVY_58, TEXT, anchor="ma")
    draw_text(draw, (540, 881), "See the season.", F_HEAVY_58, TEXT, anchor="ma")
    draw_text(draw, (540, 1010), "Built for youth lacrosse parents.", F_BODY_34, MUTED, anchor="ma")
    draw_round(draw, (235, 1100, 845, 1180), 40, BLACK)
    draw_text(draw, (540, 1124), "degrasse-mastermind.github.io/LaxHornet", F_HEAVY_24, WHITE, anchor="ma")


def render_frame(i: int) -> Image.Image:
    t = i / FPS
    img = Image.new("RGBA", (WIDTH, HEIGHT), BLACK)
    draw_gradient_bg(img)
    draw = ImageDraw.Draw(img, "RGBA")
    draw_header(draw, img, t)
    if t < 4:
        draw_intro(draw, img, t)
    elif t < 22:
        draw_action_scene(draw, t)
    elif t < 26:
        draw_dashboard_scene(draw, img, t)
    else:
        draw_end_card(draw, img)
    return img.convert("RGB")


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    writer = imageio.get_writer(str(OUT), fps=FPS, codec="libx264", quality=8, macro_block_size=1)
    try:
        for i in range(TOTAL_FRAMES):
            frame = render_frame(i)
            if i == int(FPS * 6):
                frame.save(THUMB)
            writer.append_data(np.asarray(frame))
            if i % FPS == 0:
                print(f"rendered {i // FPS:02d}s / {DURATION}s", flush=True)
    finally:
        writer.close()
    print(f"Wrote {OUT}")
    print(f"Wrote {THUMB}")


if __name__ == "__main__":
    main()
