"""Equipment sockets, fitted open holster, and four animated exhaust outlets."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def frame(head, forward, up):
    y = Vector(forward).normalized()
    x = y.cross(Vector(up)).normalized()
    z = x.cross(y).normalized()
    mat = Matrix((x, y, z)).transposed().to_4x4()
    mat.translation = Vector(head)
    return mat


def material(name, color, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = .46
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


class Part:
    def __init__(self):
        self.vertices, self.faces, self.materials, self.weights = [], [], [], []

    def vertex(self, point, mat, bone):
        self.vertices.append(mat @ Vector(point))
        self.weights.append(bone)
        return len(self.vertices)-1

    def face(self, indices, slot):
        self.faces.append(indices)
        self.materials.append(slot)

    def bridge(self, a, b, slot):
        for i in range(len(a)):
            self.face([a[i-1],a[i],b[i],b[i-1]],slot(i) if callable(slot) else slot)

    def box(self, minimum, maximum, mat, bone, slot):
        x,y,z = minimum
        X,Y,Z = maximum
        one = [self.vertex(p,mat,bone) for p in ((x,y,z),(X,y,z),(X,y,Z),(x,y,Z))]
        two = [self.vertex(p,mat,bone) for p in ((x,Y,z),(X,Y,z),(X,Y,Z),(x,Y,Z))]
        self.face(one,slot)
        self.bridge(one,two,slot)
        self.face(two,slot)

    def finish(self, name, rig, materials):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices,[],self.faces)
        for mat in materials:
            mesh.materials.append(mat)
        for poly,slot in zip(mesh.polygons,self.materials):
            poly.material_index=slot
        bm=bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        obj=bpy.data.objects.new(name,mesh)
        rig.users_collection[0].objects.link(obj)
        obj.parent=rig
        for bone in dict.fromkeys(self.weights):
            vg=obj.vertex_groups.new(name=bone)
            vg.add([i for i,n in enumerate(self.weights) if n==bone],1,'REPLACE')
        obj.modifiers.new('Equipment skin','ARMATURE').object=rig
        return obj


def holster(rig, base):
    part = Part()
    bone = 'Holster.L'
    graphite = material('Holster • graphite composite',(.045,.054,.062),.52)
    edging = material('Holster • satin edge',(.100,.117,.127),.67)
    lining = material('Holster • charcoal lining',(.014,.019,.022),.05)
    fastener = material('Holster • dark fasteners',(.24,.26,.27),.77)

    # These are sections across the grapple's barrel (local +Y is the muzzle).
    # The upper lip is open and falls below the protruding raked grip.
    def ring(y, width, lo, hi, chamfer):
        coords = ((-width+chamfer,lo),(width-chamfer,lo),(width,lo+chamfer),
                  (width,hi-chamfer),(width-chamfer,hi),(-width+chamfer,hi),
                  (-width,hi-chamfer),(-width,lo+chamfer))
        return [part.vertex((x,y,z),base,bone) for x,z in coords]

    rim=ring(.061,.053,-.013,.167,.012)
    lip=ring(.071,.053,-.013,.167,.012)
    waist=ring(.22,.050,.004,.161,.011)
    heel=ring(.305,.046,.039,.153,.008)
    floor=ring(.306,.038,.046,.146,.007)
    throat=ring(.061,.042,-.003,.155,.007)
    part.bridge(rim,lip,1)
    part.bridge(lip,waist,0)
    part.bridge(waist,heel,0)
    part.bridge(heel,floor,1)
    part.bridge(floor,throat,2)
    part.bridge(throat,rim,1)
    # A rigid belt bracket and retention ribs make the open carrier readable
    # even with the pistol drawn. Side walls leave the blue grip heel exposed.
    # The rail faces forward, so +X in this socket points toward the thigh.
    part.box((.043,-.012,.041),(.057,.101,.135),base,bone,1)
    part.box((.052,-.014,.055),(.082,.035,.121),base,bone,0)
    for y in (.100,.151,.202):
        part.box((-.054,y,.026),(-.048,y+.012,.145),base,bone,1)
    for z in (.044,.126):
        part.box((-.057,.101,z),(-.052,.111,z+.011),base,bone,3)
    return part.finish('Equipment • left grapple holster',rig,[graphite,edging,lining,fastener])


def exhaust(rig, frames):
    part=Part()
    materials=[
        material('Exhaust • hot gold',(1,.64,.088),0,2.4),
        material('Exhaust • amber',(1,.285,.022),0,1.8),
        material('Exhaust • ember',(.90,.073,.006),0,1.3),
        material('Exhaust • burst core',(1,.89,.34),0,4.0),
    ]
    for name,base in frames.items():
        burst = name.startswith('Burst.')
        back = '.Back.' in name
        width,depth,length = (.045,.012,.60) if back else (.031,.031,.76)
        if burst:
            width,depth,length = width*.57,depth*.62,length*1.35
        previous=None
        for k,(u,s) in enumerate(((0,.76),(.045,1.30),(.16,1.54),(.36,1.17),(.61,.72),(.82,.34),(1,.012))):
            points=[]
            for j in range(8):
                theta = (j+.5)*math.tau/8
                radius=s*(1+.06*math.sin(3*theta+u*4))
                x = math.cos(theta)*width*radius
                z = math.sin(theta)*depth*radius
                if back:
                    # Rounded rectangle section fills the slim exhaust slot.
                    x = math.copysign(abs(math.cos(theta))**.45,math.cos(theta))*width*radius
                points.append(part.vertex((x,u*length,z),base,name))
            if previous:
                part.bridge(previous,points, 3 if burst else lambda j: (0 if k<=2 and j%3 else 1 if k<6 else 2))
            else:
                part.face(points,3 if burst else 0)
            previous=points
        part.face(previous,3 if burst else 2)
    return part.finish('Equipment • flight exhaust',rig,materials)


def add_equipment(rig):
    rest=rig.data.bones
    sockets={}
    for side,sign in (('L',1),('R',-1)):
        wrist=rest['hand.'+side].head_local.copy()
        p=wrist+Vector((-.030*sign,-.010,-.086))
        sockets['grip.'+side]=(frame(p,(0,-.10,-1),(0,-1,.10)),'hand.'+side)
    hip=frame((.305,.060,.954),(0,-.09,-1),(0,-1,.09))
    sockets['Holster.L']=(hip,'thigh.L')
    sockets['GrapplePark']=(hip,'Holster.L')
    sockets['GrappleCarry']=(sockets['grip.L'][0],'grip.L')
    frames={}
    for side,sign in (('L',1),('R',-1)):
        for place,point,axis,parent in (
                ('Back',(.094*sign,.1895,1.142),(0,.21,-1),'chest'),
                ('Boot',(.175*sign,-.039,.023),(0,0,-1),'foot.'+side)):
            socket=frame(point,axis,(0,1,0))
            outlet=f'Nozzle.{place}.{side}'
            sockets[outlet]=(socket,parent)
            for effect in ('FX','Burst'):
                name=f'{effect}.{place}.{side}'
                sockets[name]=(socket,outlet)
                frames[name]=socket
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    group=rig.data.collections.new('Equipment sockets')
    for name,(mat,parent) in sockets.items():
        bone=rig.data.edit_bones.new(name)
        bone.head=mat.translation
        bone.tail=bone.head+mat.col[1].xyz*.055
        bone.align_roll(mat.col[2].xyz)
        bone.parent=rig.data.edit_bones[parent]
        group.assign(bone)
    bpy.ops.object.mode_set(mode='OBJECT')
    return [holster(rig,hip),exhaust(rig,frames)]
