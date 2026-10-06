"""Render the original Tideland inventory icon set in headless Blender.

Run with: blender --background --python tools/icon-render/render_icons.py
The scene and output are deterministic; no external assets are required.
"""
import bpy
import json
import math
import os
import random
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

def fractured_clast(name,loc,scale,mats,seed):
    """Deterministic hand-broken stone with faceted planes and color regions."""
    rng=random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    for vertex in obj.data.vertices:
        vertex.co*=.82+rng.random()*.34
        vertex.co.x*=.88+rng.random()*.24
        vertex.co.y*=.90+rng.random()*.20
    for mat in mats:obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth=False
        roll=rng.random();face.material_index=1 if roll<.25 else 2 if roll<.39 else 0
    return obj

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

def profile_mesh(name, loc, profile, mat, axis="Y", sides=24):
    """Lathed, faceted metal part with an authored stepped cross-section."""
    verts=[]
    for along,radius in profile:
        for i in range(sides):
            angle=math.tau*i/sides
            if axis=="X": verts.append((loc[0]+along,loc[1]+radius*math.cos(angle),loc[2]+radius*math.sin(angle)))
            else: verts.append((loc[0]+radius*math.cos(angle),loc[1]+along,loc[2]+radius*math.sin(angle)))
    faces=[]
    for row in range(len(profile)-1):
        for i in range(sides):
            a=row*sides+i;b=row*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend((tuple(range(sides-1,-1,-1)),tuple((len(profile)-1)*sides+i for i in range(sides))))
    mesh=bpy.data.meshes.new(name+" precision profile");mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    for face in mesh.polygons: face.use_smooth=True
    return obj

def curve_tube(name, points, radius, mat):
    """Create a smoothly shaped, converted mesh tube for string, limbs and rope."""
    curve=bpy.data.curves.new(name+" authored path","CURVE");curve.dimensions="3D";curve.resolution_u=20;curve.bevel_depth=radius;curve.bevel_resolution=4
    spline=curve.splines.new("BEZIER");spline.bezier_points.add(len(points)-1)
    for point,co in zip(spline.bezier_points,points):point.co=co;point.handle_left_type="AUTO";point.handle_right_type="AUTO"
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target="MESH");obj=bpy.context.object;obj.name=name;assign(obj,mat)
    for polygon in obj.data.polygons:polygon.use_smooth=True
    return obj

def toothed_gear(name, center, radius, thickness, teeth, mat):
    """Extruded involute-like tooth silhouette with a true open center bore."""
    offsets=(-.48,-.31,-.23,.23,.31,.48);scales=(.82,.82,1.08,1.08,.82,.82);outer=[]
    for tooth in range(teeth):
        for offset,scale in zip(offsets,scales):
            angle=(tooth+offset)*math.tau/teeth;outer.append((center[0]+math.cos(angle)*radius*scale,center[2]+math.sin(angle)*radius*scale))
    count=len(outer);bore=radius*.31;verts=[]
    for y in (center[1]-thickness/2,center[1]+thickness/2):
        verts.extend((x,y,z) for x,z in outer)
        verts.extend((center[0]+math.cos(i*math.tau/count)*bore,y,center[2]+math.sin(i*math.tau/count)*bore) for i in range(count))
    faces=[]
    for i in range(count):
        j=(i+1)%count
        faces.extend(((i,j,count+j,count+i),(2*count+i,3*count+i,3*count+j,2*count+j),(i,2*count+i,2*count+j,j),(count+i,count+j,3*count+j,3*count+i)))
    mesh=bpy.data.meshes.new(name+" toothed annular mesh");mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);bevel(obj,.008,1);return obj

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
    yellow=material("hot flame",PALETTE["yellow"],.02,.36)
    dark=material("charcoal rubber",PALETTE["dark"],.12,.65)
    # Long-handled tools and weapons are framed diagonally for quick recognition.
    if item=="bow":
        # Laminated ash limbs curve away from a tensioned fiber string; the
        # cord, reinforced nocks and wrapped grip make the silhouette read as
        # a field bow rather than a generic crescent-shaped prop.
        curve_tube("sculpted lower ash bow limb",[(.50,0,-1.04),(.67,0,-.86),(.53,0,-.61),(.27,0,-.34),(.02,0,-.16)],.043,wood)
        curve_tube("sculpted upper ash bow limb",[(.02,0,.16),(.27,0,.34),(.53,0,.61),(.67,0,.86),(.50,0,1.04)],.043,wood)
        curve_tube("laminated pale ash backing",[(.51,-.027,-1.015),(.68,-.03,-.86),(.55,-.03,-.61),(.29,-.03,-.34),(.035,-.027,-.16)],.011,wl)
        curve_tube("tapered upper ash backing",[(.035,-.027,.16),(.29,-.03,.34),(.55,-.03,.61),(.68,-.03,.86),(.51,-.027,1.015)],.011,wl)
        curve_tube("drawn braided bowstring",[(.50,-.045,-1.025),(.20,-.045,-.68),(-.28,-.045,0),(.20,-.045,.68),(.50,-.045,1.025)],.009,fiber)
        curve_tube("leather-wrapped riser",[(.02,-.055,-.22),(.015,-.07,-.13),(.00,-.075,0),(.015,-.07,.13),(.02,-.055,.22)],.057,leather)
        for z in (-.985,.985):
            ring=cyl("darkened bowstring nock",(.51,-.005,z),.053,.07,dark,10,"Y",.008);ring.rotation_euler[1]=-.28 if z>0 else .28
            band=cube("brass limb binding",(.52,-.015,z+(-.045 if z>0 else .045)),(.11,.085,.045),copper,.012);band.rotation_euler[1]=.32 if z>0 else -.32
        for z in (-.15,-.08,0,.08,.15):
            wrap=rod("cross-wrapped bow grip",(-.035,-.115,z-.025),(.035,-.115,z+.025),.010,wl,7)
    elif item in ("hatchet","pickaxe","hammer","quarryMaul","spear","torch","arrow","docksideCleaver"):
        rod("haft",(-.26,-.02,-.62),(.28,.02,.58),.075,wood)
        if item=="hatchet":
            poly_prism("forged hatchet head",[(.22,.54),(.29,.7),(.57,.65),(.73,.5),(.61,.35),(.29,.32)],.19,steel,.035)
            poly_prism("sharpened cutting edge",[(.57,.65),(.73,.5),(.61,.35)],.2,iron,.018)
        elif item=="pickaxe":
            # A mining pick has a long pointed beak and a broad striking poll
            # on opposite sides of the eye; the working edges span across the
            # haft instead of rising like a vertical spike.
            poly_prism("forged pick eye socket",[(.16,.43),(.19,.59),(.32,.62),(.38,.56),(.36,.43),(.30,.38)],.19,steel,.025)
            poly_prism("tapered geological pick beak",[(.20,.55),(.12,.59),(-.03,.57),(-.18,.52),(-.05,.49),(.08,.45)],.17,iron,.018)
            poly_prism("bright pick cutting ridge",[(-.03,.57),(-.18,.52),(-.05,.49)],.18,steel,.008)
            poly_prism("broad poll striking face",[(.32,.58),(.38,.62),(.48,.60),(.52,.54),(.48,.48),(.38,.45),(.34,.48)],.19,iron,.022)
            poly_prism("poll impact plane",[(.48,.60),(.52,.54),(.48,.48)],.20,steel,.008)
        elif item=="quarryMaul":
            poly_prism("forged quarry maul head",[(.12,.49),(.19,.43),(.54,.43),(.63,.48),(.68,.54),(.65,.62),(.56,.68),(.20,.68),(.12,.62),(.085,.55)],.22,steel,.028)
            poly_prism("left battered striking face",[(.085,.50),(.15,.46),(.22,.48),(.22,.62),(.15,.65),(.085,.60)],.236,iron,.012)
            poly_prism("right hardened striking face",[(.53,.47),(.62,.47),(.69,.53),(.69,.59),(.62,.65),(.53,.65)],.236,iron,.012)
            poly_prism("right face replaceable cap",[(.62,.47),(.69,.53),(.69,.59),(.62,.65),(.60,.61),(.60,.51)],.248,copper,.006)
            # A deep forged collar shoulders the handle eye and ties both poll faces together.
            poly_prism("reinforced maul eye collar",[(.25,.43),(.43,.43),(.49,.49),(.49,.62),(.43,.68),(.25,.68),(.20,.62),(.20,.49)],.25,iron,.014)
        elif item=="hammer":
            poly_prism("forged carpenter hammer body",[(.20,.45),(.34,.42),(.49,.44),(.58,.48),(.64,.54),(.64,.60),(.59,.66),(.48,.69),(.31,.67),(.22,.62),(.17,.55)],.19,steel,.024)
            curve_tube("upper curved nail claw",[(.25,0,.59),(.205,0,.635),(.155,0,.70),(.105,0,.73)],.034,iron)
            curve_tube("lower hooked nail claw",[(.25,0,.55),(.18,0,.535),(.11,0,.505),(.07,0,.47)],.034,iron)
            poly_prism("ground striking poll",[(.53,.47),(.61,.49),(.66,.54),(.66,.60),(.62,.65),(.54,.67),(.50,.61),(.51,.53)],.205,iron,.011)
            poly_prism("replaceable poll cap",[(.605,.50),(.655,.54),(.655,.60),(.615,.65),(.59,.61),(.59,.54)],.214,copper,.006)
            poly_prism("forged cheek reinforcement",[(.32,.49),(.39,.46),(.48,.48),(.51,.55),(.49,.62),(.41,.65),(.33,.61)],.205,steel,.01)
        elif item=="spear":
            # A leaf-shaped forged head follows the haft axis and has a raised
            # center ridge, ground cutting bevels, and a fitted socket.
            poly_prism("forged leaf spearhead",[(.16,.59),(.24,.62),(.30,.74),(.39,.91),(.47,1.10),(.405,1.045),(.29,.91),(.20,.76)],.095,steel,.012)
            poly_prism("spearhead cutting bevel",[(.16,.59),(.24,.62),(.30,.74),(.39,.91),(.47,1.10),(.405,1.045),(.32,.82),(.21,.65)],.104,iron,.006)
            poly_prism("raised spearhead spine",[(.24,.62),(.32,.82),(.405,1.045),(.47,1.10),(.39,.91),(.29,.73)],.114,steel,.004)
            poly_prism("spearhead fuller",[(.273,.70),(.30,.75),(.367,.91),(.385,.95),(.325,.82)],.119,dark,.002)
            # A narrow transverse band seats the blade on the wooden haft;
            # the generic lathed profile reads too much like a spherical socket at icon scale.
            socket_band=cube("spear socket binding",(.245,-.01,.615),(.19,.16,.045),iron,.012);socket_band.rotation_euler[1]=-.43
            for x,z in ((.22,.625),(.28,.67)):
                ico("spear socket peened pin",(x,-.105,z),(.014,.01,.014),copper,1)
        elif item=="arrow":
            rod("arrow shaft",(-.2,0,-.5),(.2,0,.5),.035,wl)
            bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.09,radius2=0,depth=.22,location=(.25,0,.63));assign(bpy.context.object,steel)
        elif item=="torch":
            # An irregular resin-soaked rag crown and sculpted flame read as a
            # crafted torch rather than a smooth cylinder with a glowing bead.
            poly_prism("charred torch crown",[(.20,.48),(.31,.51),(.40,.60),(.40,.77),(.34,.84),(.27,.79),(.22,.68)],.17,dark,.018)
            poly_prism("resin-bound rag wrapping",[(.19,.55),(.25,.50),(.34,.54),(.41,.62),(.39,.71),(.32,.75),(.24,.69)],.19,leather,.014)
            for points in (((.21,.55),(.27,.60),(.34,.62)),((.24,.66),(.31,.64),(.39,.69)),((.25,.73),(.30,.70),(.35,.76))):
                curve_tube("twisted torch binding",[(x,-.105,z) for x,z in points],.014,wl)
            poly_prism("outer torch flame",[(.22,.76),(.16,.85),(.20,.94),(.25,.91),(.28,1.08),(.34,.99),(.39,1.13),(.46,1.00),(.48,.89),(.43,.79),(.34,.74)],.085,red,.012)
            poly_prism("golden flame core",[(.27,.77),(.23,.86),(.27,.93),(.30,.90),(.34,1.02),(.38,.96),(.42,1.02),(.43,.90),(.39,.82),(.34,.77)],.096,gold,.008)
            poly_prism("hot flame tongue",[(.31,.78),(.30,.86),(.33,.91),(.35,.98),(.39,.90),(.38,.83),(.35,.78)],.105,yellow,.005)
        elif item=="docksideCleaver":
            # A broad, repaired cargo-clearing blade with a flared nose and a
            # hand-ground belly; the irregular silhouette reads at inventory scale.
            poly_prism("forged dockside cleaver blade",[(.10,.47),(.20,.42),(.34,.45),(.48,.51),(.72,.49),(.84,.56),(.88,.65),(.84,.75),(.73,.83),(.60,.79),(.45,.70),(.29,.64),(.18,.61)],.145,steel,.023)
            poly_prism("freshly ground cleaver bevel",[(.48,.51),(.72,.49),(.84,.56),(.88,.65),(.84,.75),(.73,.83),(.69,.75),(.76,.64),(.68,.57)],.151,iron,.012)
            poly_prism("bright chipped cutting edge",[(.72,.49),(.84,.56),(.88,.65),(.84,.75),(.73,.83),(.77,.72),(.82,.65),(.75,.58)],.156,wl,.004)
            poly_prism("welded blade shoulder",[(.12,.48),(.21,.43),(.34,.46),(.43,.53),(.35,.61),(.22,.59)],.163,copper,.012)
            poly_prism("dark blade fuller",[(.34,.54),(.43,.55),(.66,.60),(.70,.64),(.63,.64),(.41,.59)],.166,dark,.003)
        # A few contrasting ferrules and grip wraps break up the long, otherwise
        # uninterrupted procedural silhouette and remain legible at icon size.
        ferrule_points=((-.17,-.42),(-.02,-.10),(.12,.20)) if item!="docksideCleaver" else ((-.13,-.34),(.14,.28))
        for x,z in ferrule_points:
            band=cube("tool haft ferrule",(x,-.005,z),(.19,.17,.045),copper,.012);band.rotation_euler[1]=-.43
        if item in ("hatchet","pickaxe","hammer","quarryMaul"):
            eye_radius=.105 if item=="pickaxe" else .14
            cyl("reinforced tool eye",(.31,0,.48),eye_radius,.23,iron,10,"Y")
            for x,z in ((.22,.60),(.43,.60)):
                ico("forged rivet",(x,-.13,z),(.035,.02,.035),copper,1)
        if item=="hammer":
            for x,z in ((.29,.59),(.43,.61)):
                ico("forged cheek rivet",(x,-.132,z),(.026,.014,.026),copper,1)
            rod("poll cap wear groove",(.61,-.12,.535),(.61,-.12,.625),.006,gold,6)
        if item=="docksideCleaver":
            cube("cleaver tang",(.15,-.09,.50),(.34,.025,.075),iron,.012).rotation_euler[1]=-.18
            dark_grip=material("salt-darkened grip leather",(.105,.075,.052,1),0,.91)
            rod("darkened leather cleaver grip sleeve",(-.062,-.02,-.18),(.078,.02,.13),.09,dark_grip,12)
            for x,z in ((.04,.45),(.27,.51)):
                ico("peened cleaver tang pin",(x,-.112,z),(.028,.014,.028),copper,1)
            for x,z in ((.52,.68),(.61,.72),(.71,.77)):
                rod("cargo-blade grind scratch",(x,-.09,z),(x+.034,-.09,z+.018),.006,copper,6)
        if item=="quarryMaul":
            for x in (.18,.55):
                for z in (.47,.64):ico("maul poll rivet",(x,-.145,z),(.024,.013,.024),gold,1)
    elif item in ("salvageRevolver","fieldShotgun"):
        long=item=="fieldShotgun";scale=1.22 if long else 1
        if long:
            poly_prism("hinged shotgun receiver",[(-.35,-.035),(-.31,.16),(-.20,.235),(.18,.215),(.34,.15),(.32,.005),(.14,-.075),(-.10,-.08)],.20*scale,iron,.025)
            poly_prism("shotgun grip profile",[(-.39,-.02),(-.20,.015),(-.12,-.14),(-.16,-.42),(-.27,-.49),(-.41,-.37),(-.44,-.12)],.17,leather,.025)
        else:
            poly_prism("curved revolver frame",[(-.34,.055),(-.31,.18),(-.20,.235),(.18,.21),(.34,.145),(.31,.035),(.16,-.005),(.085,-.13),(-.075,-.19),(-.28,-.11)],.19,iron,.024)
            poly_prism("angled revolver grip profile",[(-.43,-.035),(-.25,.01),(-.12,-.13),(-.15,-.40),(-.27,-.51),(-.42,-.40),(-.47,-.16)],.17,leather,.026)
        if long:
            poly_prism("sculpted ash stock",[(-.77,-.09),(-.73,.10),(-.57,.18),(-.38,.14),(-.23,.08),(-.24,-.08),(-.43,-.17),(-.65,-.20)],.16,wood,.025)
            poly_prism("rubber shoulder pad",[(-.79,-.11),(-.76,.12),(-.70,.16),(-.70,-.19)],.18,dark,.016)
            poly_prism("stock cheek riser",[(-.65,.105),(-.57,.20),(-.39,.18),(-.34,.12),(-.48,.105)],.18,wl,.012)
            for z in (.045,.185):
                cyl("side by side shotgun barrel",(.37*scale,-.012,z),.052,.68*scale,steel,16,"X")
                torus("shotgun muzzle rim",(.72*scale,-.012,z),.052,.012,copper,(0,math.pi/2,0))
                torus("breech barrel ferrule",(.405,-.012,z),.053,.010,iron,(0,math.pi/2,0))
                cyl("dark muzzle bore",(.735*scale,-.012,z),.029,.018,dark,12,"X",.004)
            rod("raised barrel rib",(.04,-.02,.24),(.70*scale,-.02,.24),.018,steel,8)
            rod("lower barrel joining rib",(.10,.025,-.005),(.69*scale,.025,-.005),.012,iron,8)
            poly_prism("shaped walnut fore-end",[(.015,-.13),(.06,-.04),(.14,-.015),(.34,-.03),(.39,-.10),(.35,-.18),(.10,-.19)],.17,wood,.02)
            cube("forend nose cap",(.36,-.015,-.11),(.06,.19,.15),iron,.02)
            for x in (-.60,-.34,.08,.32):ico("shotgun receiver pin",(x,-.108,.085),(.025,.016,.025),copper,1)
            torus("trigger guard",(-.04,-.105,-.095),.125,.014,iron,(math.pi/2,0,0))
            rod("shotgun trigger",(-.015,-.12,-.02),(.01,-.12,-.12),.018,copper,8)
            # A transverse pin and release lever make the break-action joint
            # read as working hardware instead of a copper-colored block.
            cyl("break-action hinge boss",(.17,-.123,.055),.064,.045,iron,16,"Y",.008)
            torus("hinge boss retaining rim",(.17,-.151,.055),.049,.009,copper,(math.pi/2,0,0))
            cyl("hinge pivot cap",(.17,-.158,.055),.026,.014,steel,12,"Y",.004)
            cube("pivot screw slot",(.17,-.167,.055),(.026,.006,.004),dark,.001)
            poly_prism("top lever locking shoe",[(-.01,.205),(.10,.205),(.16,.232),(.11,.247),(0,.24)],.08,steel,.009).location.y=-.075
            rod("top lever thumb tab",(.055,-.09,.235),(-.025,-.09,.267),.018,copper,8)
        else:
            cyl("revolver barrel",(.37,0,.12),.064,.62,steel,16,"X")
            torus("revolver muzzle rim",(.69,0,.12),.064,.014,copper,(0,math.pi/2,0))
            cyl("revolver barrel bore",(.707,0,.12),.034,.018,dark,12,"X",.004)
            # A six-fluted cylinder breaks up the large plain metal drum and
            # keeps the chamber assembly legible at inventory-icon scale.
            # The shallow scallops are actual mesh relief rather than a decal.
            base_x,base_y,base_z=.03,-.02,.08; radius=.15; sides=72
            rings=[(-.125,.91),(-.108,.985),(-.085,1.0),(.045,1.0),(.068,.985),(.085,.91)]
            verts=[]
            for y,edge in rings:
                for index in range(sides):
                    angle=math.tau*index/sides
                    # Place each relief between adjacent chamber bores so the
                    # front-face ports remain circular and unobstructed.
                    flute=(.029*max(0,math.cos(angle*6+math.pi)))
                    r=(radius-flute)*edge
                    verts.append((base_x+math.cos(angle)*r,base_y+y,base_z+math.sin(angle)*r))
            faces=[]
            for row in range(len(rings)-1):
                for index in range(sides):
                    a=row*sides+index;b=row*sides+(index+1)%sides
                    faces.append((a,a+sides,b+sides,b))
            # The lower and upper cap windings face away from the cylinder.
            faces.extend((tuple(range(sides)),tuple((len(rings)-1)*sides+i for i in range(sides-1,-1,-1))))
            drum_mesh=bpy.data.meshes.new("six-flute revolver cylinder mesh");drum_mesh.from_pydata(verts,[],faces);drum_mesh.materials.append(steel);drum_mesh.update()
            drum=bpy.data.objects.new("six-fluted revolver cylinder",drum_mesh);bpy.context.collection.objects.link(drum)
            for polygon in drum_mesh.polygons:
                polygon.use_smooth=len(polygon.vertices)==4
            torus("cylinder rim",(.03,-.16,.08),.12,.018,copper,(math.pi/2,0,0))
            for chamber in range(6):
                angle=chamber*math.tau/6
                cx=.03+math.cos(angle)*.094;cz=.08+math.sin(angle)*.094
                torus("individual cylinder chamber rim",(cx,-.157,cz),.026,.006,copper,(math.pi/2,0,0))
                cyl("dark cylinder chamber",(cx,-.158,cz),.018,.012,dark,10,"Y",.003)
            profile_mesh("cylinder extractor star and arbor",(base_x,-.163,base_z),[(-.038,.035),(-.024,.052),(-.010,.034),(.005,.022)],iron,"Y",12)
            cyl("extractor spindle screw",(.03,-.207,.08),.018,.012,gold,8,"Y",.003)
            torus("curved trigger guard",(-.13,-.105,-.13),.115,.016,iron,(math.pi/2,0,0))
            rod("revolver trigger",(-.035,-.125,-.02),(-.015,-.125,-.12),.018,copper,8)
            cube("revolver hammer spur",(-.34,-.035,.25),(.13,.12,.10),copper,.025).rotation_euler[1]=-.28
            poly_prism("contoured grip side panel",[(-.405,-.09),(-.29,-.07),(-.18,-.18),(-.20,-.37),(-.29,-.44),(-.41,-.34),(-.44,-.17)],.025,wl,.012).location.y=-.095
            for z in (-.23,-.08):ico("grip screw",(-.30,-.116,z),(.018,.012,.018),steel,1)
        cube("sight",(.3,0,.23),(.12,.06,.05),copper,.01)
        cube("rear sight",(-.30,0,.23),(.10,.08,.045),steel,.012)
    elif item in ("shirt","pants","boots","warmJacket","protectiveHood","salvageVest","yardPlate"):
        if item in ("shirt","warmJacket","salvageVest","yardPlate"):
            field_canvas=material("weathered olive field canvas",(.20,.285,.218,1),0,.88)
            jacket_canvas=material("waxed storm jacket cloth",(.275,.335,.285,1),0,.82)
            liner=material("dark garment lining",(.105,.145,.122,1),0,.91)
            armor=material("scuffed salvage armor",(.32,.385,.37,1),.52,.57)
            base_mat=field_canvas if item in ("shirt","salvageVest") else jacket_canvas if item=="warmJacket" else liner
            torso_outline=[(-.31,-.37),(-.29,.18),(-.43,.30),(-.39,.43),(-.20,.49),(-.085,.405),(.085,.405),(.20,.49),(.39,.43),(.43,.30),(.29,.18),(.31,-.37),(.20,-.43),(0,-.37),(-.20,-.43)]
            torso=poly_prism("tailored garment torso",torso_outline,.22,base_mat,.025);torso.location.y=.015
            for side in (-1,1):
                sleeve_outline=[(side*x,z) for x,z in ((.13,.28),(.27,.34),(.39,.26),(.47,.045),(.41,-.24),(.30,-.30),(.20,-.18),(.20,.06))]
                sleeve=poly_prism("tapered set-in sleeve",sleeve_outline,.19,base_mat,.024);sleeve.location.y=.018;sleeve.rotation_euler[1]=side*-.14
                cuff_outline=[(side*x,z) for x,z in ((.39,-.23),(.31,-.29),(.20,-.18),(.205,-.105),(.34,-.12))]
                cuff=poly_prism("reinforced sleeve cuff",cuff_outline,.205,liner if item=="warmJacket" else leather,.012);cuff.location.y=-.005
            collar=poly_prism("raised shaped collar",[(-.13,.405),(-.10,.49),(0,.445),(.10,.49),(.13,.405),(.06,.335),(0,.36),(-.06,.335)],.255,liner if item=="warmJacket" else field_canvas,.014);collar.location.y=-.005
            if item=="shirt":
                poly_prism("open shirt placket",[(-.035,.39),(.035,.39),(.025,-.35),(-.025,-.35)],.018,wl,.006).location.y=-.125
                for z in (.26,.10,-.06,-.22):ico("shirt placket button",(0,-.145,z),(.014,.009,.014),copper,1)
                pocket=poly_prism("stitched chest pocket",[(-.115,.18),(.115,.18),(.105,-.015),(-.10,-.015)],.026,field_canvas,.01);pocket.location=(.145,-.134,.02)
                rod("pocket flap seam",(.04,-.154,.115),(.25,-.154,.115),.006,wl,6)
            elif item=="warmJacket":
                poly_prism("storm jacket storm flap",[(-.075,.37),(.075,.37),(.065,-.35),(-.065,-.35)],.035,liner,.01).location.y=-.137
                curve_tube("jacket front zipper",[(0,-.16,.34),(0,-.16,.16),(.008,-.16,-.08),(0,-.16,-.34)],.009,gold)
                for z in (.27,.17,.07,-.03,-.13,-.23):ico("storm flap snap",(.047,-.169,z),(.014,.009,.014),copper,1)
                for side in (-1,1):
                    pocket=poly_prism("bellows cargo chest pocket",[(-.12,.12),(.12,.12),(.105,-.10),(-.105,-.10)],.035,jacket_canvas,.012);pocket.location=(side*.17,-.14,-.05)
                    flap=poly_prism("snapped jacket pocket flap",[(-.13,.035),(.13,.035),(.11,-.035),(-.11,-.035)],.018,liner,.006);flap.location=(side*.17,-.164,.035)
            elif item in ("salvageVest","yardPlate"):
                for side in (-1,1):
                    strap_outline=[(side*x,z) for x,z in ((-.055,.39),(.055,.39),(.12,.15),(.055,.10),(-.11,.34))]
                    strap=poly_prism("crossed load-bearing shoulder webbing",strap_outline,.032,leather,.009);strap.location=(side*.18,-.148,0)
                for side in (-1,1):
                    if item=="salvageVest":
                        plate_outline=[(-.13,.15),(-.09,.23),(.08,.22),(.14,.13),(.11,-.16),(.02,-.24),(-.12,-.16)]
                        plate=poly_prism("asymmetric salvaged chest plate",plate_outline,.055,armor,.015);plate.location=(side*.16,-.153,-.015);plate.rotation_euler[1]=side*.08
                        pocket=poly_prism("vest utility pouch",[(-.10,.08),(.10,.08),(.095,-.12),(-.095,-.12)],.065,leather,.012);pocket.location=(side*.17,-.178,-.21)
                        for z in (-.17,.015):ico("vest plate rivet",(side*.16,-.19,z),(.018,.01,.018),gold,1)
                    else:
                        plate_outline=[(-.14,.18),(-.10,.27),(.085,.25),(.15,.15),(.12,-.18),(.04,-.26),(-.12,-.18)]
                        plate=poly_prism("forged torso armor segment",plate_outline,.065,armor,.018);plate.location=(side*.16,-.15,-.015);plate.rotation_euler[1]=side*.08
                        for z in (-.21,.18):
                            rod("armor plate retaining strap",(side*.04,-.192,z),(side*.29,-.192,z-.015),.014,copper,8)
                        for x,z in ((side*.08,-.18),(side*.24,-.18),(side*.08,.15),(side*.24,.15)):ico("armor plate rivet",(x,-.197,z),(.016,.01,.016),gold,1)
                if item=="yardPlate":
                    poly_prism("raised center breastplate ridge",[(-.018,-.20),(0,.20),(.035,.20),(.025,-.20)],.014,steel,.004).location.y=-.194
                    poly_prism("scratched unit marking",[(-.075,.10),(.075,.10),(.065,.065),(-.065,.065)],.012,red,.003).location.y=-.202
        elif item=="pants":
            trouser_canvas=material("salt-faded trouser canvas",(.16,.22,.13,1),0,.9)
            knee_leather=material("patched knee leather",(.10,.13,.09,1),0,.94)
            waist_outline=[(-.27,.29),(-.30,.43),(-.22,.51),(-.13,.54),(.13,.54),(.22,.51),(.30,.43),(.27,.29),(.16,.24),(0,.27),(-.16,.24)]
            poly_prism("shaped trouser seat and waistband",waist_outline,.23,trouser_canvas,.025)
            for side in (-1,1):
                leg_outline=[(side*x,z) for x,z in ((-.12,.30),(.12,.30),(.135,.10),(.105,-.18),(.13,-.45),(.075,-.51),(-.11,-.49),(-.13,-.22))]
                poly_prism("tapered articulated trouser leg",leg_outline,.205,trouser_canvas,.022).location.x=side*.145
                knee_outline=[(side*x,z) for x,z in ((-.105,-.13),(.105,-.13),(.095,-.31),(-.09,-.32))]
                knee=poly_prism("stitched double-layer knee patch",knee_outline,.026,knee_leather,.01);knee.location=(side*.145,-.119,-.005)
                pocket_outline=[(-.085,.075),(.085,.075),(.08,-.065),(-.08,-.065)]
                pocket=poly_prism("buttoned field cargo pocket",pocket_outline,.034,trouser_canvas,.012);pocket.location=(side*.205,-.13,.105)
                flap=poly_prism("cargo pocket flap",[(-.09,.025),(.09,.025),(.08,-.035),(-.08,-.035)],.022,leather,.008);flap.location=(side*.205,-.151,.17)
                ico("cargo pocket stud",(side*.205,-.17,.157),(.014,.009,.014),copper,1)
                for z in (-.39,-.35):rod("knee reinforcement stitch",(side*.09,-.142,z),(side*.20,-.142,z+.005),.005,wl,6)
            poly_prism("fly front reinforcement",[(-.025,.28),(.025,.28),(.018,.02),(-.018,-.015)],.018,leather,.006).location.y=-.126
            for x in (-.22,-.11,0,.11,.22):
                loop=poly_prism("stitched belt loop",[(-.025,.12),(.025,.12),(.025,-.035),(-.025,-.035)],.025,leather,.006);loop.location=(x,-.139,.38)
            cube("salvage belt buckle",(0,-.16,.405),(.09,.028,.085),copper,.018)
        elif item=="boots":
            for index,x in enumerate((-.19,.19)):
                depth=.045 if index else -.07
                sole=poly_prism("layered lug sole",[(-.32,-.27),(.27,-.27),(.38,-.22),(.36,-.15),(-.30,-.15)],.42,dark,.025);sole.location.x=x;sole.location.y=depth
                welt=poly_prism("stitched leather welt",[(-.30,-.17),(.28,-.17),(.34,-.12),(.31,-.09),(-.27,-.09)],.39,wl,.016);welt.location.x=x;welt.location.y=depth-.01
                upper=poly_prism("sculpted ankle boot upper",[(-.27,-.12),(.27,-.12),(.31,-.045),(.17,.015),(.13,.27),(.075,.34),(-.15,.32),(-.19,.09),(-.28,.015)],.34,leather,.035);upper.location.x=x;upper.location.y=depth-.025
                toe=poly_prism("reinforced rounded toe panel",[(.045,-.09),(.25,-.09),(.31,-.045),(.17,.015),(.075,.035),(.015,-.005)],.025,wood,.014);toe.location.x=x;toe.location.y=depth-.20
                cuff=poly_prism("folded ankle cuff",[(-.16,.24),(.13,.24),(.085,.33),(-.15,.33)],.37,wl,.02);cuff.location.x=x;cuff.location.y=depth-.018
                for lace in range(3):
                    z=.045+lace*.062
                    rod("crossed waxed boot lace",(x-.075,depth-.205,z),(x+.065,depth-.205,z+.027),.012,white,8)
                    for eyelet_x in (-.085,.078):ico("brass boot eyelet",(x+eyelet_x,depth-.205,z),(.012,.009,.012),copper,1)
                for seam in range(4):
                    z=-.09+seam*.045
                    rod("welt saddle stitch",(x-.23,depth-.222,z),(x-.13,depth-.222,z+.006),.006,white,6)
                buckle=cube("ankle strap buckle",(x-.14,depth-.205,.19),(.075,.018,.055),copper,.012)
                buckle.rotation_euler[1]=-.12
        else:
            ico("fabric hood crown",(0,.25,.12),(.34,.28,.38),cloth,2)
            shell=poly_prism("tailored protective hood mantle",[(-.32,-.24),(-.37,.06),(-.29,.31),(-.15,.43),(.12,.45),(.30,.31),(.36,.04),(.30,-.23),(.20,-.35),(-.20,-.35)],.27,cloth,.035);shell.location.y=.01
            poly_prism("dark face opening",[(-.19,-.16),(-.21,.11),(-.14,.25),(.12,.25),(.20,.11),(.17,-.16),(.08,-.23),(-.10,-.23)],.024,dark,.025).location.y=-.145
            curve_tube("hood face opening binding",[(-.21,-.17,-.12),(-.23,-.17,.10),(-.15,-.17,.27),(0,-.17,.30),(.16,-.17,.25),(.22,-.17,.08),(.19,-.17,-.15)],.024,leather)
            lens=poly_prism("split protective goggle lenses",[(-.19,.08),(-.16,.18),(-.035,.18),(-.02,.045),(-.14,.035)],.026,sea,.014);lens.location=(0,-.178,0)
            right_lens=poly_prism("right protective goggle lens",[(.035,.18),(.16,.18),(.19,.08),(.14,.035),(.02,.045)],.026,sea,.014);right_lens.location=(0,-.18,0)
            rod("goggle bridge",(-.03,-.205,.11),(.03,-.205,.11),.014,copper,8)
            cyl("respirator filter canister",(0,-.205,-.11),.092,.12,iron,12,"Y",.012)
            for x in (-.045,0,.045):rod("filter vent slot",(x,-.27,-.12),(x,-.27,-.075),.007,steel,6)
            curve_tube("respirator side hose",[(-.08,-.19,-.15),(-.17,-.10,-.20),(-.24,.02,-.16)],.018,copper)
    elif item in ("storage","furnace","workbench1","workbench2","workbench3","generator","powerSwitch","lamp","homesteadCore","campfire"):
        if item.startswith("workbench"):
            if item=="workbench1":
                # A field-built timber bench: three separate boards, pegged
                # trestle legs, a low stretcher and a hand saw left on top.
                for index,y in enumerate((-.18,0,.18)):
                    cube("hand-planed bench board",(0,y,.17),(.98,.17,.115),wood if index!=1 else wl,.035)
                    for x in (-.35,.35):ico("timber peg",(x,y-.06,.235),(.014,.012,.014),iron,1)
                for x in (-.34,.34):
                    rod("splayed trestle leg front",(x,-.19,.105),(x-.055,-.25,-.34),.052,wood,8)
                    rod("splayed trestle leg rear",(x,.19,.105),(x+.055,.25,-.34),.052,wood,8)
                rod("lower timber stretcher",(-.35,-.23,-.23),(.35,-.23,-.23),.034,wl,8)
                cube("open tool tray",(-.03,.015,-.10),(.50,.27,.07),wood,.025)
                poly_prism("hand saw blade profile",[(-.34,.255),(.03,.255),(.12,.29),(-.34,.29)],.025,steel,.006).location.y=-.10
                rod("saw leather handle",(-.33,-.12,.272),(-.48,-.12,.272),.038,leather,8)
                rod("bench chisel",(.13,-.12,.27),(.39,-.12,.31),.022,steel,7)
            elif item=="workbench2":
                # A service bench adds a reinforced top, steel frame, bench
                # vise and a working drill press with chuck and feed handle.
                cube("reinforced worktop",(0,0,.17),(.98,.58,.14),wood,.035)
                for y in (-.28,.28):rod("steel worktop edging",(-.46,y,.245),(.46,y,.245),.022,steel,8)
                for x in (-.36,.36):
                    for y in (-.20,.20):rod("square steel leg",(x,y,.10),(x,y,-.35),.043,iron,8)
                rod("lower steel stretcher",(-.36,-.20,-.21),(.36,-.20,-.21),.027,steel,8)
                cube("vise anvil base",(.25,-.10,.27),(.35,.26,.055),iron,.018)
                poly_prism("bench vise fixed jaw",[(.08,.28),(.31,.28),(.34,.38),(.10,.38)],.20,steel,.012).location.y=-.18
                poly_prism("bench vise sliding jaw",[(.22,.28),(.40,.28),(.40,.36),(.23,.36)],.20,copper,.01).location.y=-.18
                rod("vise lead screw",(.16,-.22,.315),(.42,-.22,.315),.021,steel,8)
                cyl("vise screw handwheel",(.45,-.22,.315),.075,.028,iron,12,"Y",.006)
                rod("drill press column",(-.25,.04,.22),(-.25,.04,.77),.055,steel,10)
                cube("drill press head",(-.12,.03,.67),(.36,.31,.17),iron,.035)
                cyl("drill chuck",(-.12,-.02,.52),.052,.20,steel,12,"Z",.009)
                cyl("drill bit",(-.12,-.02,.39),.014,.12,copper,8,"Z",.003)
                rod("drill feed lever",(-.30,-.08,.66),(-.43,-.08,.60),.018,copper,8)
                ico("drill feed knob",(-.44,-.08,.595),(.035,.035,.035),dark,1)
            else:
                # The advanced station is a heavier fabrication table with a
                # precision vise, drawer apron and articulated inspection lamp.
                cube("cast iron precision table",(0,0,.18),(1.0,.62,.16),iron,.035)
                cube("sacrificial cutting mat",(-.10,-.02,.27),(.54,.35,.035),cloth,.012)
                for x in (-.38,.38):
                    for y in (-.22,.22):rod("heavy bench pedestal",(x,y,.105),(x,y,-.36),.064,steel,8)
                cube("drawer apron",(0,-.21,-.02),(.72,.075,.22),dark,.025)
                for x in (-.23,.23):
                    cube("machined drawer face",(x,-.258,-.015),(.30,.025,.16),iron,.012)
                    rod("drawer pull",(x-.045,-.282,-.015),(x+.045,-.282,-.015),.012,copper,8)
                cube("precision vise shoe",(.23,-.12,.295),(.43,.30,.07),steel,.022)
                poly_prism("fixed hardened vise jaw",[(.03,.31),(.20,.31),(.22,.43),(.04,.43)],.28,iron,.015).location.y=-.20
                poly_prism("movable hardened vise jaw",[(.28,.31),(.46,.31),(.46,.40),(.29,.40)],.28,iron,.015).location.y=-.20
                rod("vise screw spindle",(.18,-.24,.35),(.48,-.24,.35),.025,steel,10)
                cyl("vise tommy bar pivot",(.49,-.24,.35),.052,.035,copper,12,"Y",.008)
                rod("vise tommy bar",(.49,-.24,.35),(.49,-.24,.52),.016,steel,8)
                ico("vise tommy bar grip",(.49,-.24,.535),(.032,.032,.04),dark,1)
                curve_tube("inspection lamp flex arm",[(-.34,.12,.25),(-.38,.12,.48),(-.30,.10,.63),(-.13,.08,.67)],.025,steel)
                poly_prism("hooded inspection lamp",[(-.25,.60),(-.15,.67),(.02,.63),(.08,.54),(-.01,.51)],.18,copper,.016).location.x=-.28
                ico("inspection lamp lens",(-.20,-.115,.575),(.048,.025,.035),gold,1)
        elif item in ("storage","homesteadCore"):
            cube("weatherproof case",(0,0,0),(.72,.55,.58),wood,.09)
            cube("reinforced chest lid",(0,0,.32),(.76,.58,.13),iron,.04)
            if item=="storage":
                # A field chest has board seams, a lifted sealing rim, tiedown
                # bands and a real hasp so it reads as storage at thumbnail scale.
                cube("raised lid inset",(0,-.012,.393),(.53,.39,.018),dark,.018)
                for x in (-.25,.25):
                    cube("lid timber slat",(x,0,.407),(.025,.36,.016),wl,.006)
                    cube("vertical crate strap",(x,-.286,.025),(.045,.022,.65),steel,.012)
                    cube("strap lid crossing",(x,0,.411),(.045,.48,.018),steel,.008)
                    for z in (-.20,-.05,.18,.34):ico("chest strap rivet",(x,-.304,z),(.018,.012,.018),copper,1)
                    for y in (.16,.225):cyl("lid hinge knuckle",(x,y,.34),.027,.09,copper,10,"X",.006)
                cube("reinforced lid lip",(0,-.296,.30),(.70,.035,.07),iron,.012)
                cube("locking hasp",(0,-.322,.20),(.14,.026,.20),copper,.018)
                cube("hasp key slot",(0,-.341,.20),(.025,.006,.065),dark,.004)
                for x in (-.24,.24):
                    cube("corner guard",(x,-.285,-.24),(.10,.035,.11),iron,.018)
                    cyl("corner guard rivet",(x,-.309,-.22),.016,.012,gold,8,"Y",.003)
                    rod("raised chest foot runner",(x,-.20,-.32),(x,.20,-.32),.035,dark,8)
            else:
                cube("homestead beacon latch",(0,-.3,.02),(.15,.045,.17),copper,.02)
                for x in (-.25,.25):
                    cube("beacon case reinforcement",(x,-.285,.03),(.07,.035,.49),iron,.018)
                    for z in (-.18,.18):ico("beacon case rivet",(x,-.31,z),(.018,.012,.018),gold,1)
            if item=="homesteadCore":
                # Property beacon hardware sits above the weatherproof core:
                # isolated mast, guarded signal lamp and a legible service face.
                for x in (-.28,.28):
                    rod("beacon chassis side brace",(x,-.20,-.24),(x*.82,-.20,.29),.028,steel,8)
                    rod("beacon anchor runner",(x,-.18,-.32),(x,.18,-.32),.035,dark,8)
                    for z in (-.22,.22):ico("beacon chassis fastener",(x,-.225,z),(.022,.012,.022),gold,1)
                face=poly_prism("homestead service instrument fascia",[(-.20,-.12),(-.16,.12),(.16,.12),(.20,-.12)],.035,sea,.018);face.location=(0,-.294,.02)
                cube("beacon panel display",(0,-.316,.045),(.16,.012,.085),dark,.012)
                for i in range(3):ico("beacon status diode",(-.045+i*.045,-.327,.045),(.014,.009,.014),green if i==0 else gold,1)
                cyl("mast foot isolation collar",(0,0,.405),.105,.09,copper,12,"Z",.012)
                cyl("beacon mast",(0,0,.66),.035,.49,steel,12,"Z",.008)
                for z,radius in ((.48,.073),(.84,.060),(.93,.15)):
                    torus("beacon signal guard ring",(0,0,z),radius,.012,copper if z<.9 else steel)
                ico("beacon signal lens",(0,0,.94),(.105,.105,.10),sea,2)
                for i in range(4):
                    angle=i*math.pi/2
                    rod("signal lens cage stay",(.13*math.cos(angle),.13*math.sin(angle),.84),(.085*math.cos(angle),.085*math.sin(angle),1.02),.012,iron,7)
                for z in (-.13,-.08,-.03):rod("vented core heat slot",(-.12,-.302,z),(.12,-.302,z),.008,dark,6)
        elif item=="furnace":
            cyl("cast furnace foot",(0,0,-.29),.34,.10,dark,12,"Z",.02)
            cyl("field processor body",(0,0,0),.36,.58,iron,12)
            cyl("upper firebox shoulder",(0,0,.27),.375,.11,iron,12)
            cyl("raised furnace crown",(0,0,.34),.39,.075,steel,12)
            for i in range(8):
                angle=i*math.tau/8;x,z=math.cos(angle)*.355,math.sin(angle)*.355
                rod("cast furnace cooling rib",(x,.015,z-.18),(x,.015,z+.15),.019,steel,8)
            cube("recessed fire door surround",(0,-.352,-.075),(.34,.045,.28),steel,.035)
            cube("dark firebox opening",(0,-.381,-.075),(.25,.018,.19),dark,.02)
            cube("firebox grate",(0,-.394,-.145),(.19,.012,.025),iron,.006)
            ico("pilot glow",(0,-.397,-.055),(.09,.014,.055),red,2)
            for x in (-.09,-.045,0,.045,.09):rod("firebox vent slot",(x,-.396,.025),(x,-.396,.075),.008,copper,6)
            cyl("exhaust base flange",(.15,.12,.42),.15,.065,iron,12,"Z",.01)
            cyl("exhaust neck",(.15,.12,.61),.095,.39,steel,12,"Z",.014)
            cyl("exhaust rain cap",(.15,.12,.82),.125,.045,iron,12,"Z",.008)
            torus("exhaust collar",(.15,.12,.45),.11,.014,copper)
            for x in (-.29,.29):rod("furnace carry lug",(x,-.19,.17),(x,.19,.17),.026,steel,8)
        elif item=="generator":
            # Stamped engine casing with a separate service panel, ventilation,
            # recoil starter and real control hardware; retain the portable
            # frame silhouette while avoiding a plain box-and-cylinder stack.
            casing=poly_prism("stamped generator engine housing",[(-.34,-.22),(-.38,-.12),(-.35,.16),(-.27,.23),(.22,.23),(.34,.14),(.37,-.16),(.27,-.23),(-.22,-.25)],.43,iron,.032)
            casing.location.y=.035
            panel=poly_prism("pressed enamel service cover",[(-.245,-.14),(-.26,.105),(-.19,.17),(.12,.17),(.25,.09),(.25,-.12),(.16,-.17),(-.17,-.18)],.035,sea,.018);panel.location.y=-.205
            # Offset vents catch a highlight across the louvered cooling panel.
            for index in range(5):
                z=-.105+index*.047
                rod("cooling louver",(-.14,-.232,z),(.105,-.232,z+.018),.012,steel,7)
            for x,z in ((-.205,-.115),(.205,-.115),(-.19,.115),(.19,.115)):
                cyl("service panel screw",(x,-.239,z),.018,.014,copper,8,"Y",.003)
                cube("screw slot",(x,-.248,z),(.018,.004,.003),dark,.001)
            # Fuel tank, cap, exhaust and pull-start are separate fitted parts.
            tank=poly_prism("rounded portable fuel tank",[(-.19,.22),(-.16,.34),(-.08,.38),(.17,.36),(.23,.30),(.20,.23)],.30,steel,.024);tank.location.y=.025
            cyl("fuel filler neck",(.105,-.01,.38),.052,.055,iron,12,"Z",.006)
            cyl("knurled fuel cap",(.105,-.01,.415),.063,.028,copper,12,"Z",.005)
            profile_mesh("compact exhaust muffler",(.31,.03,.055),[(-.13,.065),(-.105,.09),(.075,.09),(.11,.064)],steel,"X",12)
            cyl("exhaust outlet",(.43,.03,.055),.043,.13,dark,10,"X",.005)
            for z in (-.02,.045,.11):rod("muffler heat slot",(.346,-.063,z),(.386,-.063,z),.008,dark,6)
            cyl("recoil starter hub",(-.01,.26,-.005),.16,.07,steel,16,"Y",.012)
            torus("recoil starter guard",(-.01,.302,-.005),.225,.022,copper,(math.pi/2,0,0))
            torus("recoil starter face ring",(-.01,-.245,-.005),.128,.012,iron,(math.pi/2,0,0))
            for index in range(8):
                angle=index*math.tau/8
                x=-.01+math.cos(angle)*.095;z=-.005+math.sin(angle)*.095
                rod("starter fan cutout",(x,-.248,z),(x+math.cos(angle+.4)*.045,-.248,z+math.sin(angle+.4)*.045),.008,dark,6)
            rod("starter pull cord",(-.22,.28,-.12),(-.36,.30,-.22),.012,leather,7)
            ico("starter pull grip",(-.38,.30,-.235),(.055,.06,.09),wood,1)
            cube("weatherproof switch bezel",(.205,-.25,.015),(.105,.035,.12),iron,.025)
            cube("engine stop toggle",(.205,-.275,.022),(.028,.025,.072),copper,.009)
            ico("generator status indicator",(.10,-.25,.115),(.025,.012,.025),green,1)
            for x in (-.29,.29):
                rod("tubular carry frame",(x,-.28,-.22),(x,.28,-.22),.033,steel,8)
                rod("rubber isolation foot",(x,-.20,-.30),(x,.20,-.30),.04,dark,8)
        elif item=="powerSwitch":
            cube("switch case",(0,0,0),(.64,.2,.52),sea,.07);cube("switch face",(0,-.12,.02),(.47,.04,.35),dark,.025)
            cube("toggle",(.02,-.17,.08),(.1,.06,.23),copper,.025);ico("status lamp",(.17,-.16,-.07),(.045,.025,.045),green)
        elif item=="lamp":
            # Open storm lantern cage, with visible glass, guard hoops,
            # reinforced uprights, an oil reservoir and a carrying handle.
            cyl("lantern weighted foot",(0,0,-.22),.20,.09,dark,12,"Z",.015)
            cyl("brass reservoir",(0,0,-.125),.17,.13,copper,16,"Z",.018)
            torus("lower cage hoop",(0,0,-.04),.225,.022,iron)
            torus("upper cage hoop",(0,0,.285),.225,.022,steel)
            torus("middle cage hoop",(0,0,.12),.214,.012,copper)
            ico("frosted storm glass",(0,0,.12),(.15,.15,.18),gold,2)
            for a in range(6):
                q=a*math.tau/6;x,y=.22*math.cos(q),.22*math.sin(q)
                rod("protective cage upright",(x,y,-.04),(x*.82,y*.82,.27),.018,steel,8)
                ico("cage foot rivet",(x*.91,y*.91,-.03),(.022,.022,.022),copper,1)
            cyl("lantern crown",(0,0,.31),.19,.075,iron,12,"Z",.014)
            cyl("crown vent neck",(0,0,.37),.075,.12,steel,12,"Z",.01)
            torus("arched carrying bail",(0,0,.40),.13,.018,steel,(math.pi/2,0,0))
            cube("lantern ignition plate",(.15,-.09,-.12),(.10,.035,.09),iron,.014)
            cube("lantern ignition toggle",(.16,-.112,-.11),(.025,.018,.055),red,.006)
        elif item=="campfire":
            for a in range(3):
                q=a*math.tau/3;rod("fuel stick",(.28*math.cos(q),.28*math.sin(q),-.2),(-.28*math.cos(q),-.28*math.sin(q),-.2),.07,wood)
            ico("fire bundle",(0,0,-.01),(.2,.19,.24),red)
    elif item in ("rock","stone","ore","sulfurOre","hqMetalOre","metal","wood","fiber","hide","rawMeat","cookedMeat","berries"):
        colors={"ore":copper,"sulfurOre":gold,"hqMetalOre":copper,"metal":steel,"wood":wl,"fiber":fiber,"hide":leather,"rawMeat":meat,"cookedMeat":meat,"berries":berry}
        mat=colors.get(item,stone)
        if item in ("rock","stone","ore","sulfurOre","hqMetalOre"):
            if item in ("rock","stone"):
                mat=material(f"weathered {item} core",(.25,.285,.265,1) if item=="rock" else (.31,.325,.30,1),.01,.97)
            elif item=="sulfurOre":mat=material("ochre sulfur ore matrix",(.40,.285,.075,1),.02,.91)
            lightColor=(.46,.465,.42,1) if item in ("rock","stone") else (.65,.47,.12,1) if item=="sulfurOre" else (.53,.41,.31,1) if item in ("ore","hqMetalOre") else (.53,.56,.56,1)
            darkColor=(.22,.25,.24,1) if item in ("rock","stone") else (.31,.20,.055,1) if item=="sulfurOre" else (.20,.17,.14,1) if item in ("ore","hqMetalOre") else (.18,.21,.22,1)
            lightStone=material(f"fresh fractured {item} face",lightColor,.025,.94)
            darkStone=material(f"wet dark {item} fracture",darkColor,.035,.98)
            for i,(loc,sz) in enumerate([((-.18,-.04,-.02),(.43,.38,.38)),((.16,.02,.08),(.38,.35,.44)),((.02,.05,.28),(.34,.3,.31))]):
                fractured_clast("broken ore and stone fragment",loc,sz,(mat,lightStone,darkStone),sum(map(ord,item))*37+i*101)
            if item in ("sulfurOre","hqMetalOre"):
                veinMat=material("exposed sulfur crystal seam",(.76,.34,.025,1),.08,.45) if item=="sulfurOre" else material("exposed high-grade metal seam",(.53,.69,.72,1),.72,.30)
                for index,(x,z) in enumerate(((-.16,.08),(.14,.28))):
                    for shard,(dx,dz,size) in enumerate(((-.055,-.018,.84),(-.015,.026,1.0),(.042,.047,.76))):
                        size*=1.18 if item=="sulfurOre" else 1
                        fractured_clast("exposed faceted mineral crystal",(x+dx,-.35,z+dz),(.052*size,.026,.041*size),(veinMat,veinMat,veinMat),sum(map(ord,item))*19+index*7+shard)
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
            case=material("weathered trauma enamel",(.34,.095,.071,1),.06,.72)
            canvas=material("faded medical canvas",(.54,.48,.36,1),0,.92)
            webbing=material("olive utility webbing",(.13,.17,.13,1),0,.94)
            cube("molded lower trauma tray",(0,0,-.045),(.68,.43,.29),case,.075)
            lid=poly_prism("chamfered trauma lid",[(-.31,.015),(-.30,.145),(-.245,.225),(.22,.225),(.30,.155),(.315,.02),(.255,-.005),(-.25,-.005)],.445,case,.027)
            lid.location=(0,0,.115)
            # A raised, stitched cloth panel replaces the flat painted box-face label.
            panel=poly_prism("worn canvas medical panel",[(-.225,-.005),(-.205,.052),(-.17,.071),(.17,.071),(.205,.052),(.225,-.005)],.018,canvas,.008)
            panel.location=(0,-.232,.205)
            poly_prism("embroidered medical cross vertical",[(-.034,-.045),(-.034,.045),(.034,.045),(.034,-.045)],.012,white,.004).location=(0,-.246,.205)
            poly_prism("embroidered medical cross arms",[(-.078,-.018),(-.078,.018),(.078,.018),(.078,-.018)],.014,white,.004).location=(0,-.25,.205)
            # The arched, wrapped carry handle is a real curved mesh with raised end mounts.
            for x in (-.13,.13):cube("handle leather socket",(x,-.015,.345),(.075,.095,.035),leather,.012)
            curve_tube("arched leather carry handle",[(-.13,-.02,.35),(-.15,-.02,.43),(-.09,-.02,.475),(0,-.02,.485),(.09,-.02,.475),(.15,-.02,.43),(.13,-.02,.35)],.026,leather)
            # Two adjustable webbing straps cross the lid and wrap onto the lower tray.
            for x in (-.245,.245):
                cube("front webbing strap",(x,-.235,.045),(.048,.022,.46),webbing,.014)
                cube("lid webbing strap",(x,-.02,.35),(.048,.29,.018),webbing,.014)
                cube("brass locking buckle",(x,-.254,-.025),(.085,.028,.105),copper,.018)
                cube("buckle dark recess",(x,-.271,-.025),(.048,.012,.062),dark,.009)
                rod("buckle cross pin",(x-.022,-.282,-.025),(x+.022,-.282,-.025),.009,gold,8)
                # Pin hinges show separate knuckles rather than a single decorative block.
                for z in (.075,.12):
                    cyl("lid hinge knuckle",(x,.222,z),.024,.045,steel,10,"X",.006)
                    cyl("hinge pin cap",(x+(.027 if x>0 else -.027),.222,z),.012,.012,copper,8,"X",.003)
                for z in (-.145,-.095,.15,.18):
                    rod("canvas edge stitching",(x-.012,-.253,z),(x+.012,-.253,z+.012),.004,white,6)
                ico("case corner rivet",(x,-.258,-.16),(.016,.01,.016),gold,1)
            # Shallow wear marks and molded reinforcement ribs catch the icon light.
            for x,z,length in ((-.17,-.12,.055),(.11,-.16,.035),(.17,.12,.045),(-.14,.10,.028)):
                rod("scraped enamel edge",(x,-.222,z),(x+length,-.222,z+.012),.004,wl,6)
            for x in (-.27,-.23,.23,.27):
                cube("tray corner guard",(x,-.16,-.155),(.038,.10,.055),iron,.012)
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
        if item=="scrap":
            # Mixed hand-sorted salvage: torn sheet, a bent channel section,
            # a punched washer and short lengths of twisted wire. Each plate
            # has an authored, asymmetric cut profile rather than a box stack.
            plate=poly_prism("torn galvanized sheet cutoff",[(-.43,-.18),(-.37,.14),(-.20,.26),(-.12,.19),(.05,.24),(.13,.10),(.31,.13),(.39,-.07),(.29,-.25),(.11,-.20),(-.04,-.29),(-.21,-.20),(-.34,-.27)],.075,steel,.012)
            plate.location=(.02,.055,-.02);plate.rotation_euler[1]=-.12
            rusted=poly_prism("oxidized folded plate fragment",[(-.25,-.12),(-.20,.10),(-.10,.17),(.12,.13),(.18,.04),(.11,-.03),(.14,-.18),(.02,-.23),(-.12,-.15)],.09,copper,.009)
            rusted.location=(-.12,-.018,.025);rusted.rotation_euler[1]=.34
            angle=poly_prism("bent angle iron offcut",[(-.12,-.28),(.02,-.30),(.22,.18),(.14,.25)],.10,iron,.008)
            angle.location=(.20,-.045,-.005);angle.rotation_euler[1]=-.27
            # Flattened washer with a real center opening and a peened bolt.
            torus("salvage punched washer",(-.31,-.13,.26),.064,.016,gold,(math.pi/2,0,0))
            cyl("washer dark bore",(-.31,-.13,.26),.034,.012,dark,12,"Y",.003)
            profile_mesh("short threaded shaft",(.27,.08,-.22),[(-.16,.025),(-.13,.042),(.08,.042),(.12,.024)],steel,"X",12)
            for index in range(4):
                x=.18+index*.047
                rod("shaft thread crest",(x,.035,-.22),(x+.022,.035,-.18),.006,copper,6)
            curve_tube("twisted salvage wire",[(-.38,-.20,-.22),(-.23,-.20,-.33),(-.02,-.20,-.31),(.08,-.20,-.18)],.014,dark)
            for x,z in ((-.30,-.08),(.26,.06),(-.06,.18)):
                cyl("salvage plate rivet",(x,-.115,z),.018,.012,copper,8,"Y",.003)
        elif item=="gears":
            for index,(pos,r,teeth) in enumerate((((-.15,0,.05),.2,12),((.2,0,-.12),.14,10))):
                toothed_gear("salvaged profile gear",pos,r,.09,teeth,steel if index==0 else copper)
                torus("worn gear hub ring",(pos[0],-.053,pos[2]),r*.31,.014,iron,(math.pi/2,0,0))
        elif item=="wiring":
            insulation=[material("faded signal red insulation",(.48,.105,.075,1),0,.8),material("salted teal cable insulation",(.12,.34,.32,1),0,.78),material("aged yellow cable insulation",(.63,.43,.13,1),0,.82)]
            for strand,(cx,cz,phase) in enumerate(((-.035,.035,0),(.025,.01,.28),(.04,-.055,.56))):
                path=[]
                for step in range(9):
                    angle=step*math.tau/8+phase;radius=.22+math.sin(angle*2+phase)*.025
                    path.append((cx+math.cos(angle)*radius,-.07+math.sin(angle*2+phase)*.045,cz+math.sin(angle)*radius*.72))
                curve_tube("loosely coiled insulated wire",path,.024+strand*.003,insulation[strand])
                end=path[0];tail=(end[0]-.20,-.08,end[2]-.11)
                curve_tube("cut cable tail",[end,(end[0]-.06,-.075,end[2]-.025),(tail[0]+.06,-.08,tail[2]+.035),tail],.022+strand*.002,insulation[strand])
                stripped=(tail[0]-.065,tail[1],tail[2]-.035)
                rod("exposed copper wire core",tail,stripped,.009,copper,7)
                profile_mesh("brass cable ferrule",(tail[0]+.015,tail[1],tail[2]),[(-.045,.028),(-.035,.043),(.02,.043),(.034,.026)],gold,"X",10)
            for x,z in ((-.20,.23),(.23,-.18)):
                profile_mesh("salvage cable plug housing",(x,-.06,z),[(-.11,.045),(-.08,.072),(.07,.072),(.105,.045)],steel,"X",12)
                cyl("plug contact collar",(x+.105,-.06,z),.055,.035,copper,10,"X",.006)
                cyl("plug contact tip",(x+.14,-.06,z),.026,.045,gold,8,"X",.004)
            curve_tube("cable loom retaining tie",[(-.20,-.13,-.05),(-.10,-.13,-.11),(.02,-.13,-.08),(.14,-.13,.0)],.018,leather)
        elif item in ("pistolAmmo","shotgunShells"):
            for i in range(3):cyl("cartridge",(-.2+i*.2,0,0),.07,.48,gold if item=="pistolAmmo" else copper,12)
            for i in range(3):bpy.data.objects.get("cartridge").rotation_euler[1]=.18
        elif item=="relayAccessCard":
            cube("access card",(0,0,0),(.65,.04,.42),sea,.035);cube("chip",(-.16,-.03,.04),(.14,.02,.13),gold,.018)
            cube("stripe",(.18,-.03,-.1),(.18,.015,.045),steel,.006)
        elif item=="techParts":
            board=poly_prism("irregular salvaged circuit board",[(-.37,-.27),(-.34,.25),(-.22,.36),(.20,.35),(.36,.20),(.33,-.24),(.16,-.36),(-.22,-.34)],.065,sea,.02);board.location.y=.065
            # Copper traces and punched contact pads remain visible around the
            # central processor instead of reading as a featureless green box.
            for points in (((-.27,-.055,.25),(-.19,-.055,.18),(-.12,-.055,.18)),((.25,-.055,.22),(.15,-.055,.12),(.12,-.055,.12)),((-.28,-.055,-.22),(-.17,-.055,-.12),(-.14,-.055,-.12)),((.26,-.055,-.22),(.19,-.055,-.12),(.14,-.055,-.12))):
                curve_tube("etched copper circuit path",points,.011,gold)
            chip_outline=[(-.17,-.14),(-.14,.13),(-.09,.18),(.12,.18),(.17,.13),(.16,-.14),(.10,-.19),(-.11,-.19)]
            chip=poly_prism("salvaged processor package",chip_outline,.072,iron,.015);chip.location=(0,-.015,.02)
            poly_prism("ceramic processor lid",[(-.105,-.12),(-.085,.10),(-.055,.125),(.075,.125),(.115,.09),(.10,-.11),(.06,-.145),(-.075,-.145)],.018,dark,.008).location=(0,-.063,.02)
            for side in (-1,1):
                for index in range(5):
                    z=-.12+index*.07
                    rod("processor gull-wing pin",(side*.16,-.075,z),(side*.235,-.075,z),.009,copper,6)
                    cyl("board solder pad",(side*.25,-.061,z),.018,.012,gold,8,"Y",.003)
            for x,z,radius,height in ((-.245,.205,.058,.16),(.25,-.18,.064,.19)):
                cyl("salvaged electrolytic capacitor",(x,-.025,z),radius,height,iron,12,"Z",.008)
                cyl("capacitor scored cap",(x,-.025,z+height*.51),radius*.84,.018,steel,12,"Z",.004)
                for side in (-1,1):rod("capacitor lead",(x+side*.025,-.02,z-height*.5),(x+side*.025,-.02,z-height*.5-.08),.008,copper,6)
            torus("copper wound signal inductor",(.23,-.075,.17),.085,.014,copper,(math.pi/2,0,0))
            profile_mesh("salvaged glass crystal oscillator",(-.245,-.01,-.19),[(-.09,.045),(-.065,.075),(.065,.075),(.09,.045)],white,"X",8)
            for index in range(5):
                x=-.24+index*.12
                cube("edge connector finger",(x,-.014,-.33),(.055,.016,.035),gold,.006)
        else:
            if item!="machineParts":
                for i,(pos,sz) in enumerate([((-.19,0,.05),(.28,.2,.23)),((.1,.02,-.12),(.34,.24,.2)),((.18,0,.19),(.2,.17,.2))]):cube("salvaged component",pos,sz,steel if i%2 else copper,.045)
            if item=="machineParts":
                # Broken motor casing: a hand-shaped irregular cast shell with a
                # torn lower edge, vent ribs and a deep rotor aperture.
                poly_prism("fractured motor housing",[(-.35,-.16),(-.30,.11),(-.18,.25),(.15,.28),(.34,.17),(.29,-.10),(.13,-.25),(-.12,-.23)],.25,steel,.025).location=(-.08,.105,.025)
                poly_prism("missing casing section",[(-.30,-.12),(-.21,.08),(-.08,.13),(-.02,-.10)],.018,dark,.008).location=(-.08,-.035,.025)
                for x in (-.31,.12):
                    rod("cast housing cooling rib",(x,-.045,-.12),(x-.035,-.045,.13),.018,iron,8)
                # Bearing cartridge, machined race, spindle and a flange with
                # open bore; the stepped profiles are authored meshes, not boxes.
                profile_mesh("motor bearing cartridge",(-.20,-.11,.04),[(-.09,.18),(-.075,.23),(.06,.23),(.085,.18)],iron,"Y",24)
                torus("bearing polished race",(-.20,-.205,.04),.15,.022,copper,(math.pi/2,0,0))
                cyl("bearing shadowed bore",(-.20,-.214,.04),.095,.018,dark,20,"Y",.004)
                profile_mesh("stepped rotor spindle",(-.20,-.235,.04),[(-.025,.052),(.02,.052),(.045,.084),(.105,.084),(.13,.048),(.26,.048)],steel,"Y",16)
                # Two visibly different gear profiles make the loose salvage
                # assembly recognizable even at small inventory-icon scale.
                toothed_gear("eight-tooth drive gear",(.22,-.17,-.12),.235,.075,8,steel)
                toothed_gear("small idler gear",(-.29,-.07,.27),.145,.065,9,copper)
                profile_mesh("idler hub",(-.29,-.115,.27),[(-.025,.047),(.018,.066),(.045,.047)],iron,"Y",16)
                # A bent shaft, flanged coupling and staggered fasteners add a
                # silhouette that reads as collected mechanical parts.
                profile_mesh("bent shaft section",(.18,.12,.23),[(-.28,.044),(-.24,.068),(-.19,.044),(.15,.044),(.20,.076),(.25,.076)],steel,"X",16)
                profile_mesh("shaft end flange",(.40,.12,.23),[(-.025,.082),(-.014,.115),(.014,.115),(.030,.078)],copper,"X",20)
                for x,z in ((-.31,-.18),(.11,-.23),(.33,.18)):
                    profile_mesh("salvage housing bolt",(x,-.073,z),[(-.018,.026),(0,.041),(.032,.041),(.05,.024)],gold,"Y",6)
                rod("snapped wire lead",(.22,-.04,-.21),(.34,-.02,-.29),.018,copper,8)
                rod("snapped wire return",(.34,-.02,-.29),(.43,.00,-.23),.014,dark,8)
    else:
        cube("salvage object",(0,0,0),(.55,.36,.42),iron,.06)

def setup():
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE"
    # Disable stochastic screen-space GI/ray effects so identical authored
    # models produce identical item thumbnails across headless runs.
    scene.eevee.use_fast_gi=False;scene.eevee.use_raytracing=False;scene.eevee.use_shadow_jitter_viewport=False;scene.eevee.taa_render_samples=128
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
