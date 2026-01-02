// @ts-check

// @ts-ignore
import * as twgl from 'https://cdn.jsdelivr.net/npm/twgl.js@7.0.0/dist/7.x/twgl-full.module.js';

const vertexShader = /* glsl */`
  precision highp float;

  // here is an attribute
  attribute vec3 position;

  varying vec2 uv;

  void main() {
    gl_Position = vec4(position, 1.0);
    uv = (position.xy + 1.0) / 2.0;
  }
`;

const renderShader = /* glsl */`
  precision highp float;

  // and here is a uniform
  uniform float time;

  varying vec2 uv;

  void main() {
    gl_FragColor = vec4(0.5*(uv+1.0), 0.5*(cos(time)+1.0), 1.0);
  }
`;

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

    gl_FragColor = vec4(thisCell, thisCell/2.0, 0.0, 1.0);
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
#define SAND 0.0
  precision highp float;

  uniform float direction;
  uniform vec2 inverseTileTextureSize;
  uniform sampler2D sandTexture;

  varying vec2 texCoord;

  vec4 lookup(float x, float y);

  void main() {
    float thisCell = lookup(0.0, 0.0).r;

    if(thisCell == SAND && texCoord.y > inverseTileTextureSize.y*2.0){
      float below = lookup(0.0, -1.0).r;
      if(below == SAND){
        float diagonally = lookup(direction, -1.0).r;
        gl_FragColor = vec4(diagonally, 0.0, 0.0, 1.0);
      }else{
        gl_FragColor = vec4(below, 0.0, 0.0, 1.0);
      }
    }else{
      float above = lookup(0.0, 1.0).r;
      if(above == SAND){
        gl_FragColor = vec4(above, 0.0, 0.0, 1.0);
      }else{
        float diagonally = lookup(-direction, 1.0).r;
        float besides = lookup(-direction, 0.0).r;
        if(besides == SAND && diagonally == SAND){
          gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
        }else{
          gl_FragColor = vec4(thisCell, 0.0, 0.0, 1.0);
        }

      }
    }

    //gl_FragColor = vec4(thisCell, 0.0, 0.0, 1.0);
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

const programInfo = twgl.createProgramInfo(gl, [vertexShader, renderShader]);
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

const sand1 = twgl.createFramebufferInfo(gl, undefined, canvas.width, canvas.height);

const data = new Uint32Array(canvas.width * canvas.height);
data.fill(0xffffffff);
//data[canvas.width * (canvas.height - 1) + canvas.width / 2] = 0x00000000;
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer));

const sand2 = twgl.createFramebufferInfo(gl, undefined, canvas.width, canvas.height);

let frame = 0;

requestAnimationFrame(function render(time) {
  twgl.resizeCanvasToDisplaySize(canvas, window.devicePixelRatio);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const [from, to] = frame % 2 === 0 ? [sand1, sand2] : [sand2, sand1];
  frame++;

  gl.useProgram(sandProgram.program);
  twgl.bindFramebufferInfo(gl, to);
  twgl.setBuffersAndAttributes(gl, sandProgram, bufferInfo);
  twgl.setUniforms(sandProgram, {
    inverseTileTextureSize: [1 / canvas.width, 1 / canvas.height],
    sandTexture: from.attachments[0],
    direction: frame % 2 === 0 ? 1 : -1
  });

  twgl.drawBufferInfo(gl, bufferInfo);



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

canvas.addEventListener('click', e => {

  const x = e.offsetX / devicePixelRatio;
  const y = (canvas.offsetHeight - e.offsetY) / devicePixelRatio;
  console.log(x, y, canvas.offsetHeight)

  const data = new Uint32Array([0x00000000]);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer));

})