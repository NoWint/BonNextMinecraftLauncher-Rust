#!/usr/bin/env python3
"""Strip non-vertex elements from SHARP .ply to make it compatible with gaussian-splats-3d."""
import os, sys

src = '/Users/xiatian/Desktop/BonNext/public/scene.ply'
dst = '/Users/xiatian/Desktop/BonNext/public/scene_clean.ply'

with open(src, 'rb') as f:
    # Read header
    header = b''
    while True:
        line = f.readline()
        header += line
        if line.strip() == b'end_header':
            break

    header_str = header.decode('ascii')
    print("Original header:")
    print(header_str)

    # Parse vertex count and vertex properties
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

    print(f"\nVertex count: {vertex_count}")
    print(f"Vertex properties: {len(vertex_props)}")

    # Calculate bytes per vertex
    bytes_per_vertex = 0
    for prop in vertex_props:
        ptype = prop.split()[1]
        if ptype == 'float':
            bytes_per_vertex += 4
        elif ptype == 'uchar':
            bytes_per_vertex += 1
        elif ptype == 'uint':
            bytes_per_vertex += 4
        elif ptype == 'int':
            bytes_per_vertex += 4

    print(f"Bytes per vertex: {bytes_per_vertex}")
    print(f"Total vertex data: {vertex_count * bytes_per_vertex} bytes ({vertex_count * bytes_per_vertex / 1024 / 1024:.1f} MB)")

    # Read vertex data
    vertex_data = f.read(vertex_count * bytes_per_vertex)
    print(f"Read {len(vertex_data)} bytes of vertex data")

    # Write clean PLY with only vertex element
    clean_header = f"ply\nformat binary_little_endian 1.0\nelement vertex {vertex_count}\n"
    for prop in vertex_props:
        clean_header += prop + "\n"
    clean_header += "end_header\n"

    with open(dst, 'wb') as out:
        out.write(clean_header.encode('ascii'))
        out.write(vertex_data)

    print(f"\nClean file size: {os.path.getsize(dst) / 1024 / 1024:.1f} MB")
    print(f"Written to: {dst}")

    # Verify
    with open(dst, 'rb') as verify:
        verify_header = b''
        while True:
            line = verify.readline()
            verify_header += line
            if line.strip() == b'end_header':
                break
        print(f"\nClean header:")
        print(verify_header.decode('ascii'))
