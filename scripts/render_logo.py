#!/usr/bin/env python3
"""Render the Chatrico bot logo (favicon.svg) to PNG with no external deps.

The SVG is an indigo (#6366f1) rounded square (64x64, rx=14) with a white
lucide "Bot" icon drawn via translate(14,15) scale(1.5), stroke-width 2.
We rasterize it with anti-aliasing (4x4 supersampling) and write a PNG using
only the standard library (zlib + struct).
"""
import math
import struct
import zlib

# ---- geometry in the 64x64 SVG coordinate space ----
RR = (0, 0, 64, 64, 14)          # background rounded rect: x0,y0,x1,y1,radius
INDIGO = (99, 102, 241)          # #6366f1
WHITE = (255, 255, 255)
STROKE_R = 1.5                   # stroke-width 2 * scale 1.5 / 2

# White stroked segments (round caps), endpoints already transformed:
SEGMENTS = [
    (32, 27, 32, 21),    # antenna vertical
    (32, 21, 26, 21),    # antenna horizontal
    (17, 36, 20, 36),    # left arm
    (44, 36, 47, 36),    # right arm
    (36.5, 34.5, 36.5, 37.5),  # right eye
    (27.5, 34.5, 27.5, 37.5),  # left eye
]
# White stroked rounded-rect head outline: x0,y0,x1,y1,radius
HEAD = (20, 27, 44, 45, 3)


def rrect_sdf(px, py, x0, y0, x1, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx = (x1 - x0) / 2 - r
    hy = (y1 - y0) / 2 - r
    dx = abs(px - cx) - hx
    dy = abs(py - cy) - hy
    outside = math.hypot(max(dx, 0), max(dy, 0))
    inside = min(max(dx, dy), 0)
    return outside + inside - r


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / L2
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def sample(px, py):
    """Return RGBA tuple for a point in 64-space (one sub-sample)."""
    # white icon?
    for (ax, ay, bx, by) in SEGMENTS:
        if seg_dist(px, py, ax, ay, bx, by) <= STROKE_R:
            return WHITE + (255,)
    if abs(rrect_sdf(px, py, *HEAD)) <= STROKE_R:
        return WHITE + (255,)
    # background rounded square?
    if rrect_sdf(px, py, *RR) <= 0:
        return INDIGO + (255,)
    return (0, 0, 0, 0)


def render(size):
    ss = 4  # 4x4 supersampling
    scale = 64.0 / size
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    u = (x + (sx + 0.5) / ss) * scale
                    v = (y + (sy + 0.5) / ss) * scale
                    cr, cg, cb, ca = sample(u, v)
                    r += cr * ca
                    g += cg * ca
                    b += cb * ca
                    a += ca
            n = ss * ss
            if a > 0:
                row += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size):
    raw = bytearray()
    for r in rows:
        raw += b"\x00" + r  # filter type 0
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, size, "x", size, len(png), "bytes")


if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(__file__), "..", "client", "public")
    out = os.path.abspath(out)
    for sz in (1024, 512, 256, 64):
        write_png(os.path.join(out, f"logo-{sz}.png"), render(sz), sz)
