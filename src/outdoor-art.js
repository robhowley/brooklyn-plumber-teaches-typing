// Indexed, editable sprite grids are imported before the first scene draw.
// Editable PNG counterparts are in outdoor-assets; the underlay recipe is in artifacts/trace-outdoor.
import tiles from './outdoor-assets/tiles.json' with { type: 'json' };
const symbols='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_`{|}~';
const images=new Map();
export function outdoorTile(name) {
  if (!images.has(name)) {
    const tile=tiles[name], canvas=document.createElement('canvas');
    canvas.width=tile.width; canvas.height=tile.height;
    const c=canvas.getContext('2d');
    tile.rows.forEach((row,y)=>[...row].forEach((pixel,x)=>{
      const color=tile.palette[symbols.indexOf(pixel)];
      if(color==='transparent')return;
      c.fillStyle=color; c.fillRect(x,y,1,1);
    }));
    images.set(name,canvas);
  }
  return images.get(name);
}
