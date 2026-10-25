"""Builds the MissionLab astronaut mascot and exports it as a GLB.

Run (headless):
    blender -b -P scripts/blender/build_astronaut.py -- public/models/astronaut.glb [preview_dir]

Layout contract with src/features/explore/character/Astronaut.tsx:
  * Nodes "Body", "ArmL", "ArmR", "LegL", "LegR" (all meshes).
  * Limb origins sit on the joint (shoulder / hip) so rotating the node swings the limb.
  * "ArmR"/"LegR" are on the +X side, matching the original procedural avatar.
  * Character faces glTF +Z, feet on y = 0, about 1.29 m tall.
"""
import math
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "astronaut.glb"
PREVIEW_DIR = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- materials
def material(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


MAT = {
    "suit": material("Suit", srgb("#efe6d6"), 0.5),
    "orange": material("Orange", srgb("#ef5a1f"), 0.42),
    "dark": material("Dark", srgb("#1f1612"), 0.55, 0.15),
    "visor": material("Visor", srgb("#0a0706"), 0.07, 0.0),
    "glow": material("Glow", srgb("#ff8a3d"), 0.4, 0.0, srgb("#ff7a2a"), 3.0),
}
MAT_SLOT = list(MAT)

# ---------------------------------------------------------------- generators
def sgnpow(v, e):
    return math.copysign(abs(v) ** e, v)


def _place(a, b, c, semi, center, pole):
    sx, sy, sz = semi
    if pole == "z":
        p = (a * sx, b * sy, c * sz)
    elif pole == "x":
        p = (c * sx, a * sy, b * sz)
    else:  # "y"
        p = (b * sx, c * sy, a * sz)
    return (p[0] + center[0], p[1] + center[1], p[2] + center[2])


def superellipsoid(semi, center=(0, 0, 0), e=1.0, seg=28, rings=14, pole="z"):
    """e = 1 is an ellipsoid; e < 1 squares it off (rounded box)."""
    v = [_place(0, 0, 1, semi, center, pole)]
    for i in range(1, rings):
        phi = math.pi * i / rings
        z, r = math.cos(phi), math.sin(phi)
        for j in range(seg):
            th = 2 * math.pi * j / seg
            v.append(_place(sgnpow(r * math.cos(th), e), sgnpow(r * math.sin(th), e), sgnpow(z, e), semi, center, pole))
    v.append(_place(0, 0, -1, semi, center, pole))
    f = [(0, 1 + (j + 1) % seg, 1 + j) for j in range(seg)]
    for i in range(rings - 2):
        for j in range(seg):
            a, b = 1 + i * seg + j, 1 + i * seg + (j + 1) % seg
            f.append((a, b, b + seg, a + seg))
    last = len(v) - 1
    base = 1 + (rings - 2) * seg
    f += [(last, base + j, base + (j + 1) % seg) for j in range(seg)]
    return v, f


def torus(major, minor, center=(0, 0, 0), axis="z", squash=1.0, seg=32, tube=8):
    """Ring around `axis`; `squash` scales the tube along the axis direction."""
    v, f = [], []
    for i in range(seg):
        u = 2 * math.pi * i / seg
        for j in range(tube):
            t = 2 * math.pi * j / tube
            r = major + minor * math.cos(t)
            a, b, c = r * math.cos(u), r * math.sin(u), minor * squash * math.sin(t)
            v.append(_place(a, b, c, (1, 1, 1), center, axis))
    for i in range(seg):
        for j in range(tube):
            a, b = i * tube + j, ((i + 1) % seg) * tube + j
            f.append((a, a + 1 if j + 1 < tube else i * tube, (b + 1) if j + 1 < tube else ((i + 1) % seg) * tube, b))
    return v, f


def star(radius, inner, thickness, center, points=4):
    """Flat sparkle emblem in the XZ plane, thickness along Y."""
    n = points * 2
    ring = [(radius if k % 2 == 0 else inner, math.pi * 2 * k / n + math.pi / 2) for k in range(n)]
    cx, cy, cz = center
    top = [(cx + r * math.cos(a), cy - thickness / 2, cz + r * math.sin(a)) for r, a in ring]
    bot = [(x, cy + thickness / 2, z) for x, _, z in top]
    v = top + bot + [(cx, cy - thickness / 2, cz), (cx, cy + thickness / 2, cz)]
    ct, cb = 2 * n, 2 * n + 1
    f = [(ct, k, (k + 1) % n) for k in range(n)]
    f += [(cb, n + (k + 1) % n, n + k) for k in range(n)]
    f += [(k, n + k, n + (k + 1) % n, (k + 1) % n) for k in range(n)]
    return v, f


def ribbon_arc(center, radius, t0, t1, half_w, half_h, steps=48, ring=10):
    """Tapered band hugging a circle in the YZ plane (theta 0 = front, 90deg = top)."""
    v, f = [], []
    for i in range(steps + 1):
        t = i / steps
        th = math.radians(t0 + (t1 - t0) * t)
        s = math.sin(math.pi * t) ** 0.45
        ry, rz = -math.cos(th), math.sin(th)
        for j in range(ring):
            p = 2 * math.pi * j / ring
            rad = radius + half_h * s * math.cos(p)
            v.append((center[0] + half_w * s * math.sin(p), center[1] + ry * rad, center[2] + rz * rad))
    for i in range(steps):
        for j in range(ring):
            a, b = i * ring + j, i * ring + (j + 1) % ring
            f.append((a, b, b + ring, a + ring))
    return v, f


def tube(points, radius, normal=(0, -1, 0), ring=8):
    """Tapered tube along a polyline lying in a plane whose normal is `normal`."""
    v, f = [], []
    n = len(points)
    for i, p in enumerate(points):
        a, b = points[max(i - 1, 0)], points[min(i + 1, n - 1)]
        tx, ty, tz = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        ln = math.sqrt(tx * tx + ty * ty + tz * tz) or 1
        t = (tx / ln, ty / ln, tz / ln)
        h = (normal[1] * t[2] - normal[2] * t[1], normal[2] * t[0] - normal[0] * t[2], normal[0] * t[1] - normal[1] * t[0])
        s = math.sin(math.pi * (i / (n - 1))) ** 0.4 if 0 < i < n - 1 else 0.0
        for j in range(ring):
            q = 2 * math.pi * j / ring
            c, d = math.cos(q) * radius * s, math.sin(q) * radius * s
            v.append((p[0] + normal[0] * c + h[0] * d, p[1] + normal[1] * c + h[1] * d, p[2] + normal[2] * c + h[2] * d))
    for i in range(n - 1):
        for j in range(ring):
            a, b = i * ring + j, i * ring + (j + 1) % ring
            f.append((a, b, b + ring, a + ring))
    return v, f


# ---------------------------------------------------------------- part builder
class Part:
    def __init__(self, name, pivot=(0, 0, 0)):
        self.name, self.pivot = name, pivot
        self.shapes = []

    def add(self, shape, mat, smooth=True):
        v, f = shape
        px, py, pz = self.pivot
        self.shapes.append(([(x - px, y - py, z - pz) for x, y, z in v], f, MAT_SLOT.index(mat), smooth))
        return self

    def build(self):
        bm = bmesh.new()
        for verts, faces, slot, smooth in self.shapes:
            vs = [bm.verts.new(p) for p in verts]
            for face in faces:
                try:
                    fc = bm.faces.new([vs[i] for i in face])
                except ValueError:
                    continue
                fc.material_index = slot
                fc.smooth = smooth
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mesh = bpy.data.meshes.new(self.name + "Mesh")
        bm.to_mesh(mesh)
        bm.free()
        for m in MAT.values():
            mesh.materials.append(m)
        obj = bpy.data.objects.new(self.name, mesh)
        obj.location = self.pivot
        bpy.context.scene.collection.objects.link(obj)
        return obj


# ---------------------------------------------------------------- the character
HEAD_C = (0, 0, 0.92)
HEAD = (0.40, 0.37, 0.37)  # semi axes x, y, z (front = -Y)
VISOR_C = (HEAD_C[0], HEAD_C[1] - 0.17, HEAD_C[2] + 0.02)
VISOR = (0.31, 0.24, 0.27)

body = Part("Body")
# torso and collar
body.add(superellipsoid((0.2, 0.16, 0.19), (0, 0, 0.46), 0.9), "suit")
body.add(torus(0.158, 0.016, (0, 0, 0.345), squash=1.0), "orange")
body.add(torus(0.15, 0.022, (0, 0, 0.635)), "dark")
body.add(star(0.07, 0.02, 0.012, (0, -0.158, 0.5)), "orange", smooth=False)
# helmet
body.add(superellipsoid(HEAD, HEAD_C, 1.0, seg=48, rings=24), "suit")
body.add(superellipsoid(VISOR, VISOR_C, 1.0, seg=48, rings=24), "visor")
body.add(ribbon_arc(HEAD_C, HEAD[1] + 0.004, 28, 205, 0.045, 0.012, steps=64), "orange")
for s in (-1, 1):
    cx = s * (HEAD[0] + 0.005)
    body.add(superellipsoid((0.045, 0.105, 0.105), (cx, HEAD_C[1] - 0.01, HEAD_C[2] + 0.0), 0.6, pole="x"), "suit")
    body.add(torus(0.088, 0.015, (s * (HEAD[0] + 0.045), HEAD_C[1] - 0.01, HEAD_C[2]), axis="x", squash=1.0), "orange")
    body.add(superellipsoid((0.01, 0.045, 0.045), (s * (HEAD[0] + 0.05), HEAD_C[1] - 0.01, HEAD_C[2]), 1.0, pole="x"), "dark")
    # happy "^ ^" eyes laid on the visor surface
    cx_eye, w, h, cz_eye = s * 0.105, 0.052, 0.046, HEAD_C[2] + 0.03
    pts = []
    for k in range(17):
        a = math.radians(15 + 150 * k / 16)
        x, z = cx_eye + w * math.cos(a), cz_eye + h * math.sin(a)
        q = 1 - ((x - VISOR_C[0]) / VISOR[0]) ** 2 - ((z - VISOR_C[2]) / VISOR[2]) ** 2
        y = VISOR_C[1] - VISOR[1] * math.sqrt(max(q, 0.01)) - 0.001
        pts.append((x, y, z))
    body.add(tube(pts, 0.0135), "glow")
# backpack with sparkle emblem
body.add(superellipsoid((0.15, 0.075, 0.17), (0, 0.2, 0.5), 0.55), "suit")
body.add(torus(0.08, 0.011, (0, 0.274, 0.5), axis="y"), "orange")
body.add(star(0.06, 0.017, 0.012, (0, 0.272, 0.5)), "orange", smooth=False)
body.add(superellipsoid((0.06, 0.05, 0.03), (0, 0.2, 0.3), 0.6), "dark")

parts = [body]
for name, sx in (("ArmL", -1), ("ArmR", 1)):
    p = Part(name, (sx * 0.235, 0, 0.56))
    px = sx * 0.235
    p.add(superellipsoid((0.066, 0.066, 0.115), (px, 0, 0.465), 0.9), "suit")
    p.add(torus(0.062, 0.015, (px, 0, 0.375)), "orange")
    p.add(superellipsoid((0.072, 0.072, 0.072), (px, 0, 0.325), 1.0), "dark")
    parts.append(p)
for name, sx in (("LegL", -1), ("LegR", 1)):
    px = sx * 0.1
    p = Part(name, (px, 0, 0.3))
    p.add(superellipsoid((0.078, 0.078, 0.13), (px, 0, 0.2), 0.9), "suit")
    p.add(torus(0.074, 0.016, (px, 0, 0.115)), "orange")
    p.add(superellipsoid((0.092, 0.135, 0.07), (px, -0.03, 0.068), 0.75), "dark")
    p.add(superellipsoid((0.088, 0.13, 0.016), (px, -0.03, 0.02), 0.6), "orange")
    parts.append(p)

objs = [p.build() for p in parts]

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
)
print("EXPORTED", OUT, "tris:", sum(len(o.data.polygons) for o in objs))

# ---------------------------------------------------------------- optional preview renders
if PREVIEW_DIR:
    import os

    os.makedirs(PREVIEW_DIR, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.render.resolution_x = sc.render.resolution_y = 720
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.03, 0.02, 0.02, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

    def light(loc, energy, size):
        d = bpy.data.lights.new("L", "AREA")
        d.energy, d.size = energy, size
        o = bpy.data.objects.new("L", d)
        o.location = loc
        sc.collection.objects.link(o)
        c = o.constraints.new("TRACK_TO")
        c.target = objs[0]
        c.track_axis, c.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"

    light((-1.6, -2.2, 2.4), 220, 2.2)
    light((2.2, -1.2, 1.2), 90, 2.0)
    light((0.3, 2.6, 1.8), 120, 2.0)
    cam_d = bpy.data.cameras.new("C")
    cam_d.lens = 70
    cam = bpy.data.objects.new("C", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    aim = bpy.data.objects.new("aim", None)
    aim.location = (0, 0, 0.64)
    sc.collection.objects.link(aim)
    tr = cam.constraints.new("TRACK_TO")
    tr.target, tr.track_axis, tr.up_axis = aim, "TRACK_NEGATIVE_Z", "UP_Y"
    for label, loc in (("front", (0.55, -4.0, 1.0)), ("three_quarter", (2.6, -3.0, 1.2)), ("back", (-0.8, 4.0, 1.2))):
        cam.location = loc
        sc.render.filepath = os.path.join(PREVIEW_DIR, label + ".png")
        bpy.ops.render.render(write_still=True)
    print("PREVIEWS", PREVIEW_DIR)
