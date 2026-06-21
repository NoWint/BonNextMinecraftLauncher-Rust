#!/usr/bin/env python3
"""Downsample a 3DGS .ply file by randomly selecting a subset of gaussians."""
import struct, random, os

src = '/Users/xiatian/Desktop/BonNext/public/scene_clean.ply'
dst = '/Users/xiatian/Desktop/BonNext/public/scene_small.ply'
TARGET_COUNT = 200_000  # 200K gaussians (1/6 of original)

with open(src, 'rb') as f:
    # Read header
    header = b''
    while True:
        line = f.readline()
        header += line
        if line.strip() == b'end_header':
            break

    header_str = header.decode('ascii')

    # Parse vertex count and properties
    vertex_count = 0
    vertex_props = []
    in_vertex = False
    for line in header_str.strip().split('\n'):
        if line.startswith('element vertex'):
            vertex_count = int(line.split()[-1])
            in_vertex = True
        elif line.startswith('element '):
            in_vertex = False
        elif line.startswith('property') and in_vertex:
            vertex_props.append(line)

    # Calculate bytes per vertex
    bytes_per_vertex = 0
    for prop in vertex_props:
        ptype = prop.split()[1]
        if ptype == 'float':
            bytes_per_vertex += 4
        elif ptype == 'uchar':
            bytes_per_vertex += 1
        elif ptype in ('uint', 'int'):
            bytes_per_vertex += 4

    print(f"Original: {vertex_count} vertices, {bytes_per_vertex} bytes each, {vertex_count * bytes_per_vertex / 1024 / 1024:.1f} MB total")

    # Read all vertex data
    all_data = f.read(vertex_count * bytes_per_vertex)
    print(f"Read {len(all_data)} bytes")

    # Random sample
    target = min(TARGET_COUNT, vertex_count)
    indices = sorted(random.sample(range(vertex_count), target))
    print(f"Sampling {target} vertices ({target / vertex_count * 100:.1f}%)")

    # Write downsampled PLY
    clean_header = f"ply\nformat binary_little_endian 1.0\nelement vertex {target}\n"
    for prop in vertex_props:
        clean_header += prop + "\n"
    clean_header += "end_header\n"

    with open(dst, 'wb') as out:
        out.write(clean_header.encode('ascii'))
        for idx in indices:
            start = idx * bytes_per_vertex
            out.write(all_data[start:start + bytes_per_vertex])

    final_size = os.path.getsize(dst)
    print(f"Output: {target} vertices, {final_size / 1024 / 1024:.1f} MB")
    print(f"Written to: {dst}")
