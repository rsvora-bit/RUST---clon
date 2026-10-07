"""Build original, meter-scale Tideland GLB environment assets and three LODs.

Run through `npm run assets:world`. All meshes and materials are authored here;
no external or commercial assets are read. Blender exports Y-up glTF 2.0.
"""
import bpy
import json
import math
import os
import random
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "public/assets/world")
COLLISION_OUT = os.path.join(OUT, "collision-proxies")
CATALOG = json.load(open(os.path.join(os.path.dirname(__file__), "catalog.json"), encoding="utf8"))
TREE_HEIGHTS = {"broadleaf_a":9.3,"broadleaf_b":10.7,"broadleaf_c":8.5,"conifer_a":11.6,"conifer_b":13.1,"conifer_c":10.2,"alpine_conifer":8.4,"marsh_tree":7.8,"coastal_tree":9.1,"palm_tree_a":9.6}

def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    # Keep the shared authored material datablocks alive across catalog entries.
    for datablocks in (bpy.data.meshes, bpy.data.curves):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def mat(name, color, metallic=0.0, roughness=.85):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material

WOOD = mat("Tideland salt-worn timber", (.22, .16, .105))
WOOD_LIGHT = mat("Tideland exposed timber", (.39, .29, .18))
WOOD_DARK = mat("Tideland soaked end grain", (.12, .105, .075))
RUST = mat("Tideland oxidized steel", (.24, .20, .15), .42, .9)
BARK = mat("Tideland furrowed bark", (.20, .15, .095))
LEAF = mat("Tideland coastal leaf", (.20, .30, .16))
LEAF_LIGHT = mat("Tideland sunlit leaf", (.30, .37, .19))
LEAF_SHADE = mat("Tideland shaded leaf", (.13, .23, .14))
NEEDLE = mat("Tideland alpine needle", (.105, .19, .15))
STONE = mat("Tideland fractured granite", (.34, .34, .31), .03, .96)
STONE_LIGHT = mat("Tideland exposed fracture planes", (.43, .42, .37), .02, .98)
STONE_COLD = mat("Tideland alpine slate", (.25, .29, .31), .025, .94)
MOSS = mat("Tideland rock moss", (.15, .18, .13), .0, .98)
DRUM_ENAMEL = mat("Tideland faded harbor drum enamel", (.17, .28, .27), .24, .72)
DRUM_RUST = mat("Tideland flaking drum corrosion", (.31, .17, .105), .18, .94)
DRUM_DARK = mat("Tideland drum bung recess", (.075, .09, .085), .08, .86)

def box(name, loc, scale, material, bevel_width=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel_width:
        bevel = obj.modifiers.new("worn edge bevel", "BEVEL")
        bevel.width = bevel_width
        bevel.segments = 1
        obj.modifiers.new("weighted corner normals", "WEIGHTED_NORMAL")
    return obj

def rod(name, a, b, radius, material, sides=8):
    start, end = Vector(a), Vector(b)
    direction = end - start
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=radius*.88,
                                    depth=direction.length, location=(start+end)*.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    return obj

def plank(name, xs, lower, upper, width, sign, material, seed):
    rng = random.Random(seed)
    verts = []
    for x in xs:
        taper = max(.15, 1 - (abs(x)/4.35)**2)
        jitter = rng.uniform(-.035, .035)
        for z in (lower+jitter, upper+jitter):
            edge_width = width * taper
            verts.extend(((x, sign*edge_width, z), (x, sign*(edge_width*.70), z+.055)))
    faces=[]
    for i in range(len(xs)-1):
        a=i*4; b=a+4
        faces.extend(((a,a+1,b+1,b),(a+1,a+3,b+3,b+1),(a+2,a,b,b+2)))
    mesh=bpy.data.meshes.new(name+" mesh"); mesh.from_pydata(verts,[],faces);mesh.materials.append(material);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    return obj

def shipwreck(variant=0):
    rng=random.Random(1703+variant)
    # Open-topped, curved shell made from broken timber courses and exposed ribs.
    for side in (-1,1):
        for row in range(4):
            z0=.12+row*.31
            cuts=11 if variant==0 else 9
            xs=[-4.0+i*8.0/cuts for i in range(cuts+1)]
            gap_index=(3+variant*2+row)%cuts
            if row in (1,3):
                xs=[x for i,x in enumerate(xs) if not (gap_index<=i<=gap_index+1)]
            plank("split hull plank",xs,z0,z0+.235,.68-row*.06,side,
                  (WOOD_DARK,WOOD,WOOD_LIGHT)[(row+variant)%3],variant*51+side*5+row)
        for rib in range(9):
            x=-3.65+rib*.91
            arch=math.sqrt(max(.08,1-(x/4.2)**2))
            top=.28+arch*.93+rng.uniform(-.14,.15)
            rod("exposed bent hull rib",(x,side*.08,.12),(x,side*(.62*arch),top),.065 if rib%3 else .085,RUST if rib%3==0 else WOOD_LIGHT,7)
    rod("keel beam",(-3.9,0,.12),(3.8,0,.18),.11,WOOD_DARK,9)
    # Broken bow and stern stakes give a readable irregular silhouette.
    for x,h,lean in ((-3.85,1.2,-.24),(3.65,.72,.18),(-3.35,.82,.14)):
        obj=rod("splintered stem",(x,0,.12),(x+lean,.04,h),.095,WOOD_LIGHT,7)
    for i in range(12):
        x=rng.uniform(-3.2,3.2); z=rng.uniform(.55,1.28); y=rng.choice((-1,1))*rng.uniform(.28,.63)
        end=(x+rng.uniform(-.38,.38),y+rng.uniform(-.16,.16),z+rng.uniform(.12,.48))
        rod("fractured deck spar",(x,y,z),end,rng.uniform(.035,.075),WOOD_LIGHT if i%3 else RUST,6)
    for x in (-2.75,-1.15,.55,2.25):
        box("corroded hull patch",(x,-.635,.52),(.50,.032,.22),RUST,.025)
    # Welded eyelets and short mooring line fragments.
    for x in (-3.4,2.95):
        bpy.ops.mesh.primitive_torus_add(major_radius=.10,minor_radius=.022,major_segments=12,minor_segments=5,location=(x,-.70,.49),rotation=(math.pi/2,0,0))
        bpy.context.object.name="rusted mooring eye";bpy.context.object.data.materials.append(RUST)

def wreck_section():
    rng=random.Random(9207)
    # A single torn quarter of a hull: the cutaway edge is open and the
    # surviving ribs lean at different angles so it reads as debris, not a
    # second intact boat.
    for row in range(3):
        start=-1.85+row*.19
        xs=[start+i*.31 for i in range(9)]
        if row!=1:
            xs=[x for i,x in enumerate(xs) if i not in (3,4)]
        plank("torn wreck-section plank",xs,.10+row*.30,.32+row*.30,
              .49-row*.055,1,(WOOD_DARK,WOOD,WOOD_LIGHT)[row],9207+row)
    for i,x in enumerate((-1.55,-.62,.28,1.18,1.72)):
        lean=rng.uniform(-.24,.3)
        rod("broken exposed wreck rib",(x,0,.08),(x+lean,.50,.72+rng.uniform(-.18,.38)),
            .075 if i%2 else .10,WOOD_LIGHT,7)
    rod("splintered keel fragment",(-1.8,0,.08),(1.4,0,.12),.09,WOOD_DARK,7)
    for i in range(5):
        x=rng.uniform(-1.4,1.4)
        rod("loose snapped beam",(x,.12,.16),(x+rng.uniform(-.35,.35),rng.uniform(.3,.8),rng.uniform(.42,.95)),.045,WOOD_LIGHT,6)
    for x in (-1.08,.92):
        box("oxidized torn hull strap",(x,.515,.45),(.27,.025,.14),RUST,.018)

def broadleaf_foliage(kind, centers, seed):
    rng=random.Random(seed+7341);verts=[];faces=[];material_indices=[]
    for center,radius,amount in centers:
        for _ in range(amount):
            angle=rng.uniform(0,math.tau);vertical=rng.uniform(-.68,.92)
            direction=Vector((math.cos(angle),math.sin(angle),vertical)).normalized()
            base=Vector(center)+Vector((rng.uniform(-.20,.20),rng.uniform(-.18,.18),rng.uniform(-.15,.17)))
            length=rng.uniform(.58,.98)*(1.08 if kind=="coastal_tree" else 1)
            width=rng.uniform(.16,.28);tip=base+direction*length
            side=direction.cross(Vector((0,0,1)))
            if side.length<.1:side=direction.cross(Vector((0,1,0)))
            side.normalize();front=direction.cross(side).normalized()
            mid=base+direction*length*.48
            left=mid-side*width;right=mid+side*width
            ridge=mid+front*width*.30;under=mid-front*width*.24
            start=len(verts);verts.extend([tuple(base),tuple(left),tuple(ridge),tuple(right),tuple(tip),tuple(under)])
            local=((0,1,2),(0,2,3),(1,4,2),(2,4,3),(0,2,1),(0,3,2),(1,2,4),(2,3,4))
            faces.extend(tuple(start+index for index in face) for face in local)
            shade=0 if rng.random()<.57 else 1 if rng.random()<.58 else 2
            material_indices.extend([shade]*len(local))
    mesh=bpy.data.meshes.new("individually modeled three-dimensional leaf blades");mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new("layered broadleaf sprays",mesh);bpy.context.collection.objects.link(obj)
    for material in (LEAF,LEAF_LIGHT,LEAF_SHADE):mesh.materials.append(material)
    for polygon,index in zip(mesh.polygons,material_indices):polygon.material_index=index
    return obj

def tree(kind):
    broadleaf=kind.startswith("broadleaf") or kind in ("marsh_tree","coastal_tree")
    alpine=kind=="alpine_conifer"
    variant=ord(kind[-1])-ord("a") if kind[-1].isalpha() and kind[-1] in "abc" else 0
    seed=sum((index+1)*ord(char) for index,char in enumerate(kind))+8101
    rng=random.Random(seed)
    h=TREE_HEIGHTS[kind]
    lean=rng.uniform(-.28,.28) if kind in ("coastal_tree","marsh_tree") else rng.uniform(-.12,.12)
    # A tapered, subtly bent bole with a broad root flare; marsh variants add
    # exposed wetland roots instead of a generic straight trunk.
    rings=[]
    for z,radius,offset in ((0,.47,0),(.35,.38,lean*.20),(1.8,.29,lean*.42),(4.6,.205,lean*.72),(h*.72,.15,lean)):
        rings.append((z,radius,offset))
    verts=[]; sides=9
    for z,radius,offset in rings:
        for i in range(sides):
            angle=2*math.pi*i/sides
            variation=1+.11*math.sin(i*4.2+z+seed*.01)+.045*math.sin(i*7.7-z*.3)
            verts.append((offset+math.cos(angle)*radius*variation,math.sin(angle)*radius*variation,z))
    faces=[]
    for row in range(len(rings)-1):
        for i in range(sides): faces.append((row*sides+i,row*sides+(i+1)%sides,(row+1)*sides+(i+1)%sides,(row+1)*sides+i))
    faces.append(tuple(range((len(rings)-1)*sides,len(rings)*sides)))
    mesh=bpy.data.meshes.new("tapered irregular trunk mesh");mesh.from_pydata(verts,[],faces);mesh.materials.append(BARK);mesh.update()
    trunk=bpy.data.objects.new("tapered trunk with root flare",mesh);bpy.context.collection.objects.link(trunk)
    root_count=8 if kind=="marsh_tree" else 6
    for i in range(root_count):
        a=i*math.tau/root_count+rng.uniform(-.14,.14)
        reach=rng.uniform(1.0,1.65) if kind=="marsh_tree" else rng.uniform(.82,1.24)
        end=(lean*.2+math.cos(a)*reach,math.sin(a)*reach*.82,.025)
        rod("splayed wetland buttress root" if kind=="marsh_tree" else "root flare",(0,0,.65),end,.16 if kind=="marsh_tree" else .19,BARK,7)
    branch_count=(10+variant*2) if broadleaf and kind.startswith("broadleaf") else (9 if kind=="coastal_tree" else 8 if kind=="marsh_tree" else 8+variant)
    for i in range(branch_count):
        angle=i*math.tau/branch_count+rng.uniform(-.32,.32)
        start_z=h*(.42+rng.random()*.31); reach=rng.uniform(1.45,2.65)*(1.12 if kind=="coastal_tree" else 1)
        start=(lean*start_z/h,0,start_z); end=(start[0]+math.cos(angle)*reach,math.sin(angle)*reach*.72,start_z+rng.uniform(.55,1.65))
        rod("primary branch",start,end,rng.uniform(.075,.13),BARK,7)
        for split in range(2+(1 if rng.random()<.35 else 0)):
            t=.48+split*.16;base=tuple(start[j]*(1-t)+end[j]*t for j in range(3))
            side=angle+(-1 if split%2==0 else 1)*rng.uniform(.42,1.05)
            twig=(base[0]+math.cos(side)*rng.uniform(.62,.98),base[1]+math.sin(side)*.7,base[2]+rng.uniform(.35,.78))
            rod("secondary branch",base,twig,.038 if split else .048,BARK,6)
    if broadleaf:
        cluster_count={"broadleaf_a":20,"broadleaf_b":24,"broadleaf_c":18,"marsh_tree":14,"coastal_tree":16}[kind]
        clusters=[]
        for i in range(cluster_count):
            angle=i*2.399963+rng.uniform(-.22,.22)
            radius=rng.uniform(.62,1.28) if i%3 else rng.uniform(1.18,1.82)
            z=h*rng.uniform(.62,.96);loc=(lean*z/h+math.cos(angle)*radius,math.sin(angle)*radius*.72,z)
            clusters.append((loc,radius,16 if kind.startswith("broadleaf") else 13))
        clusters.append(((lean*.8,0,h*.81),.8,38))
        broadleaf_foliage(kind,clusters,seed)
    else:
        tiers=8 if alpine else 9+variant
        for tier in range(tiers):
            z=1.35+tier*(h-2.2)/tiers
            radius=(1-tier/(tiers+.8))*rng.uniform(2.15,2.85)*(0.83 if alpine else 1)
            whorl=4+(tier%2)
            for branch in range(whorl):
                angle=branch*math.tau/whorl+tier*1.71+rng.uniform(-.20,.20)
                length=radius*rng.uniform(.78,1.12)
                start=(lean*z/h,0,z);end=(start[0]+math.cos(angle)*length,math.sin(angle)*length,z-rng.uniform(.18,.48))
                rod("layered needle bough",start,end,.055 if alpine else .065, BARK,6)
                for offset in (.64,):
                    center=tuple(start[j]*(1-offset)+end[j]*offset for j in range(3))
                    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=center)
                    needles=bpy.context.object;needles.name="volumetric needle spray";needles.scale=(length*.30,length*.23,.20 if alpine else .25)
                    for vertex in needles.data.vertices:vertex.co*=1+.08*math.sin(vertex.co.x*7+vertex.co.z*4+tier)
                    for face in needles.data.polygons:face.use_smooth=True
                    needles.data.materials.append(NEEDLE)
                if rng.random()<.28:
                    center=tuple(start[j]*.30+end[j]*.70 for j in range(3))
                    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=center)
                    needles=bpy.context.object;needles.name="secondary needle spray";needles.scale=(length*.21,length*.18,.15 if alpine else .19)
                    for face in needles.data.polygons:face.use_smooth=True
                    needles.data.materials.append(NEEDLE)

def palm_tree():
    """A wind-shaped coastal palm with one fibrous bole and feathered fronds."""
    rng=random.Random(62183);height=9.6;lean=-.18;sides=14
    rings=((0,.49,0),(.34,.43,lean*.08),(1.5,.34,lean*.25),(4.0,.265,lean*.48),(7.1,.225,lean*.78),(9.15,.25,lean))
    verts=[]
    for z,radius,offset in rings:
        for side in range(sides):
            angle=side*math.tau/sides
            variation=1+.045*math.sin(side*3.7+z*1.1)+.022*math.sin(side*6.1-z*.7)
            verts.append((offset+math.cos(angle)*radius*variation,math.sin(angle)*radius*variation,z))
    faces=[]
    for row in range(len(rings)-1):
        for side in range(sides):
            a=row*sides+side;b=row*sides+(side+1)%sides
            faces.append((a,b,b+sides,a+sides))
    mesh=bpy.data.meshes.new("wind-bent fibrous palm bole mesh");mesh.from_pydata(verts,[],faces);mesh.materials.append(BARK);mesh.update()
    trunk=bpy.data.objects.new("palm bark trunk",mesh);bpy.context.collection.objects.link(trunk)
    # Old frond bases leave close-set, shallow ridges around the upper bole.
    for z in (5.9,6.25,6.60,6.95,7.30,7.65,8.0,8.35,8.7):
        radius=.225-(z-7.1)*.006
        bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.018,major_segments=14,minor_segments=4,location=(lean*z/height,0,z))
        scar=bpy.context.object;scar.name="raised palm frond scar";scar.data.materials.append(BARK)
    # Each feather frond has a curved, tapered rachis and individually shaped
    # pinnae. All leaflets are combined into one mesh/material set per LOD.
    leaf_verts=[];leaf_faces=[];leaf_materials=[]
    anchor=(lean*.94,0,9.05)
    for frond in range(10):
        angle=frond*math.tau/10+rng.uniform(-.11,.11)
        radial=Vector((math.cos(angle),math.sin(angle),0));side=Vector((-radial.y,radial.x,0))
        reach=rng.uniform(3.55,4.25);droop=rng.uniform(1.25,1.75)
        spine=[]
        for t in (0,.30,.64,1):
            spine.append(Vector(anchor)+radial*(reach*t)+Vector((0,0,.40*math.sin(math.pi*t)-droop*t*t)))
        for index in range(len(spine)-1):
            rod("arched palm frond rachis",tuple(spine[index]),tuple(spine[index+1]),.075*(1-index*.19),WOOD_LIGHT,7)
        for leaflet in range(15):
            t=.08+leaflet*.056
            segment=min(2,int(t*3));local=(t-segment/3)*3
            center=spine[segment].lerp(spine[segment+1],local)
            length=(.62+1.22*math.sin(math.pi*(t*.88+.06)))*rng.uniform(.84,1.12)*(1-.24*t)
            width=.108*(1-.32*t);fall=length*(.24+.28*t)
            for sign in (-1,1):
                outward=(side*sign*.90+radial*.28).normalized()
                base=center+side*sign*.045
                shoulder=base+outward*(length*.48)+Vector((0,0,-fall*.20))
                tip=base+outward*length+Vector((0,0,-fall))
                inner=shoulder-side*sign*width;outer=shoulder+side*sign*width
                ridge=shoulder+Vector((0,0,.025))
                first=len(leaf_verts);leaf_verts.extend((tuple(base),tuple(inner),tuple(ridge),tuple(outer),tuple(tip)))
                leaf_faces.extend(((first,first+1,first+2),(first,first+2,first+3),(first+1,first+4,first+2),(first+2,first+4,first+3)))
                shade=0 if rng.random()<.55 else 1 if rng.random()<.68 else 2
                leaf_materials.extend((shade,shade,shade,shade))
    leaf_mesh=bpy.data.meshes.new("hand-shaped pinnate palm leaflet mesh");leaf_mesh.from_pydata(leaf_verts,[],leaf_faces)
    for material in (LEAF,LEAF_LIGHT,LEAF_SHADE):leaf_mesh.materials.append(material)
    for polygon,index in zip(leaf_mesh.polygons,leaf_materials):polygon.material_index=index
    leaf_mesh.update();crown=bpy.data.objects.new("feathered coastal palm crown",leaf_mesh);bpy.context.collection.objects.link(crown)

def rock(name):
    seed=sum((index+1)*ord(char) for index,char in enumerate(name))+994
    rng=random.Random(seed)
    if name.startswith("small_rock"): dimensions=(.82,.66,.72);subdivisions=2
    elif name.startswith("medium_rock"): dimensions=(1.45,1.18,1.12);subdivisions=2
    elif name.startswith("large_boulder"): dimensions=(2.35,1.86,1.72);subdivisions=3
    elif name=="broken_stone": dimensions=(.94,.52,.43);subdivisions=1
    elif name=="coastal_rock": dimensions=(1.8,1.20,1.10);subdivisions=2
    elif name=="alpine_rock": dimensions=(1.65,1.22,2.0);subdivisions=2
    elif name=="coastal_boulder_a": dimensions=(1.8,1.38,1.05);subdivisions=2
    else: dimensions=(1.25,1.0,.8);subdivisions=2
    if name.startswith("cliff_slab"):
        # A chipped, stratified ledge block built as a faceted rock face rather
        # than a stretched primitive; one broad sloped face reads from afar.
        verts=[];sides=10;phase=rng.uniform(-.25,.25)
        for level in range(3):
            for i in range(sides):
                angle=math.tau*i/sides+phase
                jag=rng.uniform(.68,1.27)
                x=math.cos(angle)*(3.0 if level==0 else 2.55 if level==1 else 2.05)*jag
                y=math.sin(angle)*(1.10 if level==0 else .88 if level==1 else .67)*jag
                peak=max(0,math.cos(angle*1.15+(0 if name.endswith("a") else 1.1)))
                z=(0 if level==0 else 1.25 if level==1 else 3.0+peak*rng.uniform(.25,1.25))+rng.uniform(-.24,.24)
                if name.endswith("b") and level==2:x+=.92*math.sin(angle*1.3)
                verts.append((x,y,z))
        faces=[]
        for level in range(2):
            for i in range(sides):
                a=level*sides+i;b=level*sides+(i+1)%sides
                c=(level+1)*sides+(i+1)%sides;d=(level+1)*sides+i
                if (i+level)%2:faces.extend(((a,b,c),(a,c,d)))
                else:faces.extend(((a,b,d),(b,c,d)))
        faces.append(tuple(range(2*sides,3*sides)))
        mesh=bpy.data.meshes.new("broken stratified cliff mesh");mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new(name+" fractured ledge",mesh);bpy.context.collection.objects.link(obj)
        materials=[STONE_COLD if name.endswith("b") else STONE,STONE_LIGHT,MOSS]
        for material in materials:mesh.materials.append(material)
        for face in mesh.polygons:
            face.material_index=2 if face.normal.z>.72 and rng.random()<.22 else 1 if rng.random()<.32 else 0
        return obj
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions,radius=1,location=(0,0,0))
    obj=bpy.context.object;obj.name="chipped stratified stone mass"
    cold=name=="alpine_rock";coastal=name.startswith("coastal")
    for vertex in obj.data.vertices:
        co=vertex.co.copy()
        noise=1+.12*math.sin(co.x*7.1+co.y*3.2+seed*.003)*math.sin(co.z*6.4-co.x*2.1)+rng.uniform(-.065,.065)
        # Flatten one or more planes into chipped facets and skew the crown;
        # scale variation remains in vertex positions for clean GLB transforms.
        x=co.x*dimensions[0]*noise;y=co.y*dimensions[1]*noise;z=co.z*dimensions[2]*noise
        if name.startswith("large_boulder"):
            # A deterministic diagonal fracture plane chips one shoulder so
            # large stones read as broken strata, not subdivided spheres.
            plane=x+z*(.22 if name.endswith("a") else -.18);cut=dimensions[0]*(.54 if name.endswith("b") else .60)
            if plane>cut:
                excess=(plane-cut)/(1+(.22 if name.endswith("a") else -.18)**2);slope=.22 if name.endswith("a") else -.18
                x-=excess;z-=excess*slope
        if name=="broken_stone":z*=.72
        if coastal:x+=.18*co.z;y*=.92
        if cold:z+=.16*co.x
        vertex.co=(x,y,z+dimensions[2]*.99)
    obj.data.materials.append(STONE_COLD if cold else STONE);obj.data.materials.append(STONE_LIGHT);obj.data.materials.append(MOSS)
    for face in obj.data.polygons:
        centroid=face.center
        slope=.22 if name.endswith("a") else -.18
        fractured=name.startswith("large_boulder") and abs(centroid.x+centroid.z*slope-dimensions[0]*(.54 if name.endswith("b") else .60))<.13 or (face.normal.x<-.52 and rng.random()<.28) or rng.random()<.08
        moss_slope=.64 if name.startswith("large_boulder") else .48
        moss_chance=.025 if name.startswith("large_boulder") else .12 if coastal else .07
        if face.normal.z>moss_slope and rng.random()<moss_chance:face.material_index=2
        elif fractured:face.material_index=1
    obj.data.update();return obj

def driftwood():
    rng=random.Random(123)
    for i in range(3):
        offset=(i-1)*.17
        start=(-1.65,offset,.18+abs(offset)*.3);end=(1.55+rng.uniform(-.2,.2),offset+rng.uniform(-.14,.14),.08+rng.uniform(-.03,.08))
        rod("salt-split driftwood",start,end,.15-i*.025,WOOD_LIGHT if i==1 else WOOD,7)
        for j in range(4):
            t=.18+j*.2;x=start[0]*(1-t)+end[0]*t;y=start[1]*(1-t)+end[1]*t;z=start[2]*(1-t)+end[2]*t
            rod("ragged branch stub",(x,y,z),(x+rng.uniform(-.28,.28),y+rng.uniform(-.18,.18),z+rng.uniform(.12,.38)),.055,WOOD_DARK,6)

def crate():
    box("weathered salvage crate core",(0,0,.38),(.92,.78,.72),WOOD,.08)
    for z in (.1,.30,.50,.69):
        box("separate crate board",(0,-.405,z),(.90,.035,.13),WOOD_LIGHT,.012)
    for x in (-.4,.4):
        box("corner iron strap",(x,-.432,.39),(.055,.025,.68),RUST,.01)
        for z in (.12,.64):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.028,location=(x,-.45,z));bpy.context.object.name="crate strap rivet";bpy.context.object.data.materials.append(WOOD_DARK)

def coastal_drum():
    sides=16
    # A hand-profiled bulged shell on its side. Distinct hoop sections, a
    # dented crown and separate end heads make it read as a cargo drum rather
    # than a smoothed cylinder; all parts merge into one mesh before export.
    profile=[(-.39,.205),(-.365,.232),(-.335,.244),(-.305,.246),(-.278,.255),(-.245,.272),(-.18,.291),(-.08,.301),(.04,.302),(.15,.292),(.225,.276),(.265,.258),(.292,.249),(.322,.248),(.352,.236),(.38,.209)]
    verts=[]
    for x,radius in profile:
        for side in range(sides):
            angle=side*math.tau/sides
            dent=1.-.095*math.exp(-((x-.19)/.10)**2-((angle-2.7)/.56)**2)
            out=radius*dent*(1.+.012*math.sin(side*3.1+x*14))
            verts.append((x,math.cos(angle)*out,math.sin(angle)*out))
    faces=[];materials=[]
    for row in range(len(profile)-1):
        band=(profile[row][0] < -.278 and profile[row+1][0] <= -.278) or (profile[row][0] >= .265 and profile[row+1][0] <= .292)
        for side in range(sides):
            faces.append((row*sides+side,row*sides+(side+1)%sides,(row+1)*sides+(side+1)%sides,(row+1)*sides+side))
            angle=(side+.5)*math.tau/sides;weathered=math.sin(angle*4+row*1.7)>.83
            materials.append(1 if band or weathered else 0)
    for end,reverse in ((0,True),(len(profile)-1,False)):
        center=len(verts);x=profile[end][0];verts.append((x,0,0));ring=end*sides
        for side in range(sides):faces.append((center,ring+(side+1)%sides,ring+side) if reverse else (center,ring+side,ring+(side+1)%sides));materials.append(2)
    mesh=bpy.data.meshes.new("rolled cargo drum with profiled shell and end heads");mesh.from_pydata(verts,[],faces);mesh.materials.append(DRUM_ENAMEL);mesh.materials.append(DRUM_RUST);mesh.materials.append(DRUM_DARK)
    for polygon,index in zip(mesh.polygons,materials):polygon.material_index=index
    mesh.update();shell=bpy.data.objects.new("dented enamel cargo drum",mesh);bpy.context.collection.objects.link(shell)
    for polygon in mesh.polygons:polygon.use_smooth=len(polygon.vertices)==4
    # Fill ports sit on the upper surface, with a recessed hex plug and a
    # raised rolled lip. Their slight irregularity matches the damaged shell.
    for x,radius in ((-.07,.044),(.17,.032)):
        z=.296 if x<0 else .285
        bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.009,major_segments=12,minor_segments=5,location=(x,-.035,z))
        lip=bpy.context.object;lip.name="raised drum fill-port lip";lip.data.materials.append(DRUM_RUST)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=radius*.67,depth=.009,location=(x,-.035,z-.003))
        plug=bpy.context.object;plug.name="recessed drum bung";plug.data.materials.append(DRUM_DARK)

def export_collision_proxy(name, lod_objects):
    """Write a lightweight Y-up proxy containing every exported visual LOD."""
    if name in TREE_HEIGHTS:
        radius=.34 if name in ("alpine_conifer","palm_tree_a") else .38
        height=TREE_HEIGHTS[name]
        proxy={"type":"capsule","axis":"y","center":[0,round(height*.5,4),0],"radius":radius,"halfHeight":round((height-2*radius)*.5,4)}
    else:
        vertices=[vertex.co for obj in lod_objects for vertex in obj.data.vertices]
        minimum=[min(vertex[axis] for vertex in vertices) for axis in range(3)]
        maximum=[max(vertex[axis] for vertex in vertices) for axis in range(3)]
        # Blender Z-up -> glTF/Three.js Y-up; the asset exporter also flips Blender Y.
        center=[(minimum[0]+maximum[0])*.5, (minimum[2]+maximum[2])*.5, -(minimum[1]+maximum[1])*.5]
        half=[(maximum[0]-minimum[0])*.5, (maximum[2]-minimum[2])*.5, (maximum[1]-minimum[1])*.5]
        proxy={"type":"box","center":[round(value,4) for value in center],"halfExtents":[round(max(value,.01),4) for value in half]}
    payload={"asset":name,"units":"meters","coordinateSystem":"gltf-y-up","source":"LOD0/LOD1/LOD2","usage":"coarse authoring proxy; runtime gameplay colliders remain separately authored","shapes":[proxy]}
    os.makedirs(COLLISION_OUT,exist_ok=True)
    with open(os.path.join(COLLISION_OUT,name+".json"),"w",encoding="utf8") as file:
        json.dump(payload,file,separators=(",",":"),sort_keys=True)
        file.write("\n")

def create(name):
    reset()
    if name in ("shipwreck_hull_a","shipwreck_hull_b"):shipwreck(0 if name.endswith("_a") else 1)
    elif name=="wreck_section_a":wreck_section()
    elif name=="palm_tree_a":palm_tree()
    elif name in ("broadleaf_a","broadleaf_b","broadleaf_c","conifer_a","conifer_b","conifer_c","alpine_conifer","marsh_tree","coastal_tree"):tree(name)
    elif name in ("coastal_boulder_a","small_rock_a","small_rock_b","small_rock_c","medium_rock_a","medium_rock_b","medium_rock_c","large_boulder_a","large_boulder_b","large_boulder_c","coastal_rock","alpine_rock","cliff_slab_a","cliff_slab_b","broken_stone"):rock(name)
    elif name=="driftwood_a":driftwood()
    elif name=="salvage_crate_a":crate()
    elif name=="coastal_drum_a":coastal_drum()
    # Normalize transforms and combine each asset into one mesh per LOD while preserving material slots.
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if name=="salvage_crate_a":
        # The crate's many beveled boards and rivets produced unstable topology
        # when Blender evaluated their merged modifier stack during GLB export.
        # Bake each part in its own stack order before joining it.
        for part in meshes:
            bpy.ops.object.select_all(action="DESELECT")
            part.select_set(True);bpy.context.view_layer.objects.active=part
            while part.modifiers:bpy.ops.object.modifier_apply(modifier=part.modifiers[0].name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1:bpy.ops.object.join()
    source=bpy.context.object;source.name=name+" LOD0 mesh"
    source.data.validate(verbose=False,clean_customdata=True)
    source.data.update()
    source.location=(0,0,0);source.rotation_euler=(0,0,0);source.scale=(1,1,1)
    root=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(root)
    levels=(1.0,.48,.16)
    lod_objects=[]
    for index,ratio in enumerate(levels):
        obj=source if index==0 else source.copy()
        if index:obj.data=source.data.copy();bpy.context.scene.collection.objects.link(obj)
        group=bpy.data.objects.new("LOD"+str(index),None);bpy.context.scene.collection.objects.link(group);group.parent=root
        obj.name=name+" LOD"+str(index);obj.parent=group
        if ratio<1 and name!="salvage_crate_a":
            # Bake bevel/normal modifiers first so decimation operates on the evaluated mesh.
            bpy.context.view_layer.objects.active=obj;obj.select_set(True)
            for existing in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=existing.name)
            mod=obj.modifiers.new("browser LOD reduction","DECIMATE");mod.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=mod.name);obj.select_set(False)
            obj.data.validate(verbose=False,clean_customdata=True);obj.data.update()
        obj.location=(0,0,0);obj.rotation_euler=(0,0,0);obj.scale=(1,1,1)
        lod_objects.append(obj)
    export_collision_proxy(name,lod_objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root]+[o for o in bpy.context.scene.objects if o.parent==root or (o.parent and o.parent.parent==root)]:obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    path=os.path.join(OUT,name+".glb")
    bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",use_selection=True,export_apply=True,export_yup=True,export_materials="EXPORT")
    print("Exported",name,path,os.path.getsize(path),"bytes",flush=True)

os.makedirs(OUT,exist_ok=True)
arguments=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
requested=arguments[arguments.index("--ids")+1:] if "--ids" in arguments else []
unknown=set(requested)-set(CATALOG)
if unknown: raise ValueError("Unknown world asset IDs: "+", ".join(sorted(unknown)))
for asset in CATALOG:
    if not requested or asset in requested:create(asset)
