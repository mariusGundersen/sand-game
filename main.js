// @ts-check

// @ts-ignore
import * as twgl from 'https://cdn.jsdelivr.net/npm/twgl.js@7.0.0/dist/7.x/twgl-full.module.js';

const renderShaders = [
/*glsl*/ `
  precision highp float;

  attribute vec2 position;
  varying vec2 texCoord;

  void main(void) {
    texCoord = 0.5*(position+1.0);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`,
/*glsl*/ `
  #define SAND vec4(1.0, 0.0, 0.0, 1.0)
  #define AIR vec4(0.0, 0.0, 0.0, 0.0)
  #define BLOCK vec4(0.0, 1.0, 0.0, 1.0)

  precision highp float;

  uniform sampler2D sandTexture;

  varying vec2 texCoord;

  vec4 lookup();

  void main() {
    vec4 thisCell = lookup();

    if(thisCell == SAND){
      gl_FragColor = vec4(0.980, 0.643, 0.376, 1.0);
    } else {
      gl_FragColor = vec4(0.678, 0.847, 0.902, 1.0);
    }
  }

  vec4 lookup() {
    return texture2D(sandTexture, texCoord);
  }
`
]

const sandShaders = [
/*glsl*/ `
  precision highp float;

  attribute vec2 position;
  varying vec2 texCoord;

  void main(void) {
    texCoord = 0.5*(position+1.0);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`,
/*glsl*/ `
  #define SAND vec4(1.0, 0.0, 0.0, 1.0)
  #define AIR vec4(0.0, 0.0, 0.0, 0.0)
  #define BLOCK vec4(0.0, 1.0, 0.0, 1.0)


  precision highp float;

  uniform float direction;
  uniform vec2 inverseTileTextureSize;
  uniform sampler2D sandTexture;

  varying vec2 texCoord;

  vec4 lookup(float x, float y);

  void main() {
    vec4 thisCell = lookup(0.0, 0.0);

    if(thisCell == SAND && texCoord.y > inverseTileTextureSize.y){
      vec4 below = lookup(0.0, -1.0);
      if(below == SAND){
        vec4 diagonally = lookup(direction, -1.0);
        gl_FragColor = diagonally;
      }else{
        gl_FragColor = below;
      }
    }else{
      vec4 above = lookup(0.0, 1.0);
      if(above == SAND){
        gl_FragColor = above;
      }else{
        vec4 diagonally = lookup(-direction, 1.0);
        vec4 besides = lookup(-direction, 0.0);
        if(besides == SAND && diagonally == SAND){
          gl_FragColor = SAND;
        }else{
          gl_FragColor = thisCell;
        }
      }
    }
  }

  vec4 lookup(float x, float y) {
    return texture2D(sandTexture, texCoord + inverseTileTextureSize * vec2( x, y));
  }
`
];

const canvas = document.querySelector('canvas');
if (!canvas) throw new Error(' oh noes');
const gl = canvas.getContext("webgl");
if (!gl) throw new Error('oh noes');

const renderProgram = twgl.createProgramInfo(gl, renderShaders);
const sandProgram = twgl.createProgramInfo(gl, sandShaders);

const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
  // this is the attribute again
  position: [
    -1, -1, 0, //
    1, -1, 0,
    1, 1, 0,
    //
    -1, -1, 0,
    -1, 1, 0,
    1, 1, 0
  ],
});

twgl.resizeCanvasToDisplaySize(canvas, devicePixelRatio);
const width = canvas.width / 2 / devicePixelRatio;
const height = canvas.height / 2 / devicePixelRatio;


const sand1 = twgl.createFramebufferInfo(gl, [{ min: gl.NEAREST, mag: gl.NEAREST }], width, height);

const sand2 = twgl.createFramebufferInfo(gl, [{ min: gl.NEAREST, mag: gl.NEAREST }], width, height);

let frame = 0;

/**
 * @type {{ id: number; x: number; y: number; }[]}
 */
let pointers = [];

const clamp = (/** @type {number} */ v, /** @type {number} */ min, /** @type {number} */ max) => Math.max(min, Math.min(v, max))

requestAnimationFrame(function render(time) {
  gl.viewport(0, 0, canvas.width, canvas.height);

  const [from, to] = frame % 2 === 0 ? [sand1, sand2] : [sand2, sand1];
  frame++;

  // DRAW
  for (const { x, y } of pointers) {
    gl.bindTexture(gl.TEXTURE_2D, from.attachments[0])
    const data = new Uint32Array([0xff0000ff, 0x0, 0xff0000ff, 0x0, 0xff0000ff]);

    gl.texSubImage2D(gl.TEXTURE_2D, 0, clamp(x - 2, 0, width - 5), y, 5, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer));
  }


  // SIMULATE

  gl.useProgram(sandProgram.program);
  twgl.bindFramebufferInfo(gl, to);
  twgl.setBuffersAndAttributes(gl, sandProgram, bufferInfo);
  twgl.setUniforms(sandProgram, {
    inverseTileTextureSize: [1 / width, 1 / height],
    sandTexture: from.attachments[0],
    direction: frame % 2 === 0 ? 1 : -1
  });

  twgl.drawBufferInfo(gl, bufferInfo);

  // RENDER

  gl.useProgram(renderProgram.program);
  twgl.bindFramebufferInfo(gl, null);
  twgl.setBuffersAndAttributes(gl, renderProgram, bufferInfo);
  twgl.setUniforms(renderProgram, {
    sandTexture: to.attachments[0]
  });
  twgl.drawBufferInfo(gl, bufferInfo);

  requestAnimationFrame(render);
});

const toSimSize = (/** @type {number} */ value) => value * width / canvas.offsetWidth;

canvas.addEventListener('pointerdown', e => {
  pointers.push({
    id: e.pointerId,
    x: toSimSize(e.offsetX),
    y: toSimSize(canvas.offsetHeight - e.offsetY)
  });
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  const pointer = pointers.find(p => p.id === e.pointerId);
  if (pointer) {
    pointer.x = toSimSize(e.offsetX);
    pointer.y = toSimSize(canvas.offsetHeight - e.offsetY);
  }
});

/**
 * @param {PointerEvent} event
 */
function onPointerUp(event) {
  const pointer = pointers.findIndex(p => p.id === event.pointerId);
  if (pointer >= 0) {
    pointers.splice(pointer, 1);
  }
};


canvas.addEventListener('pointercancel', onPointerUp)

canvas.addEventListener('pointerup', onPointerUp)

