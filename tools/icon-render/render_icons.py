"""Render the original Tideland inventory icon set in headless Blender.

Run with: blender --background --python tools/icon-render/render_icons.py
The scene and output are deterministic; no external assets are required.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
CATALOG = os.path.join(os.path.dirname(__file__), "catalog.json")
OUTPUT = os.path.join(ROOT, "public/assets/items")
IDS = json.load(open(CATALOG, encoding="utf8"))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
only = set(args[1:]) if args and args[0] == "--ids" else None

PALETTE = {
    "iron": (0.20, 0.27, 0.27, 1), "steel": (0.42, 0.50, 0.48, 1),
    "dark": (0.075, 0.105, 0.10, 1), "wood": (0.31, 0.19, 0.105, 1),
    "woodlight": (0.53, 0.34, 0.18, 1), "cloth": (0.24, 0.32, 0.25, 1),
    "leather": (0.31, 0.22, 0.14, 1), "copper": (0.60, 0.31, 0.16, 1),
    "sea": (0.18, 0.43, 0.42, 1), "stone": (0.36, 0.39, 0.37, 1),
    "gold": (0.72, 0.52, 0.19, 1), "red": (0.54, 0.15, 0.11, 1),
    "berry": (0.44, 0.12, 0.19, 1), "meat": (0.56, 0.24, 0.18, 1),
    "fiber": (0.56, 0.47, 0.28, 1), "white": (0.73, 0.72, 0.59, 1),
    "green": (0.23, 0.39, 0.18, 1), "yellow": (0.76, 0.58, 0.15, 1)
}
MATS = {}

def material(name, color, metallic=0.0, roughness=0.6):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = color
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = roughness
    MATS[name] = m
    return m

def assign(obj, mat):
    if mat: obj.data.materials.append(mat)
    return obj

def bevel(obj, width=0.06, segments=2):
    if obj.type == "MESH":
        mod = obj.modifiers.new("worn softened edges", "BEVEL")
        mod.width, mod.segments = width, segments
        mod = obj.modifiers.new("weighted product normals", "WEIGHTED_NORMAL")
    return obj

def cube(name, loc, scale, mat, bevel_width=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, mat); return bevel(o, bevel_width)

def cyl(name, loc, radius, depth, mat, vertices=16, axis="Z", bevel_width=0.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object; o.name=name
    if axis == "X": o.rotation_euler[1] = math.pi/2
    elif axis == "Y": o.rotation_euler[0] = math.pi/2
    assign(o,mat); return bevel(o,bevel_width)

def ico(name, loc, scale, mat, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;assign(o,mat)
    bpy.ops.object.shade_smooth();return o

def rod(name, a, b, radius, mat, vertices=12):
    mid=(Vector(a)+Vector(b))/2; delta=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=mid)
    o=bpy.context.object;o.name=name;o.rotation_euler=delta.to_track_quat("Z","Y").to_euler();assign(o,mat)
    return bevel(o, radius*.18, 2)

def poly_prism(name, outline, depth, mat, bevel_width=0.025):
    count=len(outline)
    verts=[(x,-depth/2,z) for x,z in outline]+[(x,depth/2,z) for x,z in outline]
    faces=[tuple(range(count)),tuple(range(count,2*count))]
    faces.extend((i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count))
    mesh=bpy.data.meshes.new(name+" mesh");mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    return bevel(obj,bevel_width,2)

def torus(name, loc, major, minor, mat, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=20,minor_segments=8,location=loc)
    o=bpy.context.object;o.name=name
    if rotation:o.rotation_euler=rotation
    assign(o,mat);return o

def clear_scene():
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)

def build(item):
    iron=material("salted iron",PALETTE["iron"],.72,.35);steel=material("brushed steel",PALETTE["steel"],.82,.26)
    wood=material("weathered ash",PALETTE["wood"],.05,.74);wl=material("cut ash",PALETTE["woodlight"],.08,.63)
    cloth=material("field canvas",PALETTE["cloth"],0,.9);leather=material("oil leather",PALETTE["leather"],0,.76)
    copper=material("oxidized copper",PALETTE["copper"],.58,.39);sea=material("enamel teal",PALETTE["sea"],.35,.3)
    stone=material("coastal stone",PALETTE["stone"],.05,.9);gold=material("sulfur brass",PALETTE["gold"],.3,.5)
    red=material("signal red",PALETTE["red"],.1,.4);berry=material("berry skin",PALETTE["berry"],.05,.33)
    meat=material("fresh meat",PALETTE["meat"],0,.45);fiber=material("plant fiber",PALETTE["fiber"],0,.85)
    white=material("aged ceramic",PALETTE["white"],.03,.63);green=material("wild leaf",PALETTE["green"],0,.82)
    dark=material("charcoal rubber",PALETTE["dark"],.12,.65)
    # Long-handled tools and weapons are framed diagonally for quick recognition.
    if item in ("hatchet","pickaxe","hammer","quarryMaul","spear","torch","arrow","docksideCleaver"):
        rod("haft",(-.26,-.02,-.62),(.28,.02,.58),.075,wood)
        if item=="hatchet":
            poly_prism("forged hatchet head",[(.22,.54),(.29,.7),(.57,.65),(.73,.5),(.61,.35),(.29,.32)],.19,steel,.035)
            poly_prism("sharpened cutting edge",[(.57,.65),(.73,.5),(.61,.35)],.2,iron,.018)
        elif item in ("pickaxe","quarryMaul"):
            cube("mining head",(.33,0,.53),(.53,.18,.2),steel,.08);cube("striking face",(.61,0,.53),(.12,.22,.25),iron,.035)
            if item=="pickaxe":
                bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.12,radius2=0,depth=.45,location=(.61,0,.78));assign(bpy.context.object,steel)
        elif item=="hammer": cube("hammer head",(.35,0,.56),(.42,.22,.27),steel,.055)
        elif item=="spear":
            bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.17,radius2=0,depth=.48,location=(.31,0,.75));assign(bpy.context.object,steel)
        elif item=="arrow":
            rod("arrow shaft",(-.2,0,-.5),(.2,0,.5),.035,wl)
            bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.09,radius2=0,depth=.22,location=(.25,0,.63));assign(bpy.context.object,steel)
        elif item=="torch":
            cyl("resin bundle",(.32,0,.63),.13,.33,leather,10);ico("ember",(.32,0,.82),(.11,.11,.14),gold)
        elif item=="docksideCleaver": cube("salvage blade",(.4,0,.57),(.38,.08,.22),steel,.035)
        # A few contrasting ferrules and grip wraps break up the long, otherwise
        # uninterrupted procedural silhouette and remain legible at icon size.
        for x,z in ((-.17,-.42),(-.02,-.10),(.12,.20)):
            band=cube("tool haft ferrule",(x,-.005,z),(.19,.17,.045),copper,.012);band.rotation_euler[1]=-.43
        if item in ("hatchet","pickaxe","hammer","quarryMaul"):
            cyl("reinforced tool eye",(.31,0,.48),.14,.23,iron,10,"Y")
            for x,z in ((.22,.60),(.43,.60)):
                ico("forged rivet",(x,-.13,z),(.035,.02,.035),copper,1)
        if item=="hammer":
            cube("hammer claw",(.48,0,.63),(.23,.18,.11),steel,.035).rotation_euler[1]=-.30
            cube("hammer face cap",(.57,-.10,.56),(.12,.035,.19),copper,.018)
        if item=="docksideCleaver":
            cube("cleaver tang",(.18,-.09,.50),(.25,.025,.07),iron,.01)
            for x in (.18,.33):ico("handle pin",(x,-.105,.49),(.025,.012,.025),copper,1)
    elif item in ("salvageRevolver","fieldShotgun"):
        long=item=="fieldShotgun";scale=1.22 if long else 1
        cube("receiver",(-.04,0,.08),(.68*scale,.19,.22),iron,.055)
        cube("grip",(-.29,0,-.16),(.22,.16,.48),leather,.045).rotation_euler[1]=-.2
        if long:
            cube("wood stock",(-.46,0,.05),(.48,.15,.18),wood,.05)
            cube("stock shoulder pad",(-.72,-.01,.05),(.10,.18,.24),dark,.035)
            cube("stock cheek riser",(-.48,-.09,.14),(.28,.035,.07),wl,.018)
            for z in (.045,.185):
                cyl("side by side shotgun barrel",(.37*scale,-.012,z),.052,.68*scale,steel,16,"X")
                torus("shotgun muzzle rim",(.72*scale,-.012,z),.052,.012,copper,(0,math.pi/2,0))
                cyl("dark muzzle bore",(.735*scale,-.012,z),.029,.018,dark,12,"X",.004)
            rod("raised barrel rib",(.04,-.02,.24),(.70*scale,-.02,.24),.018,steel,8)
            cube("foregrip",(.2,0,-.11),(.31,.17,.12),wood,.035)
            cube("forend nose cap",(.36,-.015,-.11),(.06,.19,.15),iron,.02)
            for x in (-.60,-.34,.08,.32):ico("shotgun receiver pin",(x,-.108,.085),(.025,.016,.025),copper,1)
            torus("trigger guard",(-.04,-.105,-.095),.125,.014,iron,(math.pi/2,0,0))
            rod("shotgun trigger",(-.015,-.12,-.02),(.01,-.12,-.12),.018,copper,8)
            cube("receiver hinge",(.10,-.11,.01),(.22,.04,.10),copper,.018)
        else:
            cyl("revolver barrel",(.37,0,.12),.064,.62,steel,16,"X")
            torus("revolver muzzle rim",(.69,0,.12),.064,.014,copper,(0,math.pi/2,0))
            cyl("revolver barrel bore",(.707,0,.12),.034,.018,dark,12,"X",.004)
            cyl("six chamber cylinder",(.03,-.02,.08),.15,.25,steel,16,"Y");torus("cylinder rim",(.03,-.16,.08),.12,.018,copper,(math.pi/2,0,0))
            for chamber in range(6):
                angle=chamber*math.tau/6
                cx=.03+math.cos(angle)*.094;cz=.08+math.sin(angle)*.094
                torus("individual cylinder chamber rim",(cx,-.157,cz),.026,.006,copper,(math.pi/2,0,0))
                cyl("dark cylinder chamber",(cx,-.158,cz),.018,.012,dark,10,"Y",.003)
            torus("curved trigger guard",(-.13,-.105,-.13),.115,.016,iron,(math.pi/2,0,0))
            rod("revolver trigger",(-.035,-.125,-.02),(-.015,-.125,-.12),.018,copper,8)
            cube("revolver hammer spur",(-.34,-.035,.25),(.13,.12,.10),copper,.025).rotation_euler[1]=-.28
            cube("grip side panel",(-.30,-.092,-.16),(.16,.035,.34),wl,.035).rotation_euler[1]=-.2
            for z in (-.23,-.08):ico("grip screw",(-.30,-.116,z),(.018,.012,.018),steel,1)
        cube("sight",(.3,0,.23),(.12,.06,.05),copper,.01)
        cube("rear sight",(-.30,0,.23),(.10,.08,.045),steel,.012)
    elif item in ("shirt","pants","boots","warmJacket","protectiveHood","salvageVest","yardPlate"):
        mat=steel if item=="yardPlate" else cloth
        if item in ("shirt","warmJacket","salvageVest","yardPlate"):
            cube("garment body",(0,0,0),(.68,.25,.72),mat,.11)
            for x in (-.43,.43): cube("sleeve",(x,0,.1),(.23,.22,.47),leather if item=="salvageVest" else mat,.08)
            if item in ("salvageVest","yardPlate"):
                for x in (-.19,.19): cube("armor plate",(x,-.15,.02),(.27,.06,.38),iron if item=="salvageVest" else steel,.035)
                for z in (-.2,.23): cube("plate strap",(0,-.19,z),(.55,.035,.035),copper,.01)
            if item=="warmJacket":
                for z in (-.22,.22):cube("jacket seam",(0,-.137,z),(.53,.018,.025),copper,.008)
        elif item=="pants":
            cube("waist",(0,0,.25),(.56,.24,.25),cloth,.06)
            for x in (-.15,.15):cube("trouser leg",(x,0,-.16),(.23,.23,.58),leather,.06)
        elif item=="boots":
            for x in (-.18,.18):cube("hide boot",(x,0,-.03),(.31,.5,.34),leather,.07)
        else:
            ico("filter hood",(0,0,.05),(.35,.25,.4),cloth,2);cube("visor",(0,-.23,.04),(.34,.04,.12),sea,.025)
    elif item in ("storage","furnace","workbench1","workbench2","workbench3","generator","powerSwitch","lamp","homesteadCore","campfire"):
        if item.startswith("workbench"):
            cube("work surface",(0,0,.15),(.95,.54,.18),wood,.05)
            for x in (-.36,.36):
                for y in (-.18,.18):cube("bench leg",(x,y,-.2),(.1,.1,.54),iron,.025)
            cube("tool housing",(0,-.06,.31),(.35,.3,.18),iron,.035)
            if item=="workbench3": cube("vise",(.3,-.1,.35),(.2,.16,.16),copper,.03)
        elif item in ("storage","homesteadCore"):
            cube("weatherproof case",(0,0,0),(.72,.55,.58),wood,.09);cube("lid",(0,0,.32),(.76,.58,.13),iron,.04)
            cube("latch",(0,-.3,.02),(.15,.045,.17),copper,.02)
            if item=="homesteadCore":
                cyl("beacon mast",(0,0,.63),.035,.55,steel);ico("beacon lens",(0,0,.93),(.13,.13,.12),sea)
        elif item=="furnace":
            cyl("field processor body",(0,0,0),.36,.62,iron,12);cyl("top collar",(0,0,.34),.39,.1,steel,12)
            cube("fire door",(0,-.34,-.1),(.31,.04,.25),dark,.025);ico("pilot glow",(0,-.37,-.1),(.1,.025,.07),red)
            cyl("exhaust",(.15,.12,.53),.1,.55,steel,10)
        elif item=="generator":
            cube("generator shell",(0,0,0),(.72,.42,.47),iron,.075);cube("enamel cover",(0,-.23,.06),(.5,.03,.29),sea,.035)
            cyl("recoil hub",(0,.24,0),.17,.08,steel,16,"Y");torus("guard",(0,.29,0),.24,.025,copper,(math.pi/2,0,0))
            for x in (-.25,.25):rod("carry frame",(x,-.28,-.25),(x,.28,-.25),.035,steel)
        elif item=="powerSwitch":
            cube("switch case",(0,0,0),(.64,.2,.52),sea,.07);cube("switch face",(0,-.12,.02),(.47,.04,.35),dark,.025)
            cube("toggle",(.02,-.17,.08),(.1,.06,.23),copper,.025);ico("status lamp",(.17,-.16,-.07),(.045,.025,.045),green)
        elif item=="lamp":
            cyl("lamp cage",(0,0,.12),.22,.42,steel,12);ico("lamp lens",(0,0,.13),(.15,.15,.18),gold)
            for a in range(6):
                q=a*math.tau/6;rod("protective cage",(.24*math.cos(q),.24*math.sin(q),-.08),(.24*math.cos(q),.24*math.sin(q),.33),.018,iron,8)
            cyl("mount foot",(0,0,-.18),.19,.08,iron)
        elif item=="campfire":
            for a in range(3):
                q=a*math.tau/3;rod("fuel stick",(.28*math.cos(q),.28*math.sin(q),-.2),(-.28*math.cos(q),-.28*math.sin(q),-.2),.07,wood)
            ico("fire bundle",(0,0,-.01),(.2,.19,.24),red)
    elif item in ("rock","stone","ore","sulfurOre","hqMetalOre","metal","wood","fiber","hide","rawMeat","cookedMeat","berries"):
        colors={"sulfurOre":gold,"hqMetalOre":copper,"metal":steel,"wood":wl,"fiber":fiber,"hide":leather,"rawMeat":meat,"cookedMeat":meat,"berries":berry}
        mat=colors.get(item,stone)
        if item in ("rock","stone","ore","sulfurOre","hqMetalOre"):
            for i,(loc,sz) in enumerate([((-.18,-.04,-.02),(.43,.38,.38)),((.16,.02,.08),(.38,.35,.44)),((.02,.05,.28),(.34,.3,.31))]):ico("ore fragment",loc,sz,mat,1)
            if item in ("sulfurOre","hqMetalOre"):
                for loc in ((-.12,-.24,.1),(.12,-.22,.29)):ico("mineral vein",loc,(.13,.025,.035),gold if item=="sulfurOre" else steel)
        elif item=="wood":
            for z in (-.16,.07,.28):cyl("split timber",(0,0,z),.105,.85,wl,10,"X")
        elif item=="fiber":
            for a in range(6):
                q=a*math.tau/6;rod("twisted fiber",(-.2,.12*math.sin(q),-.25),(0,.12*math.cos(q),0),.025,fiber);rod("twisted fiber",(0,.12*math.cos(q),0),(.2,.12*math.sin(q),.25),.025,fiber)
        elif item=="hide":
            ico("cured hide",(0,0,0),(.48,.16,.4),leather,2);cube("hide edge",(0,-.13,-.1),(.52,.035,.08),copper,.02)
        elif item in ("rawMeat","cookedMeat"):
            ico("cut of meat",(0,0,0),(.43,.31,.3),meat,2)
            for x in (-.17,.17):cyl("bone",(x,-.05,.15),.055,.27,white,10,"X")
            if item=="cookedMeat":
                for x in (-.18,.02,.19):cube("sear",(x,-.28,.02),(.035,.03,.19),dark,.01)
        else:
            for x,y,z in ((-.2,0,.02),(0,-.05,.19),(.2,.02,.02),(0,.09,-.12)):ico("wild berry",(x,y,z),(.15,.15,.16),berry,2)
            rod("berry stem",(0,.02,.28),(0,.02,.4),.025,green)
    elif item in ("bandage","traumaKit","canteen","plan","bedroll"):
        if item=="bandage":
            cube("folded dressing",(0,0,0),(.62,.18,.22),white,.07);cube("cross stripe",(0,-.1,0),(.1,.025,.22),red,.01)
        elif item=="traumaKit":
            cube("medical case lower tray",(0,0,-.045),(.68,.43,.29),red,.065)
            cube("raised hinged lid",(0,-.005,.15),(.68,.43,.16),red,.055)
            cube("lid inset panel",(0,-.226,.15),(.52,.025,.095),wl,.018)
            cube("medical cross vertical",(0,-.247,.145),(.075,.018,.15),white,.012)
            cube("medical cross horizontal",(0,-.25,.145),(.18,.018,.06),white,.012)
            cube("case handle",(0,-.03,.29),(.3,.08,.06),iron,.02)
            for x in (-.24,.24):
                cube("brass case hinge",(x,.22,.105),(.10,.04,.07),copper,.012)
                cube("case latch",(x,-.244,-.055),(.085,.035,.10),steel,.014)
                for z in (-.13,.02):ico("case seam rivet",(x,-.245,z),(.018,.012,.018),copper,1)
            for x in (-.29,.29):cube("stitched case seam",(x,-.225,.02),(.018,.016,.23),wl,.006)
        elif item=="canteen":
            cyl("canteen body",(0,0,0),.27,.5,sea,12);cube("shoulder",(0,0,.28),(.25,.25,.13),sea,.05)
            cyl("cap",(0,0,.39),.11,.1,copper,12);rod("strap",(-.21,.12,.17),(.21,.12,.17),.025,leather)
        elif item=="plan":
            cube("folded construction sheet",(0,0,0),(.58,.08,.72),cloth,.035)
            for z in (-.19,-.03,.13):cube("plan marks",(0,-.05,z),(.35,.012,.018),sea,.004)
            cube("plan title block",(.16,-.05,.25),(.12,.014,.1),copper,.008)
        else:
            cyl("sleeping roll",(0,0,0),.22,.74,cloth,12,"X");torus("roll strap",(-.2,0,0),.23,.025,copper,(0,math.pi/2,0));torus("roll strap",(.2,0,0),.23,.025,copper,(0,math.pi/2,0))
    elif item in ("scrap","gears","wiring","machineParts","techParts","pistolAmmo","shotgunShells","relayAccessCard"):
        if item=="gears":
            for pos,r in (((-.15,0,.05),.2),((.2,0,-.12),.14)):
                cyl("salvaged gear",pos,r,.09,steel,12,"Y");cyl("gear bore",(pos[0],-.06,pos[2]),r*.38,.02,dark,12,"Y")
                for tooth in range(10):
                    angle=tooth*math.tau/10
                    tooth_obj=cube("individual gear tooth",(pos[0]+math.cos(angle)*(r+.018),pos[1],pos[2]+math.sin(angle)*(r+.018)),(.065,.10,.045),steel,.008)
                    tooth_obj.rotation_euler[1]=-angle
                torus("machined gear hub",(pos[0],-.058,pos[2]),r*.48,.018,copper,(math.pi/2,0,0))
        elif item=="wiring":
            torus("coiled cable",(0,0,0),.28,.045,copper,(math.pi/2,0,0));torus("coiled cable",(0,.04,.02),.2,.025,sea,(math.pi/2,0,0))
        elif item in ("pistolAmmo","shotgunShells"):
            for i in range(3):cyl("cartridge",(-.2+i*.2,0,0),.07,.48,gold if item=="pistolAmmo" else copper,12)
            for i in range(3):bpy.data.objects.get("cartridge").rotation_euler[1]=.18
        elif item=="relayAccessCard":
            cube("access card",(0,0,0),(.65,.04,.42),sea,.035);cube("chip",(-.16,-.03,.04),(.14,.02,.13),gold,.018)
            cube("stripe",(.18,-.03,-.1),(.18,.015,.045),steel,.006)
        else:
            for i,(pos,sz) in enumerate([((-.19,0,.05),(.28,.2,.23)),((.1,.02,-.12),(.34,.24,.2)),((.18,0,.19),(.2,.17,.2))]):cube("salvaged component",pos,sz,steel if i%2 else copper,.045)
            if item=="techParts":cube("sealed module",(0,-.13,.04),(.32,.06,.23),sea,.025)
            if item=="machineParts":
                cyl("bearing",(0,-.14,-.07),.12,.04,iron,16,"Y")
                cyl("bearing race",(0,-.166,-.07),.082,.018,copper,16,"Y")
                cyl("bearing spindle",(0,-.18,-.07),.039,.045,dark,12,"Y")
                rod("bent steel shaft",(-.28,-.06,.16),(.32,-.06,.16),.055,steel,10)
                for x in (-.25,.28):cyl("shaft collar",(x,-.06,.16),.078,.07,copper,10,"X")
    else:
        cube("salvage object",(0,0,0),(.55,.36,.42),iron,.06)

def setup():
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE"
    scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="WEBP";scene.render.image_settings.color_mode="RGBA";scene.render.image_settings.quality=88
    scene.render.film_transparent=True;scene.render.image_settings.color_depth="8"
    scene.view_settings.view_transform="AgX"
    camera_data=bpy.data.cameras.new("Tideland icon camera")
    camera=bpy.data.objects.new("Tideland icon camera",camera_data);scene.collection.objects.link(camera);scene.camera=camera
    scene.camera.data.type="ORTHO";scene.camera.data.ortho_scale=2.55
    scene.camera.location=(3.5,-6,3.5);scene.camera.rotation_euler=(Vector((0,0,0))-scene.camera.location).to_track_quat("-Z","Y").to_euler()
    for name,loc,power,size,color in (("large soft key",(2,-4,5),520,4,(1,.82,.67)),("cool fill",(-4,-1,2.5),300,3,(.62,.82,1)),("salt rim",(1,3,4),650,3,(1,.76,.52))):
        data=bpy.data.lights.new(name,"AREA");data.energy=power;data.shape="DISK";data.size=size;data.color=color
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat("-Z","Y").to_euler()
    scene.world.color=(.12,.12,.12);scene.render.image_settings.color_mode="RGBA"

def render(item):
    clear_scene();scene=bpy.context.scene;setup();build(item)
    # Fit each silhouette consistently to the same visual occupancy while keeping the render background transparent.
    bpy.context.view_layer.update()
    meshes=[obj for obj in scene.objects if obj.type=='MESH']
    corners=[obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    camera=scene.camera;inverse=camera.matrix_world.inverted();projected=[inverse @ point for point in corners]
    min_x,max_x=min(p.x for p in projected),max(p.x for p in projected)
    min_y,max_y=min(p.y for p in projected),max(p.y for p in projected)
    center=(min_x+max_x)/2,(min_y+max_y)/2
    camera.location += camera.matrix_world.to_3x3() @ Vector((center[0],center[1],0))
    camera.data.ortho_scale=max((max_x-min_x)/.79,(max_y-min_y)/.79,1.2)
    scene.render.filepath=os.path.join(OUTPUT,item+".webp")
    bpy.ops.render.render(write_still=True)

os.makedirs(OUTPUT,exist_ok=True)
for item in IDS:
    if only and item not in only: continue
    render(item)
    print("Rendered Tideland icon:",item,flush=True)
