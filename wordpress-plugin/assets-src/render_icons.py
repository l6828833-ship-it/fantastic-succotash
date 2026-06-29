#!/usr/bin/env python3
"""Render the Chatrico plugin icon (the bot logo) to the sizes WordPress.org
wants, with no external dependencies. Outputs into ../assets/.

WordPress.org plugin directory assets live in the SVN /assets folder (NOT in
the installable zip): icon-128x128.png, icon-256x256.png, plus banners.
"""
import math
import os
import struct
import zlib

RR = (0, 0, 64, 64, 14)
INDIGO = (99, 102, 241)
WHITE = (255, 255, 255)
STROKE_R = 1.5
SEGMENTS = [
    (32, 27, 32, 21), (32, 21, 26, 21), (17, 36, 20, 36),
    (44, 36, 47, 36), (36.5, 34.5, 36.5, 37.5), (27.5, 34.5, 27.5, 37.5),
]
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
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def sample(px, py):
    for (ax, ay, bx, by) in SEGMENTS:
        if seg_dist(px, py, ax, ay, bx, by) <= STROKE_R:
            return WHITE + (255,)
    if abs(rrect_sdf(px, py, *HEAD)) <= STROKE_R:
        return WHITE + (255,)
    if rrect_sdf(px, py, *RR) <= 0:
        return INDIGO + (255,)
    return (0, 0, 0, 0)


def render(size):
    ss = 4
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
                    r += cr * ca; g += cg * ca; b += cb * ca; a += ca
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
        raw += b"\x00" + r
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, f"{size}x{size}")


if __name__ == "__main__":
    out = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
    os.makedirs(out, exist_ok=True)
    write_png(os.path.join(out, "icon-128x128.png"), render(128), 128)
    write_png(os.path.join(out, "icon-256x256.png"), render(256), 256)
