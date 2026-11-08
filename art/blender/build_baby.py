"""Builds the 3D baby, its animation clips and the rooms for "Our Little One".

Run headless (from the repo root):
    blender -b -P art/blender/build_baby.py              # export model + clips
    blender -b -P art/blender/build_baby.py -- --render  # also render room + age previews

Everything is original and made from simple shapes, so it is reproducible and license-free.

Design choices (so the same file works in three.js and SceneKit):
- The child is a hierarchy of rigid "vinyl toy" parts under pivot empties (hips, spine, head,
  shoulders, hips). Every animation is a node transform, which survives GLB and USDZ export.
- Blink and talk are NOT baked: the apps scale the `Lid_*` and `Mouth_Open` nodes live.
- All clips live on one timeline; shared/models/clips.json lists each clip's frame range.
- Age stages are applied by the apps: per-stage node scales + which hair/accessory nodes show.
- The outfit material is named `Outfit` so the apps can recolor it (wardrobe).
"""

import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "shared", "models")
ROOMS = os.path.join(ROOT, "shared", "rooms")
PREVIEWS = os.path.join(ROOT, "art", "blender", "previews")
FPS = 24
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = "--render" in ARGS

# --------------------------------------------------------------------------- scene helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    engines = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    return sc


def mat(name, color, rough=0.45, sss=0.0, metal=0.0, emit=None, alpha=1.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if sss and "Subsurface Weight" in b.inputs:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.3)
        b.inputs["Subsurface Scale"].default_value = 0.03
    if coat and "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.15
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 1.0
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    m.diffuse_color = (*color, alpha)
    return m


def hex3(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def smooth(obj, levels=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    if levels:
        mod = obj.modifiers.new("Subsurf", "SUBSURF")
        mod.levels = levels
        mod.render_levels = levels
    return obj


def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    bpy.context.collection.objects.link(e)
    e.parent = parent
    e.location = loc
    return e


def sphere(name, parent, loc, scale, material, rot=(0, 0, 0), seg=24, sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    o.parent = parent
    o.location = loc
    o.scale = scale
    o.rotation_euler = rot
    o.data.materials.append(material)
    return smooth(o, sub)


def capsule(name, parent, loc, radius, length, material, rot=(0, 0, 0)):
    """A rounded limb: a cylinder with sphere caps, pivoting at its top end."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=length)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    # move geometry so the origin sits at the top (shoulder/hip pivot)
    for v in o.data.vertices:
        v.co.z -= length / 2
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(material)
    bev = o.modifiers.new("Bevel", "BEVEL")
    bev.width = radius * 0.95
    bev.segments = 6
    bev.limit_method = "NONE"
    smooth(o, 1)
    return o


def torus_arc(name, parent, loc, major, minor, material, arc=0.5, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=10, major_radius=major, minor_radius=minor)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    # keep the lower part of the ring only (a smile)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    cut = major * math.cos(math.pi * arc / 2 + 0.0001) if arc < 1 else 99
    for v in o.data.vertices:
        v.select = v.co.y > -cut + 1e-4 if arc < 1 else False
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(material)
    return smooth(o, 1)


# --------------------------------------------------------------------------- the child


def build_baby():
    skin = mat("Skin", hex3("#FFD3B8"), rough=0.5, sss=0.25, coat=0.15)
    skin_shade = mat("SkinShade", hex3("#F4B999"), rough=0.55, sss=0.2)
    outfit = mat("Outfit", hex3("#F7B8CF"), rough=0.6)
    outfit_trim = mat("OutfitTrim", hex3("#FFFFFF"), rough=0.6)
    white = mat("EyeWhite", (0.95, 0.95, 0.95), rough=0.08, coat=0.6)
    iris = mat("Iris", hex3("#3B2A4A"), rough=0.05, coat=1.0)
    shine = mat("Shine", (1, 1, 1), rough=0.05, emit=(1, 1, 1))
    blush = mat("Blush", hex3("#FF8FA8"), rough=0.6, alpha=0.75)
    mouth = mat("Mouth", hex3("#B5445C"), rough=0.35)
    tongue = mat("Tongue", hex3("#FF8FA3"), rough=0.35)
    shoe = mat("Shoe", hex3("#5A4B6B"), rough=0.5, coat=0.4)
    hair = mat("Hair", hex3("#5B3A29"), rough=0.55, coat=0.2)
    grey = mat("HairGrey", hex3("#D7D7DE"), rough=0.6)

    root = empty("Child")
    hips = empty("Hips", root, (0, 0, 0.268))
    sphere("Body", hips, (0, 0, 0.12), (0.2, 0.17, 0.22), outfit)
    sphere("Collar", hips, (0, 0, 0.3), (0.1, 0.085, 0.03), outfit_trim)
    sphere("Belly", hips, (0, -0.135, 0.08), (0.11, 0.05, 0.12), outfit_trim)
    spine = empty("Spine", hips, (0, 0, 0.3))
    head = empty("Head", spine, (0, 0, 0.02))

    # head shape: big round toy head
    sphere("Skull", head, (0, 0, 0.27), (0.3, 0.27, 0.27), skin, seg=32)
    sphere("Cheek_L", head, (0.12, -0.13, 0.17), (0.11, 0.1, 0.09), skin)
    sphere("Cheek_R", head, (-0.12, -0.13, 0.17), (0.11, 0.1, 0.09), skin)
    sphere("Ear_L", head, (0.29, 0.0, 0.27), (0.05, 0.035, 0.07), skin_shade)
    sphere("Ear_R", head, (-0.29, 0.0, 0.27), (0.05, 0.035, 0.07), skin_shade)
    sphere("Nose", head, (0, -0.265, 0.22), (0.028, 0.02, 0.02), skin_shade)
    sphere("Blush_L", head, (0.16, -0.21, 0.17), (0.05, 0.012, 0.03), blush, rot=(0, 0, 0.55))
    sphere("Blush_R", head, (-0.16, -0.21, 0.17), (0.05, 0.012, 0.03), blush, rot=(0, 0, -0.55))

    for side, x in (("L", 0.105), ("R", -0.105)):
        eye = empty(f"Eye_{side}", head, (x, -0.225, 0.275))
        sphere(f"Sclera_{side}", eye, (0, 0, 0), (0.06, 0.035, 0.07), white)
        pupil = empty(f"Look_{side}", eye, (0, 0, 0))
        sphere(f"Iris_{side}", pupil, (0, -0.025, -0.004), (0.048, 0.022, 0.058), iris)
        sphere(f"Shine_{side}", pupil, (0.017, -0.045, 0.026), (0.014, 0.006, 0.016), shine, sub=0)
        sphere(f"Shine2_{side}", pupil, (-0.014, -0.046, -0.022), (0.007, 0.004, 0.008), shine, sub=0)
        # eyelid: scaled down on Z by the app to blink (0.02 = open, 1 = closed)
        lid = empty(f"Lid_{side}", eye, (0, -0.006, 0.07))
        lid.scale = (1, 1, 0.02)
        sphere(f"LidSkin_{side}", lid, (0, 0, -0.07), (0.068, 0.045, 0.075), skin)

    smile = torus_arc("Mouth_Smile", head, (0, -0.262, 0.185), 0.055, 0.012, mouth, arc=0.6, rot=(math.radians(82), 0, 0))
    mouth_open = empty("Mouth_Open", head, (0, -0.245, 0.15))
    mouth_open.scale = (1, 1, 0.05)  # app opens it for talking / eating
    sphere("MouthHole", mouth_open, (0, 0, 0), (0.05, 0.03, 0.045), mouth)
    sphere("Tongue", mouth_open, (0, -0.012, -0.022), (0.03, 0.02, 0.015), tongue)

    # arms pivot at the shoulders, legs at the hips
    for side, x in (("L", 1), ("R", -1)):
        shoulder = empty(f"Arm_{side}", spine, (0.17 * x, 0, -0.04))
        shoulder.rotation_euler = (0, math.radians(-28 * x), 0)
        capsule(f"Sleeve_{side}", shoulder, (0, 0, 0), 0.06, 0.17, outfit)
        sphere(f"Hand_{side}", shoulder, (0, 0, -0.19), (0.058, 0.05, 0.058), skin)
        leg = empty(f"Leg_{side}", hips, (0.09 * x, 0, 0.0))
        capsule(f"Thigh_{side}", leg, (0, 0, 0.02), 0.075, 0.2, outfit)
        sphere(f"Foot_{side}", leg, (0.005 * x, -0.04, -0.215), (0.075, 0.1, 0.05), shoe)

    # hair and accessories (the apps show the ones each stage needs)
    hair_root = empty("Hair", head, (0, 0, 0))
    tuft = sphere("Hair_Tuft", hair_root, (0.0, -0.05, 0.56), (0.035, 0.035, 0.08), hair, rot=(math.radians(-25), math.radians(-20), 0))
    sphere("Hair_Short", hair_root, (0, 0.02, 0.37), (0.305, 0.28, 0.2), hair, seg=32)
    sphere("Hair_Fringe", hair_root, (0.06, -0.19, 0.42), (0.17, 0.08, 0.07), hair, rot=(0, 0, 0.3))
    sphere("Hair_Long", hair_root, (0, 0.1, 0.2), (0.29, 0.2, 0.3), hair, seg=32)
    sphere("Hair_Grey", hair_root, (0, 0.03, 0.37), (0.31, 0.285, 0.2), grey, seg=32)

    acc = empty("Accessories", head, (0, 0, 0))
    paci = empty("Acc_Pacifier", acc, (0, -0.27, 0.16))
    sphere("Paci_Shield", paci, (0, 0, 0), (0.065, 0.015, 0.05), mat("Paci", hex3("#8FD3FF"), rough=0.2, coat=0.8))
    sphere("Paci_Ring", paci, (0, -0.02, 0), (0.03, 0.012, 0.03), mat("PaciRing", (1, 1, 1), rough=0.2))
    glasses = empty("Acc_Glasses", acc, (0, -0.25, 0.28))
    frame = mat("Frame", hex3("#6B5A4E"), rough=0.3, metal=0.3)
    for side, x in (("L", 0.105), ("R", -0.105)):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.008, major_segments=32, minor_segments=8)
        g = bpy.context.active_object
        g.name = f"Glass_{side}"
        g.parent = glasses
        g.location = (x, 0, 0)
        g.rotation_euler = (math.radians(90), 0, 0)
        g.data.materials.append(frame)
    phones = empty("Acc_Headphones", acc, (0, 0, 0.3))
    pm = mat("Phones", hex3("#3A3550"), rough=0.35, coat=0.5)
    torus_arc("Phones_Band", phones, (0, 0.02, -0.03), 0.31, 0.02, pm, arc=0.999, rot=(math.radians(-90), 0, 0))
    sphere("Phones_L", phones, (0.3, 0, -0.03), (0.04, 0.07, 0.08), pm)
    sphere("Phones_R", phones, (-0.3, 0, -0.03), (0.04, 0.07, 0.08), pm)
    hat = empty("Acc_Cap", acc, (0, 0, 0.42))
    sphere("Cap_Dome", hat, (0, 0.01, 0.0), (0.3, 0.29, 0.17), mat("Cap", hex3("#F2C14E"), rough=0.6))
    sphere("Cap_Bobble", hat, (0, 0.01, 0.18), (0.06, 0.06, 0.06), mat("CapBobble", hex3("#4A90E2"), rough=0.8))

    body_acc = empty("BodyAccessories", spine, (0, 0, 0))
    tie = empty("Acc_Tie", body_acc, (0, -0.17, -0.06))
    sphere("Tie", tie, (0, 0, 0), (0.035, 0.012, 0.11), mat("TieRed", hex3("#C0395B"), rough=0.5))
    pack = empty("Acc_Backpack", body_acc, (0, 0.17, -0.12))
    sphere("Pack", pack, (0, 0, 0), (0.15, 0.08, 0.16), mat("Pack", hex3("#E2574C"), rough=0.6))
    ring = empty("Acc_Ring", root, (0, 0, 0))  # sits on the left hand
    bpy.ops.mesh.primitive_torus_add(major_radius=0.025, minor_radius=0.007)
    r = bpy.context.active_object
    r.name = "Ring"
    r.parent = bpy.data.objects["Hand_L"]
    r.location = (0, 0, 0.6)
    r.data.materials.append(mat("Gold", hex3("#E8C15A"), rough=0.2, metal=1.0))
    ring.parent = bpy.data.objects["Hand_L"]
    r.parent = ring

    # Apply modifiers so the export is plain meshes (smaller, identical in both apps).
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.modifiers:
            bpy.context.view_layer.objects.active = o
            for m in list(o.modifiers):
                bpy.ops.object.modifier_apply(modifier=m.name)
    return root


# --------------------------------------------------------------------------- animation

CLIPS = {}


def key(name, frame, loc=None, rot=None, scale=None):
    o = bpy.data.objects[name]
    if loc is not None:
        o.location = loc
        o.keyframe_insert("location", frame=frame)
    if rot is not None:
        o.rotation_euler = Euler([math.radians(a) for a in rot])
        o.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        o.scale = scale
        o.keyframe_insert("scale", frame=frame)


REST = {}


def remember_rest():
    for n in ("Child", "Hips", "Spine", "Head", "Arm_L", "Arm_R", "Leg_L", "Leg_R"):
        o = bpy.data.objects[n]
        REST[n] = (tuple(o.location), tuple(math.degrees(a) for a in o.rotation_euler), tuple(o.scale))


def rest_all(frame):
    for n, (loc, rot, sc) in REST.items():
        key(n, frame, loc=loc, rot=rot, scale=sc)


def clip(name, length, poses, loop=True):
    """poses: list of (t 0..1, {node: dict(loc=, rot=, scale=) offsets from rest})."""
    start = max([0] + [c["end"] + 2 for c in CLIPS.values()]) + 1
    end = start + length
    rest_all(start)
    rest_all(end)
    for t, nodes in poses:
        f = round(start + t * length)
        for n, p in nodes.items():
            loc, rot, sc = REST[n]
            if n.startswith("Arm_") and "rot" in p:
                # clips are written as "positive = raise outward"; on these pivots outward is negative Y
                rx, ry, rz = p["rot"]
                p = {**p, "rot": (rx, -ry, rz)}
            key(
                n,
                f,
                loc=tuple(a + b for a, b in zip(loc, p.get("loc", (0, 0, 0)))),
                rot=tuple(a + b for a, b in zip(rot, p.get("rot", (0, 0, 0)))),
                scale=tuple(a * b for a, b in zip(sc, p.get("scale", (1, 1, 1)))),
            )
    CLIPS[name] = {"start": start, "end": end, "loop": loop}


def animate():
    remember_rest()
    L, R = 1, -1
    clip("idle", 48, [
        (0.25, {"Spine": {"rot": (0, 3, 0), "scale": (1, 1, 1.02)}, "Head": {"rot": (2, -4, 3)}, "Arm_L": {"rot": (0, 3, 0)}, "Arm_R": {"rot": (0, -3, 0)}}),
        (0.5, {"Spine": {"scale": (1, 1, 1)}, "Head": {"rot": (0, 0, 0)}}),
        (0.75, {"Spine": {"rot": (0, -3, 0), "scale": (1, 1, 1.02)}, "Head": {"rot": (2, 4, -3)}, "Arm_L": {"rot": (0, -3, 0)}, "Arm_R": {"rot": (0, 3, 0)}}),
    ])
    clip("happy", 26, [
        (0.15, {"Child": {"scale": (1.15, 1.15, 0.82)}, "Arm_L": {"rot": (0, 10, 0)}, "Arm_R": {"rot": (0, -10, 0)}}),
        (0.45, {"Child": {"loc": (0, 0, 0.32), "scale": (0.9, 0.9, 1.15)}, "Arm_L": {"rot": (0, 140, 0)}, "Arm_R": {"rot": (0, -140, 0)}, "Leg_L": {"rot": (-20, 0, 0)}, "Leg_R": {"rot": (20, 0, 0)}, "Head": {"rot": (-12, 0, 0)}}),
        (0.75, {"Child": {"scale": (1.12, 1.12, 0.86)}, "Arm_L": {"rot": (0, 60, 0)}, "Arm_R": {"rot": (0, -60, 0)}}),
        (0.88, {"Child": {"scale": (0.97, 0.97, 1.04)}}),
    ], loop=False)
    clip("eat", 40, [
        (0.15, {"Head": {"rot": (10, 0, 0)}, "Arm_R": {"rot": (-70, -40, 0)}}),
        (0.3, {"Head": {"rot": (-6, 0, 0)}, "Arm_R": {"rot": (-110, -30, 0)}}),
        (0.45, {"Head": {"rot": (6, 0, 2)}, "Arm_R": {"rot": (-90, -30, 0)}}),
        (0.6, {"Head": {"rot": (-6, 0, -2)}}),
        (0.75, {"Head": {"rot": (6, 0, 2)}}),
        (0.9, {"Head": {"rot": (-3, 0, 0)}, "Arm_L": {"rot": (-30, 20, 0)}}),
    ], loop=False)
    clip("sleep", 60, [
        (0.0, {"Head": {"rot": (14, 0, 12)}, "Spine": {"rot": (8, 0, 0)}, "Arm_L": {"rot": (0, 8, 0)}, "Arm_R": {"rot": (0, -8, 0)}}),
        (0.5, {"Head": {"rot": (17, 0, 13)}, "Spine": {"rot": (10, 0, 0), "scale": (1.02, 1.02, 1.03)}}),
        (1.0, {"Head": {"rot": (14, 0, 12)}, "Spine": {"rot": (8, 0, 0)}, "Arm_L": {"rot": (0, 8, 0)}, "Arm_R": {"rot": (0, -8, 0)}}),
    ])
    clip("wave", 36, [
        (0.15, {"Arm_R": {"rot": (0, -150, 0)}, "Head": {"rot": (0, 0, -6)}}),
        (0.3, {"Arm_R": {"rot": (0, -150, 25)}}),
        (0.45, {"Arm_R": {"rot": (0, -150, -25)}}),
        (0.6, {"Arm_R": {"rot": (0, -150, 25)}}),
        (0.75, {"Arm_R": {"rot": (0, -150, -25)}, "Head": {"rot": (0, 0, -6)}}),
    ], loop=False)
    clip("dance", 48, [
        (0.125, {"Hips": {"loc": (0.05, 0, 0), "rot": (0, 8, 15)}, "Head": {"rot": (0, -8, -10)}, "Arm_L": {"rot": (0, 120, 0)}, "Arm_R": {"rot": (0, -40, 0)}, "Child": {"scale": (1.05, 1.05, 0.95)}}),
        (0.25, {"Child": {"loc": (0, 0, 0.08)}}),
        (0.375, {"Hips": {"loc": (-0.05, 0, 0), "rot": (0, -8, -15)}, "Head": {"rot": (0, 8, 10)}, "Arm_L": {"rot": (0, 40, 0)}, "Arm_R": {"rot": (0, -120, 0)}, "Child": {"scale": (1.05, 1.05, 0.95)}}),
        (0.5, {"Child": {"loc": (0, 0, 0.08)}}),
        (0.625, {"Hips": {"loc": (0.05, 0, 0), "rot": (0, 8, 15)}, "Head": {"rot": (0, -8, -10)}, "Arm_L": {"rot": (0, 120, 0)}, "Arm_R": {"rot": (0, -40, 0)}, "Child": {"scale": (1.05, 1.05, 0.95)}}),
        (0.75, {"Child": {"loc": (0, 0, 0.08)}}),
        (0.875, {"Hips": {"loc": (-0.05, 0, 0), "rot": (0, -8, -15)}, "Head": {"rot": (0, 8, 10)}, "Arm_L": {"rot": (0, 40, 0)}, "Arm_R": {"rot": (0, -120, 0)}}),
    ])
    clip("sad", 48, [
        (0.2, {"Head": {"rot": (18, 0, 0)}, "Spine": {"rot": (10, 0, 0)}, "Arm_L": {"rot": (0, -18, 0)}, "Arm_R": {"rot": (0, 18, 0)}}),
        (0.6, {"Head": {"rot": (20, 0, 4)}, "Spine": {"rot": (11, 0, 0)}, "Arm_L": {"rot": (0, -18, 0)}, "Arm_R": {"rot": (0, 18, 0)}}),
        (0.9, {"Head": {"rot": (18, 0, -2)}, "Spine": {"rot": (10, 0, 0)}, "Arm_L": {"rot": (0, -18, 0)}, "Arm_R": {"rot": (0, 18, 0)}}),
    ])
    clip("listen", 30, [
        (0.3, {"Head": {"rot": (-4, 0, 16)}, "Spine": {"rot": (0, 0, 4)}, "Arm_L": {"rot": (-40, 40, 20)}}),
        (0.8, {"Head": {"rot": (-4, 0, 18)}, "Spine": {"rot": (0, 0, 4)}, "Arm_L": {"rot": (-40, 40, 20)}}),
    ])
    clip("talk", 24, [
        (0.25, {"Head": {"rot": (-5, 3, 4)}, "Arm_L": {"rot": (0, 40, 0)}, "Arm_R": {"rot": (0, -20, 0)}}),
        (0.5, {"Head": {"rot": (3, -3, -2)}}),
        (0.75, {"Head": {"rot": (-4, 2, -4)}, "Arm_L": {"rot": (0, 20, 0)}, "Arm_R": {"rot": (0, -40, 0)}}),
    ])
    clip("splash", 36, [
        (0.15, {"Arm_L": {"rot": (0, 100, 0)}, "Arm_R": {"rot": (0, -100, 0)}, "Child": {"scale": (1.08, 1.08, 0.92)}}),
        (0.3, {"Arm_L": {"rot": (0, 40, 0)}, "Arm_R": {"rot": (0, -40, 0)}, "Head": {"rot": (-10, 0, 6)}}),
        (0.45, {"Arm_L": {"rot": (0, 110, 0)}, "Arm_R": {"rot": (0, -110, 0)}, "Child": {"scale": (1.08, 1.08, 0.92)}}),
        (0.6, {"Arm_L": {"rot": (0, 40, 0)}, "Arm_R": {"rot": (0, -40, 0)}, "Head": {"rot": (-10, 0, -6)}}),
        (0.8, {"Arm_L": {"rot": (0, 90, 0)}, "Arm_R": {"rot": (0, -90, 0)}}),
    ], loop=False)
    clip("giggle", 30, [
        (0.1, {"Spine": {"rot": (-8, 0, 6)}, "Head": {"rot": (-14, 0, 8)}, "Arm_L": {"rot": (-50, 30, 0)}, "Arm_R": {"rot": (-50, -30, 0)}}),
        (0.25, {"Spine": {"rot": (-6, 0, -6)}, "Head": {"rot": (-12, 0, -8)}}),
        (0.4, {"Spine": {"rot": (-8, 0, 6)}, "Head": {"rot": (-14, 0, 8)}}),
        (0.55, {"Spine": {"rot": (-6, 0, -6)}, "Head": {"rot": (-12, 0, -8)}}),
        (0.75, {"Spine": {"rot": (-3, 0, 0)}, "Head": {"rot": (-5, 0, 0)}, "Arm_L": {"rot": (-20, 10, 0)}, "Arm_R": {"rot": (-20, -10, 0)}}),
    ], loop=False)
    clip("fall", 44, [
        (0.15, {"Child": {"rot": (0, 0, 0), "scale": (1.1, 1.1, 0.9)}, "Arm_L": {"rot": (0, 60, 0)}, "Arm_R": {"rot": (0, -60, 0)}}),
        (0.35, {"Child": {"loc": (0, 0.05, -0.05), "rot": (-75, 0, 0)}, "Arm_L": {"rot": (0, 120, 0)}, "Arm_R": {"rot": (0, -120, 0)}, "Leg_L": {"rot": (40, 0, 0)}, "Leg_R": {"rot": (40, 0, 0)}}),
        (0.6, {"Child": {"loc": (0, 0.05, -0.05), "rot": (-75, 0, 0)}, "Head": {"rot": (-10, 0, 10)}}),
        (0.85, {"Child": {"scale": (1.06, 1.06, 0.94)}, "Head": {"rot": (6, 0, -6)}}),
    ], loop=False)
    # smooth, toy-like motion: ease in and out of every key
    for o in bpy.data.objects:
        ad = o.animation_data
        if not ad or not ad.action:
            continue
        for fc in getattr(ad.action, "fcurves", []) or []:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.easing = "AUTO"
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = max(c["end"] for c in CLIPS.values())


# Per-stage proportions and visible extras, mirrored by the apps (shared/models/stages.json).
STAGES = {
    "newborn": {"scale": 0.62, "head": 1.18, "body": 0.9, "limbs": 0.8, "hair": None, "acc": ["Acc_Pacifier"], "outfit": "#F7B8CF"},
    "toddler": {"scale": 0.72, "head": 1.12, "body": 0.95, "limbs": 0.88, "hair": "Hair_Tuft", "acc": [], "outfit": "#FFD36E"},
    "child": {"scale": 0.84, "head": 1.05, "body": 1.0, "limbs": 1.0, "hair": "Hair_Short", "acc": ["Acc_Backpack"], "outfit": "#7CCFA2"},
    "teen": {"scale": 0.95, "head": 0.98, "body": 1.04, "limbs": 1.12, "hair": ["Hair_Long", "Hair_Short", "Hair_Fringe"], "acc": ["Acc_Headphones"], "outfit": "#9C8CFF"},
    "adult": {"scale": 1.0, "head": 0.94, "body": 1.08, "limbs": 1.2, "hair": "Hair_Short", "acc": ["Acc_Tie"], "outfit": "#5FB3D4"},
    "partnered": {"scale": 1.0, "head": 0.94, "body": 1.08, "limbs": 1.2, "hair": "Hair_Short", "acc": ["Acc_Ring"], "outfit": "#FF8FAB"},
    "elder": {"scale": 0.95, "head": 0.96, "body": 1.1, "limbs": 1.12, "hair": "Hair_Grey", "acc": ["Acc_Glasses"], "outfit": "#C9A27E"},
}
HAIRS = ["Hair_Tuft", "Hair_Short", "Hair_Fringe", "Hair_Long", "Hair_Grey"]
ACCS = ["Acc_Pacifier", "Acc_Glasses", "Acc_Headphones", "Acc_Cap", "Acc_Tie", "Acc_Backpack", "Acc_Ring"]


def show(obj, visible):
    obj.hide_render = not visible
    obj.hide_viewport = not visible
    for c in obj.children_recursive:
        c.hide_render = not visible
        c.hide_viewport = not visible


def apply_stage(stage):
    s = STAGES[stage]
    o = bpy.data.objects
    o["Child"].scale = (s["scale"],) * 3
    o["Head"].scale = (s["head"],) * 3
    for n in ("Arm_L", "Arm_R", "Leg_L", "Leg_R"):
        o[n].scale = (1, 1, s["limbs"])
    o["Body"].scale = (0.2 * s["body"], 0.17 * s["body"], 0.22)
    for h in HAIRS:
        wanted = s["hair"] if isinstance(s["hair"], list) else [s["hair"]]
        show(o[h], h in wanted or (h == "Hair_Fringe" and "Hair_Short" in wanted))
    for a in ACCS:
        show(o[a], a in s["acc"])
    bpy.data.materials["Outfit"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*hex3(s["outfit"]), 1)


# --------------------------------------------------------------------------- rooms


def box(name, loc, size, material, bevel=0.02, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.data.materials.append(material)
    o.parent = parent
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 4
        b.affect = "EDGES"
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def cyl(name, loc, r, h, material, parent=None, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    o.parent = parent
    b = o.modifiers.new("Bevel", "BEVEL")
    b.width = min(r, h) * 0.2
    b.segments = 4
    for p in o.data.polygons:
        p.use_smooth = True
    return o


ROOMS_DEF = {
    "living": {"wall": "#8DB8E8", "floor": "#D99A63", "rug": "#EF6F5E"},
    "kitchen": {"wall": "#FFD27A", "floor": "#C9AE8F", "rug": "#4FB98A"},
    "bathroom": {"wall": "#7FD6E0", "floor": "#DDEFF3", "rug": "#F2913A"},
    "bedroom": {"wall": "#B9A3EE", "floor": "#B7845B", "rug": "#6FB1EA"},
    "wardrobe": {"wall": "#F4B8C6", "floor": "#D9AE86", "rug": "#9C6FE0"},
}


def build_room(kind):
    col = bpy.data.collections.new(f"Room_{kind}")
    bpy.context.scene.collection.children.link(col)
    layer = bpy.context.view_layer.layer_collection.children[col.name]
    bpy.context.view_layer.active_layer_collection = layer
    d = ROOMS_DEF[kind]
    wall = mat(f"Wall_{kind}", hex3(d["wall"]), rough=0.9)
    floor = mat(f"Floor_{kind}", hex3(d["floor"]), rough=0.8)
    rug = mat(f"Rug_{kind}", hex3(d["rug"]), rough=0.95)
    white = mat("TrimWhite", hex3("#FFFFFF"), rough=0.5)
    wood = mat("Wood", hex3("#C58B5A"), rough=0.5, coat=0.3)
    box("Floor", (0, 0.5, -0.02), (6, 6, 0.04), floor, 0)
    box("BackWall", (0, 2.2, 2.4), (6, 0.1, 5.0), wall, 0)
    box("SideWall_L", (-2.2, 0.5, 2.4), (0.1, 4, 5.0), wall, 0)
    box("SideWall_R", (2.2, 0.5, 2.4), (0.1, 4, 5.0), wall, 0)
    box("Skirting", (0, 2.13, 0.06), (4.4, 0.04, 0.12), white, 0.01)
    cyl("Rug", (0, 0.15, 0.005), 0.95, 0.02, rug, verts=64)
    window_glass = mat("Glass", hex3("#9ED8FF"), rough=0.05, emit=hex3("#9ED8FF"))
    if kind in ("living", "kitchen", "bedroom"):
        box("Window", (-1.05, 2.14, 1.85), (0.95, 0.04, 0.85), window_glass, 0.01)
        box("WindowFrameH", (-1.05, 2.12, 1.85), (1.02, 0.05, 0.05), white, 0.01)
        box("WindowFrameV", (-1.05, 2.12, 1.85), (0.05, 0.05, 0.92), white, 0.01)
        box("WindowSill", (-1.05, 2.05, 1.4), (1.1, 0.16, 0.05), white, 0.01)
    if kind == "living":
        sofa = mat("Sofa", hex3("#F2A541"), rough=0.8)
        box("SofaSeat", (1.05, 1.55, 0.28), (0.9, 0.7, 0.3), sofa, 0.12)
        box("SofaBack", (1.05, 1.9, 0.62), (0.9, 0.22, 0.6), sofa, 0.1)
        box("SofaArm", (1.45, 1.55, 0.45), (0.18, 0.7, 0.45), sofa, 0.08)
        tv = mat("TVBody", hex3("#5BC8A8"), rough=0.4, coat=0.5)
        box("TVTable", (-1.1, 1.6, 0.25), (0.8, 0.45, 0.5), wood, 0.04)
        box("TV", (-1.1, 1.65, 0.8), (0.65, 0.4, 0.5), tv, 0.08)
        box("TVScreen", (-1.1, 1.44, 0.82), (0.5, 0.02, 0.36), mat("Screen", hex3("#2A3550"), rough=0.1, coat=1.0), 0.02)
        cyl("Pot", (1.5, 0.75, 0.18), 0.16, 0.36, mat("Pot", hex3("#E07A5F"), rough=0.6))
        sphere("Plant", None, (1.5, 0.75, 0.55), (0.26, 0.26, 0.3), mat("Leaf", hex3("#5DAA68"), rough=0.7))
        cyl("LampCord", (0.3, 1.7, 2.7), 0.01, 1.2, white)
        cyl("LampShade", (0.3, 1.7, 2.05), 0.22, 0.2, mat("LampShade", hex3("#FFD66B"), rough=0.6, emit=hex3("#FFD66B")))
    elif kind == "kitchen":
        fridge = mat("Fridge", hex3("#F4F7FB"), rough=0.25, coat=0.6)
        box("Fridge", (1.25, 1.7, 0.95), (0.8, 0.7, 1.9), fridge, 0.1)
        box("FridgeHandle", (0.9, 1.33, 1.2), (0.04, 0.04, 0.5), mat("Chrome", (0.8, 0.8, 0.85), rough=0.2, metal=1.0), 0.01)
        box("Counter", (-1.0, 1.85, 0.45), (1.6, 0.6, 0.9), wood, 0.04)
        box("CounterTop", (-1.0, 1.85, 0.92), (1.7, 0.66, 0.06), white, 0.02)
        cyl("Table", (0, 0.05, 0.35), 0.55, 0.06, wood)
        cyl("TableLeg", (0, 0.05, 0.17), 0.06, 0.34, wood)
        sphere("Apple", None, (-0.2, 0.0, 0.43), (0.06, 0.06, 0.06), mat("Apple", hex3("#E5484D"), rough=0.3, coat=0.6))
        sphere("Orange", None, (0.15, 0.1, 0.43), (0.06, 0.06, 0.06), mat("Orange", hex3("#F2A33A"), rough=0.4))
    elif kind == "bathroom":
        tile = mat("Tile", hex3("#A6E3EA"), rough=0.15, coat=0.6)
        for i in range(-4, 5):
            box(f"TileLine{i}", (i * 0.45, 2.13, 1.3), (0.015, 0.02, 2.6), white, 0)
        box("TileBand", (0, 2.13, 1.3), (4.4, 0.02, 0.03), white, 0)
        tub = mat("Tub", hex3("#FFFFFF"), rough=0.15, coat=0.8)
        box("Tub", (0.95, 1.5, 0.32), (1.2, 0.75, 0.64), tub, 0.2)
        box("TubWater", (0.95, 1.5, 0.6), (1.0, 0.58, 0.05), mat("Water", hex3("#7FD3F0"), rough=0.02, coat=1.0), 0.1)
        cyl("ShowerPipe", (1.3, 1.95, 1.4), 0.025, 1.4, mat("Chrome", (0.8, 0.8, 0.85), rough=0.2, metal=1.0))
        cyl("ShowerHead", (1.3, 1.8, 2.1), 0.12, 0.05, mat("Chrome", (0.8, 0.8, 0.85), rough=0.2, metal=1.0))
        sphere("Duck", None, (0.6, 1.3, 0.72), (0.09, 0.08, 0.08), mat("Duck", hex3("#FFD23F"), rough=0.3, coat=0.6))
        box("Mirror", (-1.0, 2.1, 1.55), (0.7, 0.03, 0.8), mat("Mirror", hex3("#DCEBFA"), rough=0.05, metal=0.6, coat=1.0), 0.05)
        box("Sink", (-1.0, 1.9, 0.75), (0.7, 0.4, 0.2), tub, 0.08)
    elif kind == "bedroom":
        bed = mat("Bed", hex3("#8EC5F0"), rough=0.85)
        box("BedFrame", (1.05, 1.2, 0.22), (1.2, 1.9, 0.3), wood, 0.06)
        box("Mattress", (1.05, 1.2, 0.45), (1.1, 1.8, 0.2), bed, 0.1)
        box("Pillow", (1.05, 1.9, 0.62), (0.7, 0.3, 0.14), mat("Pillow", hex3("#FFFFFF"), rough=0.9), 0.06)
        box("Headboard", (1.05, 2.12, 0.8), (1.25, 0.08, 0.9), wood, 0.08)
        box("Nightstand", (0.35, 1.9, 0.3), (0.45, 0.4, 0.6), wood, 0.04)
        cyl("NightLamp", (0.35, 1.9, 0.75), 0.12, 0.25, mat("LampShade", hex3("#FFD66B"), rough=0.6, emit=hex3("#FFD66B")))
        for i, (x, z) in enumerate([(-1.6, 2.6), (-0.6, 2.85), (0.4, 2.55)]):
            sphere(f"Star{i}", None, (x, 2.1, z), (0.06, 0.02, 0.06), mat("StarGlow", hex3("#FFF3B0"), emit=hex3("#FFF3B0")))
    elif kind == "wardrobe":
        rack = mat("Rack", hex3("#9C7A5B"), rough=0.4)
        box("Closet", (-1.05, 2.0, 1.1), (1.4, 0.3, 2.2), mat("Closet", hex3("#F7EEE6"), rough=0.6), 0.06)
        cyl("Rail", (-1.05, 1.5, 1.9), 0.02, 1.2, rack).rotation_euler = (0, math.radians(90), 0)
        for i, c in enumerate(["#F28F7C", "#7CC6A6", "#8EC5F0", "#F2C14E", "#B48EE0"]):
            box(f"Shirt{i}", (-1.55 + i * 0.25, 1.5, 1.55), (0.18, 0.05, 0.6), mat(f"Shirt{i}", hex3(c), rough=0.8), 0.05)
        box("Mirror", (1.05, 2.1, 1.3), (0.8, 0.03, 1.7), mat("Mirror", hex3("#DCEBFA"), rough=0.05, metal=0.6, coat=1.0), 0.08)
        cyl("Stool", (1.05, 1.2, 0.2), 0.3, 0.4, mat("Stool", hex3("#F28F7C"), rough=0.7))
    return col


# --------------------------------------------------------------------------- lights + camera


def lights_and_camera(night=False):
    sc = bpy.context.scene
    world = bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*(hex3("#1B2240") if night else hex3("#FFF3E6")), 1)
    bg.inputs["Strength"].default_value = 0.3 if night else 0.55

    def area(name, loc, energy, color, size, target=(0, 0.8, 0.8)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.color = color
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = loc
        direction = Vector(target) - Vector(loc)
        lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return lo

    if night:
        area("Moon", (-1.6, -1.5, 2.6), 120, hex3("#9DB4FF"), 3)
        area("Lamp", (0.6, 1.2, 1.2), 60, hex3("#FFC27A"), 0.6)
    else:
        area("Key", (-2.0, -2.2, 2.8), 380, hex3("#FFE9CF"), 2.5)
        area("Fill", (2.4, -1.6, 1.6), 90, hex3("#D6E6FF"), 3)
        area("Rim", (0.0, 1.6, 2.6), 260, hex3("#FFE6F0"), 2)
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 30
    cam = bpy.data.objects.new("Camera", cam_data)
    sc.collection.objects.link(cam)
    cam.location = (0, -3.7, 1.2)
    cam.rotation_euler = (math.radians(83), 0, 0)
    sc.camera = cam
    sc.render.resolution_x = 750
    sc.render.resolution_y = 1334
    sc.render.film_transparent = False
    if hasattr(sc, "eevee"):
        ev = sc.eevee
        for attr, val in (("use_gtao", True), ("use_shadows", True), ("taa_render_samples", 64), ("use_raytracing", True)):
            if hasattr(ev, attr):
                setattr(ev, attr, val)
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    looks = [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items]
    punchy = next((l for l in looks if "Punchy" in l), None)
    if punchy:
        sc.view_settings.look = punchy
    sc.view_settings.exposure = -0.35


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    st = bpy.context.scene.render.image_settings
    if path.endswith(".jpg"):
        st.file_format = "JPEG"
        st.quality = 86
    else:
        st.file_format = "PNG"
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------------------- main


def export_model():
    os.makedirs(MODELS, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.name == "Child" or "Child" in [p.name for p in getattr(o, "parent_chain", [])]:
            pass
    # select the child hierarchy only
    child = bpy.data.objects["Child"]
    for o in [child, *child.children_recursive]:
        o.hide_viewport = False
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = child
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(MODELS, "baby.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="SCENE",
        export_force_sampling=True,
        export_frame_range=True,
        export_apply=True,
        export_yup=True,
    )
    try:
        bpy.ops.wm.usd_export(
            filepath=os.path.join(MODELS, "baby.usdz"),
            selected_objects_only=True,
            export_animation=True,
            export_materials=True,
            generate_preview_surface=True,
        )
    except Exception as e:  # keep going: the GLB is the source of truth
        print("USDZ export failed:", e)
    with open(os.path.join(MODELS, "clips.json"), "w") as f:
        json.dump({"fps": FPS, "clips": CLIPS}, f, indent=2)
    with open(os.path.join(MODELS, "stages.json"), "w") as f:
        json.dump({"stages": STAGES, "hairs": HAIRS, "accessories": ACCS}, f, indent=2)


def main():
    reset()
    build_baby()
    animate()
    export_model()
    if not RENDER:
        return
    # rooms: each rendered empty (backgrounds for the apps), plus age previews in the living room
    for kind in ROOMS_DEF:
        reset()
        build_room(kind)
        lights_and_camera()
        render(os.path.join(ROOMS, f"{kind}.jpg"))
        if kind == "bedroom":
            reset()
            build_room(kind)
            lights_and_camera(night=True)
            render(os.path.join(ROOMS, "bedroom_night.jpg"))
    for stage in STAGES:
        reset()
        build_room("living")
        build_baby()
        animate()
        apply_stage(stage)
        bpy.context.scene.frame_set(1)
        holder = empty("Place", None, (0, -1.25, 0))
        bpy.data.objects["Child"].parent = holder
        lights_and_camera()
        render(os.path.join(PREVIEWS, f"stage_{stage}.png"))


main()

if "--clips" in ARGS:
    # one mid-clip frame per animation, to eyeball the motion
    for name in ("happy", "eat", "sleep", "wave", "dance", "sad", "listen", "fall"):
        reset()
        build_room("living")
        build_baby()
        animate()
        apply_stage("toddler")
        holder = empty("Place", None, (0, -1.25, 0))
        bpy.data.objects["Child"].parent = holder
        c = CLIPS[name]
        bpy.context.scene.frame_set(int(c["start"] + (c["end"] - c["start"]) * 0.4))
        lights_and_camera()
        bpy.context.scene.render.resolution_percentage = 50
        render(os.path.join(PREVIEWS, f"clip_{name}.png"))
