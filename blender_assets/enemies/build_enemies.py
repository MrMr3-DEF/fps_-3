"""Run with Blender in background mode to rebuild the three infantry assets."""
import math
import random
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

OUT = Path(__file__).resolve().parent.parent
V = Vector
TAU = math.tau


def material(name, color, metal=0.6, glow=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = 0.62
    if glow:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = 2
    return mat


def plate_material():
    mat = material("Pitted nickel • oxide", (.44, .45, .43))
    rng = random.Random(191)
    # Each face samples a single hand-sized patch of the atlas. Quiet silver
    # fields alternate with chipped corners and broad runs of exposed primer.
    tile = 24
    size = tile * 8
    patina = [0] * (size * size)
    silver = [(0.64,0.68,0.69), (0.70,0.72,0.71), (0.58,0.62,0.63)]
    colors = [(0,0,0), (.48,.34,.24), (.38,.21,.13), (.24,.15,.11)]
    panels = [rng.choice(silver) for _ in range(64)]
    for panel in range(64):
        left, top = (panel % 8)*tile, (panel // 8)*tile
        for _ in range(rng.choice([0,0,1,1,1,2,3])):
            x, y = rng.randrange(tile), rng.choice([0,tile-1])
            for _ in range(rng.randint(6,27)):
                radius = rng.choice([1,1,2,3])
                for dy in range(-radius,radius+1):
                    for dx in range(-radius,radius+1):
                        px, py = x+dx, y+dy
                        if 0 <= px < tile and 0 <= py < tile:
                            idx = (top+py)*size+left+px
                            depth = radius-max(abs(dx),abs(dy))
                            patina[idx] = max(patina[idx],min(3,depth+1))
                x = min(tile-1,max(0,x+rng.randint(-2,2)))
                y = min(tile-1,max(0,y+rng.randint(-2,2)))
    pixels = []
    for index, oxide in enumerate(patina):
        x, y = index % size, index // size
        rgb = colors[oxide] if oxide else panels[(y//tile)*8+x//tile]
        pixels.extend([*rgb, 1])
    img = bpy.data.images.new("Nickel and ferric pits", size, size)
    img.pixels.foreach_set(pixels)
    img.pack()
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image, tex.interpolation = img, 'Closest'
    mat.node_tree.links.new(tex.outputs["Color"], mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    return mat


class Robot:
    def __init__(self, kind, height):
        self.kind, self.h = kind, height
        self.big, self.fast = kind == 'big', kind == 'fast'
        self.base = kind == 'base'
        self.bones, self.parts = {}, {}
        self.mats = [plate_material(), material("Graphite casting", (.054,.067,.074)),
                     material("Exposed piston", (.39,.43,.45), .87),
                     material("Oxide primer", (.29,.093,.033)),
                     material("Amber diagnostic glass", (.98,.21,.018), .18, True)]
        self.model()
        self.assemble()

    def bone(self, name, point, parent=None):
        self.bones[name] = (V(point), parent)
        return name

    def shape(self, bone, center, dims, mat=0, rot=None):
        verts, faces, slots = self.parts.setdefault(bone, ([],[],[]))
        start = len(verts)
        for z in (-1,1):
            for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                corner = V((x*dims[0]/2,y*dims[1]/2,z*dims[2]/2))
                verts.append(V(center)+(rot @ corner if rot else corner))
        for face in [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            faces.append(tuple(start+i for i in face))
            slots.append(mat)

    def link(self, bone, a, b, width, depth, mat=1):
        a,b = V(a),V(b)
        self.shape(bone,(a+b)/2,(width,depth,(b-a).length),mat,
                   (b-a).to_track_quat('Z','Y'))

    def torn_cable(self, bone, socket, bends, width):
        point = V(socket)
        for index, bend in enumerate(bends):
            end = point + V(bend)
            direction = (end-point).normalized()
            # Overlap adjacent square sleeves at each kink.
            self.link(bone,point-direction*width*.4,end+direction*width*.4,
                      width,width,3 if index == len(bends)-1 else 1)
            point = end

    def joint(self,bone,p,r):
        p=V(p)
        for width, radius, mat in [(2*r, r, 1),(2.15*r, .63*r, 2),(2.25*r,.29*r,3)]:
            d=V((width/2,0,0))
            self.link(bone,p-d,p+d,2*radius,2*radius,mat)

    def limb(self,bone,a,b,w,d,armored):
        a,b=V(a),V(b)
        # Only one strut spans each joint pair. A torn limb keeps empty space
        # all the way around the strut, even when seen from behind.
        self.link(bone,a,b,w*.24,d*.24,2)
        if armored:
            self.link(bone,a.lerp(b,.14),a.lerp(b,.77),w,d,0)
        elif bone in ('thigh.L','forearm.L','upper_arm.L','shin.L'):
            self.torn_cable(bone,a,[(-w*.51,-d*.22,-w*.18),
                            (-w*.29,0,-w*.66),(w*.24,0,-w*.31)],w*.13)
        self.joint(bone,a,w*(.38 if armored else .27))

    def leg_shell(self, bone, a, b, width, side, thigh):
        # Stagger the masses in depth: high outer thigh, rear calf, low
        # forward greave. The heavy carries its knee armor along the shin.
        a,b = V(a),V(b)
        if thigh:
            offset=V((side*.18*width,-.16*width,0))
            self.link(bone,a.lerp(b,.13)+offset,a.lerp(b,.58)+offset,
                      width*1.11,width*1.43,0)
        else:
            rear=V((side*.12*width,.57*width,0))
            self.link(bone,a.lerp(b,.18)+rear,a.lerp(b,.53)+rear,
                      width*.87,width*1.19,1)
            front=V((0,-.42*width,0))
            self.link(bone,a.lerp(b,.42)+front,a.lerp(b,.83)+front,
                      width*.80,width*.64,0)
            if self.big:
                self.link(bone,a.lerp(b,.06),a.lerp(b,.35),width*1.04,width*1.06,0)
                return
            self.shape(bone,a+V((0,-.59*width,0)),
                       (width*1.08,width*.87,width*.79),0)

    def model(self):
        big,fast,base = self.big,self.fast,self.base
        s = .30 if big else .125 if fast else .155
        hipz = .445 if big else .525
        self.hipz = hipz
        ky,ay = (-.075,.050) if big else (-.073,.031) if fast else (-.055,.024)
        self.leg = (ky,ay)
        self.bone('root',(0,0,0))
        pelvis=self.bone('pelvis',(0,0,hipz),'root')
        self.shape(pelvis,(0,0,hipz), (s*1.56,.244 if big else .152,.10))
        waist=self.bone('torso_yaw',(0,0,hipz+.04),pelvis)
        chest=self.bone('chassis',(0,0,hipz+.04),waist)
        necky=-.142 if big else -.052 if fast else -.015
        shoulderz=.82 if big else .797
        # The spine penetrates the hip socket below the yaw pivot and the
        # upper casting above it, including while the chassis pitches forward.
        low,high=hipz+.012,shoulderz-.09
        self.shape(chest,(0,0,(low+high)/2),(s*.85,.14 if big else .077,high-low),2)
        self.shape(pelvis,(0,0,hipz+.033),(s*1.08,.17 if big else .10,.075),1)
        self.shape(chest,(0,-.01,high-.052),(s*.83,.137 if big else .083,.042),1)
        if big:
            self.shape(chest,(0,.018,hipz+.139),(.180,.208,.176),1)
            self.shape(chest,(0,-.089,hipz+.114),(.159,.055,.100),0)
        shoulderx=s*(1.02 if big else 1.13 if fast else .96)
        # An asymmetric casting ends at the spine. Nothing closes the
        # broken half at the front or back. Its single rib has a snapped tip.
        top_y=necky*.45
        self.link(chest,(0,0,high-.035),(0,top_y,shoulderz),
                  s*(.46 if big else .32),.082 if big else .043,2)
        # Carry the volume fore and aft of the intact rib bank. The rear housing
        # stays on that same side so the torn rib remains open from both faces.
        depth=.334 if big else .197 if base else .162
        intact_x=shoulderx*.43
        self.shape(chest,(intact_x,top_y+.030,shoulderz-.064),
                   (shoulderx*.94,depth,.192 if big else .145),1)
        self.shape(chest,(0,top_y,shoulderz),(shoulderx*2,.130 if big else .075,
                   .052 if big else .026),1)
        back_y=top_y+.030+depth*.5
        self.shape(chest,(intact_x,back_y-.005,shoulderz-.074),
                   (shoulderx*.80,.073 if big else .047,.157 if big else .115),0)
        if big:
            # Sloping glacis and upper deck wrap around a hooded optical head.
            rake=Quaternion((1,0,0),-.17)
            self.shape(chest,(.086,-.188,.753),(.276,.071,.199),0,rake)
            for z in (.717,.752):
                self.shape(chest,(.145,-.228+(z-.717)*.17,z),(.075,.014,.013),1,rake)
            self.shape(chest,(.050,.025,.850),(.357,.345,.092),0,
                       Quaternion((1,0,0),.14))
        else:
            front_y=top_y+.030-depth*.5
            for i in range(3):
                self.shape(chest,(intact_x,front_y-.009,shoulderz-.102+i*.040),
                           (shoulderx*(.82+i*.06),.043,.046),0,
                           Quaternion((0,1,0),-.11))
        rib_root=(0,top_y,shoulderz-.106)
        tip=(-shoulderx*(.76 if big else .73),top_y-.027,shoulderz-.056)
        self.link(chest,rib_root,tip,.023 if big else .013,.021 if big else .013,2)
        self.torn_cable(chest,tip,[(-.013,-.011,-.011),(.005,-.004,-.031)],.008)
        self.link(chest,(0,top_y,shoulderz-.017),(0,necky,.908),
                  .076 if big else .053,.075,2)
        head=self.bone('head',(0,necky,.88),chest)
        if big:
            hood=Quaternion((1,0,0),.16)
            self.shape(head,(0,necky+.028,.915),(.230,.230,.103),1)
            self.shape(head,(0,necky+.026,.957),(.252,.232,.050),0,hood)
            self.shape(head,(0,necky-.094,.917),(.110,.040,.076),1)
            self.shape(head,(0,necky-.116,.918),(.079,.012,.049),4)
            for side in (-1,1):
                self.shape(head,(side*.098,necky-.012,.919),(.048,.178,.071),0,hood)
        else:
            head_depth=.174 if fast else .185
            self.shape(head,(0,necky+.014,.934),(.11 if fast else .143,head_depth,.132))
            visor_y=necky+.014-head_depth/2
            self.shape(head,(0,visor_y,.932),(.108,.041,.052),1)
            self.shape(head,(0,visor_y-.022,.941),(.059 if base else .031,.009,.014 if base else .031),4)
            self.shape(head,(0,necky-.046,.894),(.091,.090,.037),1)
        for sign, side in [(-1,'L'),(1,'R')]:
            hip=(sign*s*.55,0,hipz)
            knee=(hip[0],ky,hipz*.57)
            ankle=(hip[0],ay,.075)
            thigh=self.bone('thigh.'+side,hip,pelvis)
            shin=self.bone('shin.'+side,knee,thigh)
            foot=self.bone('foot.'+side,ankle,shin)
            w=.151 if big else .065 if fast else .083
            thigh_plate=not(fast and sign<0)
            shin_plate=sign>0 if not fast else sign<0
            self.limb(thigh,hip,knee,w,w*1.06,thigh_plate)
            self.limb(shin,knee,ankle,w*.87,w,shin_plate)
            if thigh_plate:
                self.leg_shell(thigh,hip,knee,w,sign,True)
            if shin_plate:
                self.leg_shell(shin,knee,ankle,w,sign,False)
            self.joint(foot,ankle,w*.33)
            length=.225 if big else .161 if fast else .153
            self.shape(foot,(hip[0],ay+.014,.046),(w*1.08,length*.51,.083),1)
            self.shape(foot,(hip[0],ay-length*.27,.034),(w*1.18,length*.72,.061))
            self.shape(foot,(hip[0],ay-length*.22,.009),(w*1.21,length,.018),1)
            shoulder=(sign*shoulderx,necky*.45,shoulderz)
            elbow=(sign*shoulderx*1.16,.034 if not base else -.03,.608 if not big else .561)
            hand=(sign*shoulderx*1.22,-.071 if fast else -.127,.505 if not big else .382)
            if base:
                hand=(.075,-.23 if sign<0 else -.092,.660)
            upper=self.bone('upper_arm.'+side,shoulder,chest)
            lower=self.bone('forearm.'+side,elbow,upper)
            fist=self.bone('hand.'+side,hand,lower)
            aw=.156 if big else .051 if fast else .068
            self.limb(upper,shoulder,elbow,aw,aw*1.12,not(fast or big and sign<0))
            self.limb(lower,elbow,hand,aw*1.15,aw*1.18,not(fast and sign<0))
            if big:
                wrist=V(hand)
                self.shape(fist,wrist+V((0,.012,.005)),(.105,.102,.080),1)
                self.shape(fist,wrist+V((0,0,-.061)),(.144,.128,.131),0)
            else:
                self.shape(fist,hand,(aw*1.22,aw*1.45,aw*.92),1)
                for k in (-1,0,1):
                    self.shape(fist,(hand[0]+k*aw*.30,hand[1]-.48*aw,hand[2]-.012),
                               (aw*.26,aw*.62,aw*.74),0 if k!=1 else 2)
            if big:
                self.shape(upper,(shoulder[0]+sign*.016,shoulder[1],shoulder[2]-(.064 if big and sign<0 else .004)),
                           (aw*1.34,aw*1.88,aw*.95),0,Quaternion((0,1,0),-.32 if sign<0 else -.06))
        if base:
            gun=self.bone('rifle',(.075,-.092,.665),'hand.R')
            x,y,z=.075,-.158,.694
            self.shape(gun,(x,y,z),(.041,.26,.065))
            self.link(gun,(x,y+.063,z-.016),(x,y+.091,z-.092),.027,.035,1)
            self.link(gun,(x,y-.023,z-.016),(x,y-.041,z-.099),.026,.044,3)
            self.link(gun,(x,y-.12,z+.01),(x,y-.246,z+.01),.021,.021,2)
            for k in range(3):
                self.shape(gun,(x,y-.054-k*.024,z+.018),(.052,.014,.043),3 if k==2 else 1)
            self.shape(gun,(x,y+.025,z+.034),(.013,.162,.009),1)
            self.bone('muzzle',(x,y-.246,z+.01),gun)

    def assemble(self):
        name = 'enemy_'+self.kind
        arm = bpy.data.armatures.new(name+'_skeleton')
        rig = bpy.data.objects.new(name,arm)
        bpy.context.collection.objects.link(rig)
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for key,(p,parent) in self.bones.items():
            bone=arm.edit_bones.new(key)
            bone.head=p*self.h
            bone.tail=bone.head+V((0,.035,0))*self.h
            if parent:
                bone.parent=arm.edit_bones[parent]
        bpy.ops.object.mode_set(mode='OBJECT')
        vertices, polygons, slots, groups = [],[],[],{}
        for key,(verts,faces,mats) in self.parts.items():
            start=len(vertices)
            vertices.extend(p*self.h for p in verts)
            polygons.extend(tuple(start+i for i in face) for face in faces)
            slots.extend(mats)
            groups[key]=list(range(start,len(vertices)))
        mesh=bpy.data.meshes.new(name+'_plates')
        mesh.from_pydata(vertices,[],polygons)
        mesh.update()
        obj=bpy.data.objects.new(mesh.name,mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent=rig
        for mat in self.mats:
            mesh.materials.append(mat)
        uv=mesh.uv_layers.new(name="Plate grain")
        rng = random.Random(self.kind)
        for poly, slot in zip(mesh.polygons,slots):
            poly.material_index=slot
            tile = rng.randrange(64)
            left,top=(tile%8)*24,(tile//8)*24
            # Map inside texel centers to keep neighboring plates out of the UV island.
            for idx,(u,v) in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):
                uv.data[idx].uv=((left+.5+23*u)/192,(top+.5+23*v)/192)
        for key,indices in groups.items():
            obj.vertex_groups.new(name=key).add(indices,1,'REPLACE')
        obj.modifiers.new("Rigid mechanical assembly",'ARMATURE').object=rig
        self.rig=rig
        self.pose=rig.pose.bones
        for bone in self.pose:
            bone.rotation_mode='XYZ'

    def start(self,name):
        action=bpy.data.actions.new(name)
        action.use_fake_user=True
        self.rig.animation_data_create().action=action
        for b in self.pose:
            b.matrix_basis=Matrix.Identity(4)
        return action

    def rotate(self,key,f,x=0,y=0,z=0):
        b=self.pose[key]
        b.rotation_euler=(x,y,z)
        b.keyframe_insert(data_path='rotation_euler',frame=f,group=key)

    def shift(self,key,f,y=0,z=0):
        b=self.pose[key]
        b.location=(0,y*self.h,z*self.h)
        b.keyframe_insert(data_path='location',frame=f,group=key)

    def animate(self):
        self.start('Idle')
        for f,p in [(1,0),(22,1),(49,0)]:
            self.rotate('chassis',f,-.022*p)
            self.rotate('head',f,.012*p,0,.044*p)
        self.start('Run' if self.fast else 'Walk')
        duration=16 if self.fast else 32 if self.big else 28
        # Solve the two-link leg in the sagittal plane so the stance sole stays level.
        ky,ay=self.leg
        kz=self.hipz*.57
        a,b=math.hypot(ky,self.hipz-kz),math.hypot(ay-ky,kz-.075)
        rest1=math.atan2(ky,self.hipz-kz)
        rest2=math.atan2(ay-ky,kz-.075)
        for i in range(duration+1):
            phase=i/duration
            bob=(-.034 if self.fast else -.018)+(.031 if self.fast else .009)*math.cos(phase*TAU*2)
            self.shift('pelvis',i+1,z=bob)
            self.rotate('chassis',i+1,.20 if self.fast else .09 if self.big else .015,
                        .025*math.sin(phase*TAU),.047*math.sin(phase*TAU))
            for side,offset in [('L',0),('R',.5)]:
                t=(phase+offset)%1
                stance=.39 if self.fast else .56
                stride=.165 if self.fast else .085
                u=(t-stance)/(1-stance)
                reach=(-1+2*t/stance if t<stance else math.cos(u*math.pi))*stride
                lift=0 if t<stance else (.113 if self.fast else .056)*math.sin(math.pi*u)**2
                down=self.hipz+bob-.075-lift
                length=math.hypot(reach+ay,down)
                angle=math.atan2(reach+ay,down)
                bend=math.acos(min(1,max(-1,(length**2+a*a-b*b)/(2*length*a))))
                first=angle-bend
                second=math.atan2(reach+ay-a*math.sin(first),down-a*math.cos(first))
                self.rotate('thigh.'+side,i+1,first-rest1)
                self.rotate('shin.'+side,i+1,second-first-rest2+rest1)
                self.rotate('foot.'+side,i+1,rest2-second)
                if not self.base:
                    self.rotate('upper_arm.'+side,i+1,-(.58 if self.fast else .20)*math.cos(TAU*t))
                    self.rotate('forearm.'+side,i+1,-.68 if self.fast else -.08)
            if self.base:
                catch=max(0,1-abs(phase-.64)/.09)
                self.rotate('head',i+1,.078*catch,0,-.052*catch)
                self.rotate('upper_arm.L',i+1,.036*catch)
        if self.base:
            self.start('Fire')
            for f,r in [(1,0),(2,1),(4,.45),(7,0)]:
                self.rotate('chassis',f,-.078*r)
                self.shift('chassis',f,y=.012*r)
        else:
            self.start('LightHit' if self.fast else 'HeavyHit')
            beats=([(1,0,0),(3,.43,-.19),(5,-1.27,.33),(7,-1.12,.26),(12,0,0)] if self.fast
                   else [(1,0,0),(12,-2.57,-.41),(15,-2.64,-.44),(18,-1.03,.47),(21,-.68,.53),(37,0,0)])
            for f,angle,twist in beats:
                self.rotate('upper_arm.R',f,angle,0,-twist*.32)
                self.rotate('forearm.R',f,-.27*abs(angle))
                self.rotate('chassis',f,twist*.34,twist*.13,twist)
                self.rotate('upper_arm.L',f,-angle*.18)
        for direction in (1,-1):
            self.turn(direction)
        self.death()

    def turn(self, direction):
        self.start('TurnLeft' if direction==1 else 'TurnRight')
        frames=10 if self.fast else 20 if self.big else 14
        angle=direction*math.radians(60)
        # Key these actions from frame zero so exported footwork and runtime
        # heading interpolation start on the same sample.
        def smooth(x):
            return x*x*(3-2*x)

        for i in range(frames+1):
            t=i/frames
            yaw=angle*smooth(t)
            # Transfer weight toward the planted side before each foot rises.
            sway=-direction*(.023 if self.big else .016)*math.sin(TAU*t)
            drop=-.018*math.sin(math.pi*t)**2
            pelvis=self.pose['pelvis']
            pelvis.location=V((sway,0,drop))*self.h
            pelvis.keyframe_insert(data_path='location',frame=i,group='pelvis')
            for side,sign in [('L',-1),('R',1)]:
                step=min(1,max(0,2*t-(0 if sign==direction else 1)))
                twist=angle*smooth(step)-yaw
                hip=self.bones['thigh.'+side][0]
                knee=self.bones['shin.'+side][0]
                ankle=self.bones['foot.'+side][0]
                target=Quaternion((0,0,1),twist) @ ankle
                target.z+=(.055 if self.fast else .042)*math.sin(math.pi*step)**2
                leg=target-hip-V((sway,0,drop))
                # Solve sideways tilt first, then the knee in its forward plane.
                # Counter-rotate the sole to hold both its position and facing.
                roll=math.atan2(-leg.x,-leg.z)
                a,b=(hip-knee).length,(knee-ankle).length
                length=leg.length
                down=math.hypot(leg.x,leg.z)
                bend=math.acos(max(-1,min(1,(length**2+a*a-b*b)/(2*length*a))))
                upper=math.atan2(leg.y,down)-bend
                lower=math.atan2(leg.y-a*math.sin(upper),down-a*math.cos(upper))
                upper-=math.atan2(knee.y-hip.y,hip.z-knee.z)
                lower-=math.atan2(ankle.y-knee.y,knee.z-ankle.z)
                tilt=Quaternion((0,1,0),roll)
                thigh=tilt @ Quaternion((1,0,0),upper)
                shin=Quaternion((1,0,0),lower-upper)
                foot=(thigh @ shin).inverted() @ Quaternion((0,0,1),twist)
                for name,rotation in [('thigh',thigh),('shin',shin),('foot',foot)]:
                    self.rotate(name+'.'+side,i,*rotation.to_euler())


    def death(self):
        self.start('Death')
        rng=random.Random(430)
        flight={}
        for key,(verts,_,_) in self.parts.items():
            origin=self.bones[key][0]
            lateral=1 if origin.x>0 else -1 if origin.x<0 else rng.choice([-1,1])
            offset=V((lateral*rng.uniform(.22,.96),rng.uniform(-.78,.78),0))
            spin=V(tuple(rng.uniform(-3,3) for _ in range(3)))
            flight[key]=(offset,spin,rng.uniform(.21,.48),rng.uniform(.76,1.0))
        for f in [1,3,*range(4,37),45]:
            targets={}
            for key,(rest,parent) in self.bones.items():
                origin=rest*self.h
                local=self.rig.data.bones[key].matrix_local
                parent_rest=self.rig.data.bones[parent].matrix_local if parent else None
                inherited=targets[parent] @ parent_rest.inverted() @ local if parent else local.copy()
                target=inherited.copy()
                if key in flight:
                    offset,spin,arc,landing=flight[key]
                    t=min(1,max(0,(f-3)/(32*landing)))
                    rot=Quaternion(spin.normalized(),spin.length*(1-(1-t)**1.45))
                    low=min((rot @ (v-rest)).z for v in self.parts[key][0])
                    z=rest.z*(1-t*t)+(-low)*t*t+4*arc*t*(1-t)
                    if f==3:
                        z+=.018
                    pos=rest+offset*(1-(1-t)**1.35)
                    pos.z=max(z,-low)
                    target=Matrix.Translation(pos*self.h) @ rot.to_matrix().to_4x4()
                targets[key]=target
                if key in flight:
                    bone=self.pose[key]
                    prev=bone.rotation_euler.copy()
                    delta=inherited.inverted() @ target
                    bone.location=delta.to_translation()
                    bone.rotation_euler=delta.to_euler('XYZ',prev)
                    for prop in ('location','rotation_euler'):
                        bone.keyframe_insert(data_path=prop,frame=f,group=key)

    def save(self):
        name=self.rig.name
        folder=OUT/name
        folder.mkdir(exist_ok=True)
        scene=bpy.context.scene
        scene.render.fps=24
        anim=self.rig.animation_data
        idle=bpy.data.actions['Idle']
        anim.action=idle
        scene.frame_end=49
        scene.frame_set(1)
        bpy.ops.export_scene.gltf(filepath=str(folder/(name+'.glb')),export_animation_mode='ACTIONS',
                                  export_force_sampling=False,export_optimize_animation_keep_anim_armature=False,
                                  export_extras=False,export_yup=True)
        if self.base:
            self.start('AimPreview')
            for f,angle in [(1,0),(6,60),(16,60),(26,-60),(36,-60),(41,0)]:
                self.rotate('torso_yaw',f,z=math.radians(angle))
        anim.action=idle
        scene.frame_set(1)
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    space=area.spaces.active
                    space.overlay.show_overlays=False
                    space.shading.color_type='TEXTURE'
                    space.region_3d.view_rotation=V((-.44,.93,-.12)).to_track_quat('-Z','Y')
                    space.region_3d.view_distance=self.h*1.86
                    space.region_3d.view_location=(0,0,self.h*.50)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')))


if __name__=='__main__':
    for variant,height in [('base',2),('fast',1.85),('big',3.5)]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        robot=Robot(variant,height)
        robot.animate()
        robot.save()
