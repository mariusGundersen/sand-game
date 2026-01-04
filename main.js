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
  precision highp float;

  uniform vec2 inverseTileTextureSize;
  uniform sampler2D sandTexture;

  varying vec2 texCoord;

  vec4 lookup(float x, float y);

  void main() {
    float thisCell = lookup(0.0, 0.0).r;

    gl_FragColor = vec4(1.0 - thisCell, 1.0 - thisCell, 1.0 - thisCell, 1.0);
  }

  vec4 lookup(float x, float y) {
    return texture2D(sandTexture, texCoord + inverseTileTextureSize * vec2( x, y));
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

//twgl.resizeCanvasToDisplaySize(canvas, devicePixelRatio);

console.log(canvas.width, canvas.height);

const sand1 = twgl.createFramebufferInfo(gl, undefined, canvas.width, canvas.height);

const data = new Uint32Array(canvas.width * canvas.height);
data.fill(0x0);
//data[canvas.width * (canvas.height - 1) + canvas.width / 2] = 0x00000000;
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer));

const sand2 = twgl.createFramebufferInfo(gl, undefined, canvas.width, canvas.height);

let frame = 0;

let pointers = [];

requestAnimationFrame(function render(time) {
  gl.viewport(0, 0, canvas.width, canvas.height);

  const [from, to] = frame % 2 === 0 ? [sand1, sand2] : [sand2, sand1];
  frame++;

  // DRAW
  for (const { x, y } of pointers) {
    gl.bindTexture(gl.TEXTURE_2D, from.attachments[0])
    const data = new Uint32Array([0xff0000ff]);

    console.log(x, y);

    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer));
  }


  // SIMULATE

  gl.useProgram(sandProgram.program);
  twgl.bindFramebufferInfo(gl, to);
  twgl.setBuffersAndAttributes(gl, sandProgram, bufferInfo);
  twgl.setUniforms(sandProgram, {
    inverseTileTextureSize: [1 / canvas.width, 1 / canvas.height],
    sandTexture: from.attachments[0],
    direction: frame % 2 === 0 ? 1 : -1
  });

  twgl.drawBufferInfo(gl, bufferInfo);



  // RENDER

  gl.useProgram(renderProgram.program);
  twgl.bindFramebufferInfo(gl, null);
  twgl.setBuffersAndAttributes(gl, renderProgram, bufferInfo);
  twgl.setUniforms(renderProgram, {
    inverseTileTextureSize: [1 / canvas.width, 1 / canvas.height],
    sandTexture: to.attachments[0]
  });
  twgl.drawBufferInfo(gl, bufferInfo);

  requestAnimationFrame(render);
});

canvas.addEventListener('pointerdown', e => {
  console.log(e.offsetX, e.offsetY, canvas.offsetHeight, canvas.width, canvas.offsetWidth)
  pointers.push({
    id: e.pointerId,
    x: e.offsetX * canvas.width / canvas.offsetWidth,
    y: (canvas.offsetHeight - e.offsetY) * canvas.width / canvas.offsetWidth
  });
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  const pointer = pointers.find(p => p.id === e.pointerId);
  if (pointer) {
    pointer.x = e.offsetX * canvas.width / canvas.offsetWidth;
    pointer.y = (canvas.offsetHeight - e.offsetY) * canvas.width / canvas.offsetWidth;
  }
});

canvas.addEventListener('pointercancel', e => {
  const pointer = pointers.find(p => p.id === e.pointerId);
  if (pointer) {
    pointers.splice(pointer, 1);
  }
})
canvas.addEventListener('pointerup', e => {
  const pointer = pointers.find(p => p.id === e.pointerId);
  if (pointer) {
    pointers.splice(pointer, 1);
  }
})

