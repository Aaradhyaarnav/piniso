"""Piniso 3D — built in Blender with Python (no AI art). Soft clay-toy blob with a pencil.
Run:  python3 build_piniso.py out.glb [preview.png]
Every part has a stable name so the extension can recolour, show/hide and animate it live:
  Rig (root, pivot on the floor) > Body, Feet, EyeL/EyeR (> Sclera, Pup (> Pupil, Shine, Shine2)), face pieces,
  Brow*, Cheek*, Mouth_*, Hat_*, Face_*, Neck_*, ArmL, ArmR (> Hold > Item_*).
Materials are named M_* so the extension can swap them for live clay materials."""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Euler

OUT = sys.argv[-2] if sys.argv[-1].endswith('.png') else sys.argv[-1]
PREVIEW = sys.argv[-1] if sys.argv[-1].endswith('.png') else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ------------------------------------------------------------------ helpers
MATS = {}
def mat(name, rgb, rough=0.55, metal=0.0, emit=None, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 1.0
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    MATS[name] = m
    return m

def hexrgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)  # sRGB -> linear

M = {
    'body': mat('M_Body', hexrgb('#FFFDF7'), 0.62),
    'dark': mat('M_Dark', hexrgb('#1C1B18'), 0.35),
    'white': mat('M_White', hexrgb('#FFFFFF'), 0.08),
    'cheek': mat('M_Cheek', hexrgb('#FF9BA8'), 0.7),
    'pencil': mat('M_Pencil', hexrgb('#FFC93C'), 0.45),
    'eraser': mat('M_Eraser', hexrgb('#FF7F8E'), 0.8),
    'accent': mat('M_Accent', hexrgb('#FFD23F'), 0.5),
    'wood': mat('M_Wood', hexrgb('#F3C99A'), 0.7),
    'graphite': mat('M_Graphite', hexrgb('#3A3A40'), 0.3, 0.4),
    'metal': mat('M_Metal', hexrgb('#C9CDD6'), 0.25, 1.0),
    'gold': mat('M_Gold', hexrgb('#F5C542'), 0.22, 1.0),
    'leaf': mat('M_Leaf', hexrgb('#7CCB52'), 0.55),
    'leaf2': mat('M_Leaf2', hexrgb('#A7E27A'), 0.55),
    'stem': mat('M_Stem', hexrgb('#5FA83B'), 0.6),
    'tongue': mat('M_Tongue', hexrgb('#FF7A93'), 0.5),
    'red': mat('M_Red', hexrgb('#E63946'), 0.5),
    'pink': mat('M_Pink', hexrgb('#FF5C8A'), 0.5),
    'blue': mat('M_Blue', hexrgb('#3F72FF'), 0.45),
    'purple': mat('M_Purple', hexrgb('#6E5BEA'), 0.5),
    'navy': mat('M_Navy', hexrgb('#26252B'), 0.5),
    'glass': mat('M_Glass', hexrgb('#17161B'), 0.05),
    'brown': mat('M_Brown', hexrgb('#B46A3C'), 0.4),
    'cup': mat('M_Cup', hexrgb('#FFFDF7'), 0.3),
    'scarf': mat('M_Scarf', hexrgb('#E76F51'), 0.85),
    'paper': mat('M_Paper', hexrgb('#FFFDF7'), 0.8),
    'star': mat('M_Star', hexrgb('#FFC93C'), 0.3),
    'heart': mat('M_Heart', hexrgb('#FF4D6D'), 0.35),
    'halo': mat('M_Halo', hexrgb('#FFD23F'), 0.2, 0.0, emit=hexrgb('#FFE27A')),
}

def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    if parent:
        o.parent = parent
        bpy.context.view_layer.update()
        o.matrix_world = Matrix.Translation(Vector(loc))  # pivot exactly at loc (world space)
    else:
        o.location = loc
    return o

def finish(o, name, m, parent=None, smooth=True):
    o.name = name; o.data.name = name
    if m:
        o.data.materials.clear(); o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    if parent:
        mw = o.matrix_world.copy(); o.parent = parent; o.matrix_world = mw
    return o

def sphere(name, loc, scale, m, parent=None, seg=24, rings=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, m, parent)

def cyl(name, loc, r, depth, m, parent=None, verts=32, rot=(0, 0, 0), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    return finish(o, name, m, parent, smooth=verts > 8)

def torus(name, loc, R, r, m, parent=None, rot=(0, 0, 0), seg=40, mseg=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=mseg, location=loc, rotation=rot)
    return finish(bpy.context.object, name, m, parent)

def box(name, loc, size, m, parent=None, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('b', 'BEVEL'); mod.width = bevel; mod.segments = 3
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='b')
    return finish(o, name, m, parent)

def tube(name, pts, radius, m, parent=None, closed=False, res=6, taper=None):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY' if len(pts) < 3 else 'NURBS')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    if sp.type == 'NURBS': sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    sp.use_cyclic_u = closed
    cu.bevel_depth = radius; cu.bevel_resolution = 2; cu.resolution_u = res; cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.select_set(False)
    return finish(o, name, m, parent)

def disc(name, loc, rx, rz, depth, m, parent=None, rot=(math.pi / 2, 0, 0)):
    o = cyl(name, loc, 1, depth, m, None, 40, rot)
    o.scale = (rx, rz, 1); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, m, parent)

def star_prism(name, loc, R, depth, m, parent=None, pts=5, inner=0.48):
    bm = bmesh.new()
    ring = []
    for i in range(pts * 2):
        a = math.pi / 2 + i * math.pi / pts
        r = R if i % 2 == 0 else R * inner
        ring.append(bm.verts.new((math.cos(a) * r, 0, math.sin(a) * r)))
    f = bm.faces.new(ring)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.y += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.location = loc
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('b', 'BEVEL'); mod.width = depth * 0.35; mod.segments = 2
    bpy.ops.object.modifier_apply(modifier='b')
    return finish(o, name, m, parent, smooth=False)

def heart_prism(name, loc, s, depth, m, parent=None):
    bm = bmesh.new(); ring = []
    for i in range(48):
        t = i / 48 * 2 * math.pi
        x = 16 * math.sin(t) ** 3; z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        ring.append(bm.verts.new((x / 17 * s, 0, z / 17 * s)))
    f = bm.faces.new(ring)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.y += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.location = loc
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('b', 'BEVEL'); mod.width = depth * 0.4; mod.segments = 3
    bpy.ops.object.modifier_apply(modifier='b')
    return finish(o, name, m, parent)

# ------------------------------------------------------------------ the body (a soft blob, pivot on the floor)
SX, SY, SZ, CZ = 1.0, 0.9, 0.96, 1.0
def deform(x, y, z):
    # widen the belly a little and flatten the bottom so it sits like a dumpling
    if z < CZ:
        k = 1 + 0.10 * ((CZ - z) / CZ)
        x *= k; y *= k
    if z < 0.16: z = 0.16 - (0.16 - z) * 0.25
    return x, y, z
def surf(x, z, off=0.0):
    """point on the front of the body at (x, z), pushed out by off"""
    u = 1 - (x / SX) ** 2 - ((z - CZ) / SZ) ** 2
    y = -SY * math.sqrt(max(0.0, u))
    if z < CZ: y *= 1 + 0.10 * ((CZ - z) / CZ)
    return (x, y - off, z)

rig = empty('Rig')
bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=36, radius=1, location=(0, 0, CZ))
body = bpy.context.object
for v in body.data.vertices:
    x, y, z = v.co.x * SX, v.co.y * SY, v.co.z * SZ + CZ
    v.co = Vector(deform(x, y, z)) - Vector((0, 0, CZ))
finish(body, 'Body', M['body'], rig)

feet = empty('Feet', (0, 0, 0), rig)
for s, nm in ((1, 'FootR'), (-1, 'FootL')):
    sphere(nm, (0.4 * s, -0.42, 0.11), (0.25, 0.3, 0.14), M['body'], feet)

# ------------------------------------------------------------------ face
EY, EZ, EX = 0, 1.13, 0.34
for s, nm in ((-1, 'L'), (1, 'R')):
    p = surf(EX * s, EZ, 0.0)
    eye = empty('Eye' + nm, (p[0], p[1] + 0.03, p[2]), rig)
    sphere('Sclera' + nm, (p[0], p[1] + 0.04, p[2]), (0.2, 0.09, 0.235), M['white'], eye)
    pup = empty('Pup' + nm, (p[0], p[1] - 0.04, p[2] - 0.01), eye)
    sphere('Pupil' + nm, (p[0], p[1] - 0.045, p[2] - 0.01), (0.135, 0.05, 0.16), M['dark'], pup)
    sphere('Shine' + nm, (p[0] - 0.045, p[1] - 0.095, p[2] + 0.06), (0.048, 0.015, 0.055), M['white'], pup)
    sphere('Shine2' + nm, (p[0] + 0.045, p[1] - 0.09, p[2] - 0.06), (0.022, 0.01, 0.022), M['white'], pup)
    # alternative eyes (hidden until a mood needs them)
    c = surf(EX * s, EZ, 0.02)
    tube('Happy' + nm, [(c[0] - 0.13, c[1], c[2] - 0.04), (c[0], c[1] - 0.02, c[2] + 0.08), (c[0] + 0.13, c[1], c[2] - 0.04)], 0.032, M['dark'], rig)
    tube('Closed' + nm, [(c[0] - 0.13, c[1], c[2] + 0.02), (c[0], c[1] - 0.02, c[2] - 0.07), (c[0] + 0.13, c[1], c[2] + 0.02)], 0.03, M['dark'], rig)
    star_prism('Star' + nm, (c[0], c[1] - 0.01, c[2]), 0.2, 0.06, M['star'], rig)
    heart_prism('Heart' + nm, (c[0], c[1] - 0.01, c[2] - 0.02), 0.19, 0.06, M['heart'], rig)
    sp = [(c[0] + math.cos(t) * 0.012 * t, c[1] - 0.005, c[2] + math.sin(t) * 0.012 * t) for t in [i * 0.35 for i in range(1, 38)]]
    tube('Spiral' + nm, sp, 0.016, M['dark'], rig)
    tube('Cross' + nm, [(c[0] - 0.1, c[1], c[2] + 0.1), (c[0] + 0.1, c[1], c[2] - 0.1)], 0.03, M['dark'], rig)
    tube('Cross2' + nm, [(c[0] + 0.1, c[1], c[2] + 0.1), (c[0] - 0.1, c[1], c[2] - 0.1)], 0.03, M['dark'], rig)
    # sleepy lid (body coloured shell over the top half of the eye)
    lid = empty('Lid' + nm, (p[0], p[1] + 0.03, p[2] + 0.02), eye)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=(p[0], p[1] + 0.03, p[2]))
    o = bpy.context.object; o.scale = (0.215, 0.115, 0.25)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    finish(o, 'LidMesh' + nm, M['body'], lid)
    # brows
    b = surf(EX * s, EZ + 0.34, 0.015)
    brow = empty('Brow' + nm, b, rig)
    tube('BrowMesh' + nm, [(b[0] - 0.1, b[1] + 0.01, b[2] - 0.01), (b[0], b[1] - 0.01, b[2] + 0.025), (b[0] + 0.1, b[1] + 0.01, b[2] - 0.01)], 0.026, M['dark'], brow)
    # cheeks
    ck = surf(0.58 * s, 0.9, -0.03)
    sphere('Cheek' + nm, ck, (0.12, 0.05, 0.075), M['cheek'], rig, rot=(0, 0, -0.55 * s))

MZ = 0.86
def mouth_pts(fn, n=9):
    out = []
    for i in range(n):
        t = i / (n - 1); x = (t - 0.5) * 0.3
        out.append(surf(x, MZ + fn(t), 0.01))
    return out
mouths = empty('Mouths', (0, 0, MZ), rig)
tube('Mouth_smile', mouth_pts(lambda t: 0.06 * (2 * t - 1) ** 2 - 0.03), 0.028, M['dark'], mouths)
tube('Mouth_flat', mouth_pts(lambda t: 0.0, 3), 0.028, M['dark'], mouths)
tube('Mouth_frown', mouth_pts(lambda t: -0.06 * (2 * t - 1) ** 2 + 0.01), 0.028, M['dark'], mouths)
tube('Mouth_wavy', mouth_pts(lambda t: 0.02 * math.sin(t * math.pi * 4), 17), 0.024, M['dark'], mouths)
tube('Mouth_cat', mouth_pts(lambda t: -0.035 * abs(math.sin(t * math.pi * 2)), 17), 0.024, M['dark'], mouths)
tube('Mouth_smug', [surf(-0.12, MZ, 0.01), surf(0.0, MZ - 0.025, 0.01), surf(0.13, MZ + 0.05, 0.01)], 0.026, M['dark'], mouths)
# open mouths: a dark "D" with a tongue
g = empty('Mouth_grin', (0, 0, MZ), mouths)
c = surf(0, MZ - 0.02, 0.0)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=c)
o = bpy.context.object; o.scale = (0.15, 0.05, 0.12)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bm = bmesh.new(); bm.from_mesh(o.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.005], context='VERTS')
bm.to_mesh(o.data); bm.free()
finish(o, 'GrinMesh', M['dark'], g)
sphere('GrinTongue', (c[0], c[1] - 0.025, c[2] - 0.075), (0.075, 0.03, 0.04), M['tongue'], g)
op = empty('Mouth_open', (0, 0, MZ), mouths)
c = surf(0, MZ - 0.01, 0.0)
sphere('OpenMesh', c, (0.085, 0.04, 0.07), M['dark'], op)
sphere('OpenTongue', (c[0], c[1] - 0.03, c[2] - 0.04), (0.055, 0.02, 0.025), M['tongue'], op)
oo = empty('Mouth_o', (0, 0, MZ), mouths)
sphere('OMesh', surf(0, MZ - 0.01, 0.0), (0.055, 0.04, 0.07), M['dark'], oo)
tg = empty('Mouth_tongue', (0, 0, MZ), mouths)
tube('TongueSmile', mouth_pts(lambda t: 0.06 * (2 * t - 1) ** 2 - 0.03), 0.026, M['dark'], tg)
sphere('TongueOut', surf(0.04, MZ - 0.07, 0.03), (0.05, 0.03, 0.06), M['tongue'], tg)

# ------------------------------------------------------------------ sprout (default hat) and other hats
TOP = 1.92
hats = empty('Hats', (0, 0, TOP), rig)
spr = empty('Hat_sprout', (0, 0, TOP - 0.04), hats)
tube('Stem', [(0, -0.02, TOP - 0.06), (0.01, -0.01, TOP + 0.12), (-0.01, 0, TOP + 0.26)], 0.032, M['stem'], spr)
leafL = empty('LeafL', (-0.02, 0, TOP + 0.24), spr)
sphere('LeafLMesh', (-0.2, 0, TOP + 0.3), (0.22, 0.05, 0.11), M['leaf'], leafL, rot=(0, 0.45, 0))
leafR = empty('LeafR', (0.02, 0, TOP + 0.24), spr)
sphere('LeafRMesh', (0.21, 0, TOP + 0.33), (0.23, 0.05, 0.12), M['leaf2'], leafR, rot=(0, -0.6, 0))

h = empty('Hat_cap', (0, 0, TOP), hats)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0, TOP - 0.38))
o = bpy.context.object; o.scale = (0.72, 0.68, 0.62)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0.05], context='VERTS'); bm.to_mesh(o.data); bm.free()
finish(o, 'CapDome', M['accent'], h)
disc('CapBrim', (0, -0.62, TOP - 0.3), 0.5, 0.32, 0.04, M['accent'], h, rot=(0.12, 0, 0))
sphere('CapButton', (0, 0, TOP + 0.24), (0.06, 0.06, 0.04), M['dark'], h)

h = empty('Hat_grad', (0, 0, TOP), hats)
cyl('GradCap', (0, 0, TOP - 0.06), 0.46, 0.26, M['navy'], h)
box('GradBoard', (0, 0, TOP + 0.09), (1.05, 1.05, 0.05), M['navy'], h, rot=(0, 0, math.pi / 4))
sphere('GradButton', (0, 0, TOP + 0.13), (0.05, 0.05, 0.03), M['accent'], h)
tube('GradCord', [(0, 0, TOP + 0.13), (0.38, -0.2, TOP + 0.12), (0.5, -0.28, TOP - 0.05), (0.52, -0.3, TOP - 0.22)], 0.014, M['accent'], h)
cyl('GradTassel', (0.52, -0.3, TOP - 0.3), 0.045, 0.16, M['accent'], h, verts=12)

h = empty('Hat_beanie', (0, 0, TOP), hats)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0, TOP - 0.3))
o = bpy.context.object; o.scale = (0.74, 0.7, 0.68)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0.0], context='VERTS'); bm.to_mesh(o.data); bm.free()
finish(o, 'BeanieDome', M['accent'], h)
torus('BeanieRim', (0, 0, TOP - 0.28), 0.73, 0.09, M['body'], h, rot=(0.05, 0, 0))
sphere('BeaniePom', (0, 0, TOP + 0.44), (0.15, 0.15, 0.15), M['body'], h)

h = empty('Hat_bow', (0, 0, TOP), hats)
bw = empty('BowKnot', (0.5, -0.2, TOP - 0.25), h)
sphere('BowL', (0.33, -0.2, TOP - 0.18), (0.2, 0.08, 0.14), M['pink'], bw, rot=(0, 0.3, 0))
sphere('BowR', (0.67, -0.2, TOP - 0.32), (0.2, 0.08, 0.14), M['pink'], bw, rot=(0, 0.3, 0))
sphere('BowC', (0.5, -0.25, TOP - 0.25), (0.08, 0.07, 0.08), M['tongue'], bw)

h = empty('Hat_headphones', (0, 0, TOP), hats)
torus('PhoneBand', (0, 0.05, TOP - 0.85), 1.02, 0.06, M['dark'], h, rot=(math.pi / 2, 0, 0))
for s in (-1, 1):
    cyl('PhoneCup' + ('L' if s < 0 else 'R'), (1.0 * s, 0.05, 1.05), 0.22, 0.2, M['accent'], h, rot=(0, math.pi / 2, 0))
    cyl('PhonePad' + ('L' if s < 0 else 'R'), (0.9 * s, 0.05, 1.05), 0.19, 0.06, M['dark'], h, rot=(0, math.pi / 2, 0))

h = empty('Hat_party', (0, 0, TOP), hats)
cyl('PartyCone', (0.05, 0, TOP + 0.2), 0.32, 0.72, M['accent'], h, r2=0.0, rot=(0, 0.12, 0))
for i, zz in enumerate((0.0, 0.2, 0.38)):
    torus('PartyStripe%d' % i, (0.05 + zz * 0.12 * 0.8, 0, TOP - 0.1 + zz + 0.04), 0.3 - zz * 0.42, 0.018, M['pink'], h, rot=(0, 0.12, 0), seg=32, mseg=6)
sphere('PartyPom', (0.12, 0, TOP + 0.6), (0.1, 0.1, 0.1), M['pink'], h)

h = empty('Hat_crown', (0, 0, TOP), hats)
cyl('CrownRing', (0, 0, TOP - 0.06), 0.48, 0.2, M['gold'], h)
for i in range(6):
    a = i / 6 * 2 * math.pi
    cyl('CrownSpike%d' % i, (math.cos(a) * 0.44, math.sin(a) * 0.44, TOP + 0.16), 0.11, 0.26, M['gold'], h, verts=4, r2=0.0)
    sphere('CrownTip%d' % i, (math.cos(a) * 0.44, math.sin(a) * 0.44, TOP + 0.3), (0.035, 0.035, 0.035), M['gold'], h)
for i, (mm, a) in enumerate(((M['red'], -0.5), (M['blue'], 0), (M['leaf'], 0.5))):
    sphere('CrownGem%d' % i, (math.sin(a) * 0.48, -math.cos(a) * 0.48, TOP - 0.06), (0.05, 0.03, 0.05), mm, h)

h = empty('Hat_wizard', (0, 0, TOP), hats)
disc('WizBrim', (0, 0, TOP - 0.1), 0.95, 0.95, 0.04, M['purple'], h, rot=(0, 0, 0))
cyl('WizConeMesh', (0, 0, TOP + 0.26), 0.5, 0.75, M['purple'], h, r2=0.04, rot=(0, 0.18, 0))
star_prism('WizStar', (0.08, -0.38, TOP + 0.22), 0.1, 0.03, M['star'], h)
star_prism('WizStar2', (-0.14, -0.3, TOP + 0.42), 0.06, 0.03, M['star'], h)

h = empty('Hat_halo', (0, 0, TOP + 0.35), hats)
torus('HaloRing', (0, 0, TOP + 0.35), 0.5, 0.06, M['halo'], h, rot=(0.25, 0, 0))

# ------------------------------------------------------------------ face extras (glasses etc.)
faces = empty('Faces', (0, 0, EZ), rig)
def lens_pos(s): p = surf(EX * s, EZ, 0.1); return p
f = empty('Face_round', (0, 0, EZ), faces)
for s in (-1, 1):
    torus('RoundRim' + str(s), lens_pos(s), 0.26, 0.03, M['dark'], f, rot=(math.pi / 2, 0, 0))
tube('RoundBridge', [lens_pos(-1)[:2] + (EZ + 0.02,), (0, lens_pos(1)[1] - 0.04, EZ + 0.06), lens_pos(1)[:2] + (EZ + 0.02,)], 0.022, M['dark'], f)
f = empty('Face_square', (0, 0, EZ), faces)
for s in (-1, 1):
    o = torus('SquareRim' + str(s), lens_pos(s), 0.3, 0.032, M['dark'], f, rot=(math.pi / 2, 0, math.pi / 4), seg=4, mseg=8)
tube('SquareBridge', [lens_pos(-1)[:2] + (EZ,), (0, lens_pos(1)[1] - 0.04, EZ + 0.04), lens_pos(1)[:2] + (EZ,)], 0.022, M['dark'], f)
f = empty('Face_nerd', (0, 0, EZ), faces)
for s in (-1, 1):
    torus('NerdRim' + str(s), lens_pos(s), 0.27, 0.055, M['dark'], f, rot=(math.pi / 2, 0, 0))
box('NerdTape', (0, lens_pos(1)[1] - 0.02, EZ + 0.02), (0.16, 0.06, 0.1), M['paper'], f)
f = empty('Face_sun', (0, 0, EZ), faces)
for s in (-1, 1):
    disc('SunLens' + str(s), lens_pos(s), 0.28, 0.22, 0.04, M['glass'], f)
box('SunBar', (0, lens_pos(1)[1] - 0.02, EZ + 0.12), (0.9, 0.04, 0.05), M['dark'], f)
f = empty('Face_monocle', (0, 0, EZ), faces)
torus('MonoRim', lens_pos(1), 0.27, 0.03, M['gold'], f, rot=(math.pi / 2, 0, 0))
tube('MonoChain', [lens_pos(1)[:2] + (EZ - 0.27,), (0.45, lens_pos(1)[1] + 0.1, 0.8), (0.55, -0.6, 0.55)], 0.012, M['gold'], f)
f = empty('Face_mustache', (0, 0, 0.95), faces)
for s in (-1, 1):
    tube('Stache' + str(s), [surf(0.0, 0.95, 0.04), surf(0.12 * s, 0.92, 0.05), surf(0.24 * s, 0.95, 0.04), surf(0.3 * s, 1.0, 0.02)], 0.045, M['dark'], f)

# ------------------------------------------------------------------ neck things
necks = empty('Necks', (0, 0, 0.5), rig)
NZ = 0.5
n = empty('Neck_bowtie', (0, 0, NZ), necks)
c = surf(0, NZ, 0.06)
sphere('BowtieL', (c[0] - 0.13, c[1], c[2]), (0.14, 0.06, 0.1), M['red'], n, rot=(0, 0.2, 0))
sphere('BowtieR', (c[0] + 0.13, c[1], c[2]), (0.14, 0.06, 0.1), M['red'], n, rot=(0, -0.2, 0))
sphere('BowtieC', (c[0], c[1] - 0.03, c[2]), (0.05, 0.05, 0.05), M['red'], n)
n = empty('Neck_tie', (0, 0, NZ), necks)
c = surf(0, NZ + 0.02, 0.05)
box('TieKnot', c, (0.11, 0.06, 0.09), M['accent'], n)
box('TieBlade', (c[0], c[1] - 0.01, c[2] - 0.22), (0.14, 0.05, 0.36), M['accent'], n, rot=(0.12, 0, 0))
n = empty('Neck_scarf', (0, 0, NZ), necks)
torus('ScarfRing', (0, 0, NZ + 0.05), 1.03, 0.12, M['scarf'], n, rot=(0, 0, 0))
box('ScarfTail', (0.45, -1.0, NZ - 0.2), (0.22, 0.08, 0.5), M['scarf'], n, rot=(0.2, 0.25, 0))
n = empty('Neck_medal', (0, 0, NZ), necks)
tube('MedalRibbon', [surf(-0.35, 0.85, 0.02), surf(-0.15, 0.55, 0.03), surf(0, 0.35, 0.05), surf(0.15, 0.55, 0.03), surf(0.35, 0.85, 0.02)], 0.03, M['blue'], n)
c = surf(0, 0.3, 0.07)
cyl('MedalDisc', c, 0.12, 0.04, M['gold'], n, rot=(math.pi / 2, 0, 0))
star_prism('MedalStar', (c[0], c[1] - 0.02, c[2]), 0.07, 0.02, M['star'], n)
n = empty('Neck_idcard', (0, 0, NZ), necks)
tube('IdLanyard', [surf(-0.35, 0.85, 0.02), surf(-0.12, 0.55, 0.03), surf(0, 0.4, 0.05), surf(0.12, 0.55, 0.03), surf(0.35, 0.85, 0.02)], 0.022, M['blue'], n)
c = surf(0, 0.28, 0.08)
box('IdCard', c, (0.3, 0.02, 0.2), M['paper'], n, bevel=0.01)
box('IdPhoto', (c[0] - 0.08, c[1] - 0.012, c[2]), (0.08, 0.01, 0.1), M['accent'], n, bevel=0.005)

# ------------------------------------------------------------------ arms + things to hold
for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
    a = empty(nm, (0.84 * s, -0.22, 0.92), rig)
    # a stubby capsule arm that sticks out from the side, so waves and cheers read clearly
    sphere(nm + 'Mesh', (1.0 * s, -0.36, 0.7), (0.145, 0.135, 0.27), M['body'], a, rot=(0.45, -0.62 * s, 0))
    sphere(nm + 'Paw', (1.08 * s, -0.47, 0.5), (0.12, 0.11, 0.1), M['body'], a)
HX, HY, HZ = 1.05, -0.58, 0.7
hold = empty('Hold', (HX, HY, HZ), bpy.data.objects['ArmR'])

def pencil(name, body_m, L=0.95, r=0.07):
    g = empty(name, (HX, HY, HZ), hold)
    z0 = HZ - L * 0.3
    cyl(name + 'Body', (HX, HY, z0 + L / 2), r, L, body_m, g, verts=6)
    cyl(name + 'Wood', (HX, HY, z0 + L + 0.09), r * 0.98, 0.18, M['wood'], g, verts=24, r2=0.025)
    cyl(name + 'Lead', (HX, HY, z0 + L + 0.205), 0.026, 0.05, M['graphite'], g, verts=16, r2=0.0)
    cyl(name + 'Ferrule', (HX, HY, z0 - 0.05), r * 1.05, 0.1, M['metal'], g, verts=24)
    cyl(name + 'Eraser', (HX, HY, z0 - 0.15), r * 1.0, 0.12, M['eraser'], g, verts=24)
    sphere(name + 'EraserTip', (HX, HY, z0 - 0.21), (r, r, 0.04), M['eraser'], g)
    g.rotation_euler = (0.25, -0.35, 0)
    return g
pencil('Item_pencil', M['pencil'])
pencil('Item_golden', M['gold'])
g = empty('Item_highlighter', (HX, HY, 0.55), hold)
cyl('HiBody', (HX, HY, 0.6), 0.11, 0.7, M['accent'], g)
cyl('HiCap', (HX, HY, 1.02), 0.115, 0.22, M['dark'], g)
cyl('HiTip', (HX, HY, 0.2), 0.07, 0.12, M['accent'], g, r2=0.03)
g = empty('Item_pen', (HX, HY, 0.55), hold)
cyl('PenBody', (HX, HY, 0.62), 0.055, 0.85, M['blue'], g)
cyl('PenTip', (HX, HY, 1.1), 0.055, 0.12, M['metal'], g, r2=0.01)
box('PenClip', (HX, HY - 0.07, 0.75), (0.02, 0.03, 0.3), M['metal'], g, bevel=0.005)
g = empty('Item_chai', (HX, HY, 0.55), hold)
cyl('ChaiCup', (HX, HY, 0.66), 0.17, 0.3, M['cup'], g, r2=0.13)
cyl('ChaiTea', (HX, HY, 0.8), 0.16, 0.02, M['brown'], g)
torus('ChaiHandle', (HX + 0.19, HY, 0.66), 0.08, 0.025, M['cup'], g, rot=(math.pi / 2, 0, 0))
g = empty('Item_book', (HX, HY, 0.55), hold)
box('BookCover', (HX, HY, 0.7), (0.12, 0.42, 0.55), M['accent'], g, rot=(0, 0, -0.2))
box('BookPages', (HX + 0.02, HY, 0.7), (0.1, 0.4, 0.52), M['paper'], g, rot=(0, 0, -0.2), bevel=0.005)

for nm in ('Item_highlighter', 'Item_pen', 'Item_book', 'Item_chai'):
    o = bpy.data.objects[nm]; o.location.z += 0.08
    if nm != 'Item_chai': o.rotation_euler = (0.2, -0.3, 0)
sphere('Thumb', (HX - 0.02, HY - 0.1, HZ + 0.02), (0.075, 0.06, 0.07), M['body'], hold)

# ------------------------------------------------------------------ export + optional preview render
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.name.startswith(('Hat_', 'Face_', 'Neck_', 'Item_', 'Happy', 'Closed', 'Star', 'Heart', 'Spiral', 'Cross', 'Lid', 'Mouth_')):
        pass  # visibility is decided live by the extension
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_materials='EXPORT', export_texcoords=False, export_cameras=False, export_lights=False, export_extras=False)
print('exported', OUT, os.path.getsize(OUT), 'bytes', len(scene.objects), 'objects')

if PREVIEW:
    def show(prefixes_on):
        for o in scene.objects:
            n = o.name
            hide_groups = ('Hat_', 'Face_', 'Neck_', 'Item_', 'Mouth_')
            hide = any(n.startswith(p) for p in hide_groups) or any(n.startswith(p) for p in ('Happy', 'Closed', 'StarL', 'StarR', 'HeartL', 'HeartR', 'Spiral', 'Cross', 'LidL', 'LidR'))
            if any(n.startswith(p) for p in prefixes_on): hide = False
            o.hide_render = hide
            # children of hidden groups
        for o in scene.objects:
            p = o.parent
            while p:
                if p.hide_render: o.hide_render = True; break
                p = p.parent
    show(['Hat_sprout', 'Item_pencil', 'Mouth_smile'] + (sys.argv[-3].split(',') if len(sys.argv) > 4 and ',' in sys.argv[-3] else []))
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scene.collection.objects.link(cam)
    cam.location = (1.2, -5.2, 1.7); cam.rotation_euler = (math.radians(88), 0, math.radians(13)); cam.data.lens = 55
    scene.camera = cam
    for nm, loc, e, size in (('Key', (-3, -4, 5), 900, 3), ('Fill', (4, -3, 2), 300, 4), ('Rim', (0, 4, 4), 600, 2)):
        L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'AREA')); L.data.energy = e; L.data.size = size
        L.location = loc; L.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(L)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    fl = bpy.context.object; fl.data.materials.append(mat('M_Floor', hexrgb('#F6F1E7'), 0.9))
    w = bpy.data.worlds.new('W'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.95, 0.93, 0.9, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    scene.world = w
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.device = 'CPU'
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640; scene.render.resolution_y = 640
    scene.render.filepath = PREVIEW
    # soft clay look in the preview: subsurface on the body
    bsdf = M['body'].node_tree.nodes['Principled BSDF']
    bsdf.inputs['Subsurface Weight'].default_value = 0.25; bsdf.inputs['Subsurface Radius'].default_value = (0.4, 0.25, 0.2)
    bpy.ops.render.render(write_still=True)
    print('preview', PREVIEW)
