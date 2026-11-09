"""Offline editable screenshot traces. Requires Pillow, never runs in the browser.
Run: python build-assets.py [research/video-dJP7FTvGETM root]
Only masked, palette-cleaned components are exported, not complete screenshots.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, sys, math
ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[3]/'research/video-dJP7FTvGETM'
OUT=Path(__file__).parent
EVIDENCE=OUT.parents[2]/'artifacts/trace-underwater'
EVIDENCE.mkdir(parents=True,exist_ok=True)
SX,SY=640/1740,280/756
records=[]
PALETTE=['#080b12','#092630','#18505b','#277986','#53bbc9','#73e5ec','#a1f6f1','#fff9e9','#d4d6ca','#9aaca4','#636d67','#f7d3a3','#fca967','#c47c42','#8b380c','#4b1105','#790e02','#ad1807','#df220a','#ff3916','#ff6536','#ff9b66']
def source(name):
 path=ROOT/'segments/02-underwater/crops'/f'{name}.png'
 im=Image.open(path).convert('RGB')
 return im.resize((round(im.width*SX),round(im.height*SY)),Image.Resampling.BOX)
def palette_image(colors):
 p=Image.new('P',(1,1)); rgb=[tuple(bytes.fromhex(c[1:])) for c in colors];p.putpalette([v for c in rgb for v in c]+list(rgb[0])*(256-len(rgb)));return p
def clean(im,mask,colors):
 im=im.quantize(palette=palette_image(colors),dither=Image.Dither.NONE).convert('RGBA');im.putalpha(mask);return im
def is_blue(r,g,b):return b>r*1.28 and b>g*1.12

def connected(mask):
 # Discard detached bubbles, compression flecks and neighboring plant fragments.
 remaining={(x,y) for y in range(mask.height) for x in range(mask.width) if mask.getpixel((x,y))}
 components=[]
 while remaining:
  pending=[remaining.pop()];component=[]
  while pending:
   x,y=pending.pop();component.append((x,y))
   for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
    point=(x+dx,y+dy)
    if point in remaining:remaining.remove(point);pending.append(point)
  components.append(component)
 result=Image.new('L',mask.size)
 for point in max(components,key=len):result.putpixel(point,255)
 return result

def fish(name,box,anchor,output):
 im=source(name);mask=Image.new('L',im.size);p=im.load();a=mask.load()
 for y in range(box[1],box[3]):
  for x in range(box[0],box[2]):
   r,g,b=p[x,y]
   if not is_blue(r,g,b) and not(g>r*1.25 and g>b*1.12):a[x,y]=255
 # The mask removes background visible through the fins, not just a rectangular crop.
 tile=clean(im,connected(mask),PALETTE)
 framed=Image.new('RGBA',(104,88));framed.alpha_composite(tile,(48-anchor[0],38-anchor[1]))
 framed.save(OUT/f'{output}.png')
 record(name,output,box,anchor,[48,38], 'Blue/green background masked; detached bubbles and compression flecks removed; 22-color palette cleanup; anchored at body center, fixed 104x88 canvas.')
 return framed

def record(name,output,box,anchor=None,dest=None,edits=''):
 manifest=json.load(open(ROOT/'components/componentmanifest.json'))['reference_index']
 key=f'segments/02-underwater/crops/{name}.png';entry=manifest[key]
 records.append({'asset':f'src/assets/underwater/{output}.png','source_path':str(ROOT/key),'parent_frame_path':str(ROOT/entry['parent']),'timestamp':entry['source_timestamp'],'source_time_seconds':entry['source_time_seconds'],'crop_xywh_in_parent':entry['crop_xywh'],'local_mask_bounds_at_640_scale':box,'source_anchor_at_640_scale':anchor,'export_anchor':dest,'edits':edits})

fish0=fish('red-fish-underwater-04m30s000-f016200',(6,20,92,94),(44,55),'fish-open')
# Proof is generated before the rest of the components are implemented.
proof=Image.new('RGB',(640,208),'#172e57');d=ImageDraw.Draw(proof)
d.text((10,8),'SOURCE / mask + palette cleanup / checker transparency',fill='white')
src=Image.new('RGB',(104,88),'#172e57')
src.paste(source('red-fish-underwater-04m30s000-f016200'),(4,-17))
proof.paste(src.resize((208,176),Image.Resampling.NEAREST),(0,28))
proof.paste(fish0.resize((208,176),Image.Resampling.NEAREST),(214,28),fish0.resize((208,176),Image.Resampling.NEAREST))
for y in range(28,208,8):
 for x in range(428,640,8):d.rectangle((x,y,x+7,y+7),fill='#808080' if (x+y)//8%2 else '#aaaaaa')
proof.paste(fish0.resize((208,176),Image.Resampling.NEAREST),(428,28),fish0.resize((208,176),Image.Resampling.NEAREST))
proof.save(EVIDENCE/'proof-fish.png')
fish('fish-motion-underwater-04m34s200-f016452',(18,20,110,89),(65,55),'fish-closed')
fish('fish-motion-underwater-04m34s800-f016488',(27,18,113,95),(67,52),'fish-half')

def squid(name,box,anchor,output):
 im=source(name);mask=Image.new('L',im.size);p=im.load();a=mask.load()
 for y in range(box[1],box[3]):
  for x in range(box[0],box[2]):
   r,g,b=p[x,y]
   if r>48 and g>45 and r>b*.77 and r>g*.73:a[x,y]=255
 # The dark eyes and mouth are opaque, while water between tentacles stays clear.
 ImageDraw.Draw(mask).ellipse((anchor[0]-6,anchor[1]-7,anchor[0]+7,anchor[1]+7),fill=255)
 # Retain gaps between tentacles. A single dark edge replaces blue compression fringe.
 edge=mask.filter(ImageFilter.MaxFilter(3))
 tile=Image.new('RGBA',im.size,(9,18,24,0));tile.putalpha(edge)
 tile.alpha_composite(clean(im,mask,['#11191c','#404d4e','#727e79','#a4b4ab','#d2ded1','#fffce8','#72d3db','#8e2413']))
 framed=Image.new('RGBA',(88,80));framed.alpha_composite(tile,(44-anchor[0],23-anchor[1]));framed.save(OUT/f'{output}.png')
 record(name,output,box,anchor,[44,23],'Neutral/white mask, preserved tentacle gaps; one-pixel dark outline replaces blue fringe; head anchored across actual poses.')
for name,box,anchor,out in [
 ('squid-motion-underwater-06m38s000-f023880',(52,43,99,99),(80,59),'squid-curled'),
 ('squid-motion-underwater-06m39s000-f023940',(48,53,107,108),(80,66),'squid-down'),
 ('squid-motion-underwater-06m40s000-f024000',(42,61,116,108),(79,74),'squid-spread')]:squid(name,box,anchor,out)

for name,box,out in [
 ('branching-plant-underwater-03m50s000-f013800',(0,2,98,177),'plant-branch'),
 ('large-plant-underwater-04m00s000-f014400',(0,0,85,195),'plant-tall'),
 ('small-plant-underwater-03m50s000-f013800',(3,0,66,119),'plant-small')]:
 im=source(name);mask=Image.new('L',im.size);a=mask.load();p=im.load()
 for y in range(box[1],box[3]):
  for x in range(box[0],box[2]):
   r,g,b=p[x,y]
   if g>12 and g>r*1.4 and g>b*1.16:a[x,y]=255
 mask=connected(mask)
 tile=clean(im,mask,['#061c09','#07320b','#06490a','#075c0a','#087408','#1c890c','#36a017']).crop(box)
 tile.save(OUT/f'{out}.png')
 record(name,out,box,None,None,'Green-only connected silhouette preserves curled ribbons and internal water holes; seven-color cleanup; excludes swimmers, squid, bubbles, seabed and detached neighboring-plant slivers.')

rockname='rock-and-seabed-underwater-03m50s000-f013800'
im=source(rockname);mask=Image.new('L',im.size);d=ImageDraw.Draw(mask)
d.polygon([(8,72),(9,43),(18,37),(22,28),(35,23),(40,20),(43,15),(53,15),(61,21),(70,22),(76,29),(80,22),(91,25),(101,34),(108,43),(116,49),(123,72)],fill=255)
rockpalette=['#090b0b','#211309','#3d1c08','#662a08','#8b3909','#ae4c09','#d16b12','#ed921c','#ffb634']
clean(im,mask,rockpalette).save(OUT/'rock.png')
record(rockname,'rock',[8,15,123,72],None,None,'Hand-traced outer silhouette; nine-color cleanup; preserves black cavities and curved orange ridges. Occluded lower rock continues below canvas.')

# Editable silhouette paths traced over the 640x280 synchronous scene underlay.
frame=ROOT/'segments/02-underwater/frames/underwater-04m30s000-f016200.png'
ref=Image.open(frame).crop((92,324,1832,1080)).resize((640,280),Image.Resampling.BOX)
ref.save(EVIDENCE/'source.png')
bg=Image.new('RGB',(640,280));p=bg.load()
for y in range(280):
 for x in range(640):
  t=min(1,y/190);band=((x%4==y%4)*3 if y<125 else 0)
  p[x,y]=(round(17-7*t)+band,round(91-63*t)+band,round(155-49*t)+band)
d=ImageDraw.Draw(bg)
# The thin surface lip is visible at the top of the scene, not a second HUD strip.
surface=[(0,27),(80,24),(174,13),(230,8),(320,9),(420,16),(542,24),(640,27)]
d.polygon([(0,0),(640,0),*reversed(surface)],fill='#185ca0');d.line(surface,fill='#138d99',width=2)
reefs=[
 ('#0c347e',[(0,141),(15,145),(35,138),(56,151),(74,138),(91,131),(111,111),(122,115),(149,151),(171,157),(192,146),(217,124),(237,115),(260,120),(285,147),(306,140),(325,120),(347,117),(370,112),(387,126),(412,151),(439,157),(464,149),(486,137),(508,143),(529,156),(553,152),(574,168),(598,141),(621,132),(640,141)]),
 ('#0b236c',[(0,181),(24,188),(43,178),(69,164),(87,164),(108,180),(128,205),(151,201),(181,177),(206,160),(228,171),(248,191),(272,195),(289,184),(315,171),(339,170),(365,183),(388,188),(414,171),(443,174),(470,170),(491,159),(508,164),(530,184),(554,181),(577,192),(602,174),(625,176),(640,181)]),
 ('#080e58',[(0,235),(20,241),(42,238),(62,225),(85,232),(104,238),(122,231),(149,244),(175,234),(201,243),(229,239),(255,227),(280,232),(308,239),(330,236),(350,228),(377,238),(401,241),(427,232),(449,235),(468,226),(490,238),(520,242),(548,230),(575,235),(603,229),(626,231),(640,235)])]
for color,points in reefs:d.polygon([*points,(640,280),(0,280)],fill=color)
# Narrow branching coral silhouettes, based on exposed reference branches.
for x,y,h,color in [(19,244,96,'#0a1b64'),(84,230,76,'#0b286f'),(226,244,68,'#0a165d'),(412,211,109,'#0a206a'),(539,242,77,'#0a155e'),(626,204,114,'#0a216b')]:
 d.line([(x,y),(x-3,y-h*.35),(x+2,y-h*.65),(x,y-h)],fill=color,width=4)
 for j,(side,length) in enumerate([(-1,19),(1,15),(-1,13),(1,13),(-1,9)]):
  by=y-15-j*h*.15;tip=x+side*length
  d.line([(x,by),(tip,by-12),(tip-side*3,by-25)],fill=color,width=3)
  d.line([(tip,by-13),(tip+side*5,by-18),(tip+side*5,by-27)],fill=color,width=2)
# Trace visible blue across four registered frames. Full actor bounds are excluded
# before blue selection, including their blue clothing. Fixed plants remain holes.
# Smooth color diffusion fills those holes rather than leaving scanline streaks.
bluepalette=['#1766ab','#1b5faf','#1c57c2','#12509f','#0b468e','#073987','#063379','#032676','#031d5f','#020d6a','#01095f','#020649']
frame_specs=[
 ('04m30s000','016200',[(0,75,98,163),(142,88,242,185)]),
 ('04m00s000','014400',[(197,108,291,166),(350,90,462,182)]),
 ('03m50s000','013800',[(13,93,98,149),(168,65,272,151)]),
 ('06m40s000','024000',[(124,122,210,184),(263,97,369,181)])]
refs=[]
for time,idx,actors in frame_specs:
 path=ROOT/f'segments/02-underwater/frames/underwater-{time}-f{idx}.png'
 image=Image.open(path).crop((92,324,1832,1080)).resize((640,280),Image.Resampling.BOX)
 refs.append((image.load(),actors))
 records.append({'asset':'src/assets/underwater/backdrop.png','source_path':str(path),'timestamp':time,'crop_xywh_in_parent':[92,324,1740,756],'excluded_actor_bounds_at_640_scale':actors,'edits':'Blue-only visible background contribution; whole actor bounds excluded, all nonblue foreground excluded.'})
known=Image.new('L',(640,280));kp=known.load();traced=bg.copy();tp=traced.load()
for y in range(35,241):
 for x in range(640):
  for rp,actors in refs:
   r,g,b=rp[x,y]
   if any(x0<=x<x1 and y0<=y<y1 for x0,y0,x1,y1 in actors):continue
   if b>g*1.3 and b>r*2 and r<45:
    kp[x,y]=255;tp[x,y]=(r,g,b);break
# Contract the known region to discard blue/green compression fringe at mask edges.
known=known.filter(ImageFilter.MinFilter(5))
bg.paste(traced,(0,0),known)
for _ in range(32):
 softened=bg.filter(ImageFilter.GaussianBlur(3))
 softened.paste(traced,(0,0),known)
 bg=softened
bg=bg.quantize(palette=palette_image(bluepalette),dither=Image.Dither.NONE).convert('RGB')
ImageDraw.Draw(bg).line(surface,fill='#138d99',width=1)
bg.save(OUT/'backdrop.png')
# Soil is a fresh periodic tile using a cleaned, unoccluded soil sample palette.
soil=Image.new('RGBA',(640,40));d=ImageDraw.Draw(soil)
for x in range(640):
 top=10+round(4*math.sin(x*math.pi/80)+3*math.sin(x*math.pi/32))
 for y in range(top,40):
  n=((x*73+y*127)^((x//3)*61+(y//2)*43))%29
  color=rockpalette[1 if n<9 else 2 if n<19 else 3 if n<26 else 4 if n<28 else 5]
  d.point((x,y),fill=color)
soil.save(OUT/'seabed.png')
records.append({'asset':'src/assets/underwater/backdrop.png + seabed.png','source_path':str(frame),'timestamp':'04:30.000','crop_xywh_in_parent':[92,324,1740,756],'edits':'Visible blue reef silhouettes combined from four actor-excluded frames and palette-cleaned to 12 blues; fixed-plant holes filled by 32 masked diffusion passes over manually traced fallback paths. New periodic soil texture, darkened after pass-one inspection. Surface lip traced.'})
(EVIDENCE/'provenance.json').write_text(json.dumps({'source_url':'https://www.youtube.com/watch?v=dJP7FTvGETM','technique':'Authorized masked screenshot traces with palette edits; hand-traced background paths; no complete screenshot or creator overlay in runtime assets.','alignment':{'gameplay_size':[640,280],'parent_crop_xywh':[92,324,1740,756],'scale_x':SX,'scale_y':SY,'resampling':'BOX for trace underlay, nearest-neighbor runtime draw'},'unsupported_or_occluded':['Reef behind fixed plants and actors inferred from adjacent visible contours.','Bottom of large rock clipped by frame; kept clipped below seabed.','Creator banner at lower-left excluded from all runtime assets.','Only right-facing fish evidenced. Animation cadence retains existing visual-only active-time behavior, not claimed to match original timing.'],'sources':records},indent=2))
