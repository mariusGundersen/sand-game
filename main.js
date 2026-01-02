
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
  precision highp float;

  uniform vec2 inverseTileTextureSize;
  uniform sampler2D sandTexture;

  varying vec2 texCoord;

  vec2 lookup(float x, float y);

  void main() {
    float thisCell = lookup(0.0, 0.0).r;

    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }

  vec2 lookup(float x, float y) {
    return floor(texture2D(sandTexture, texCoord + inverseTileTextureSize * vec2( x, y)).xy*256.0);
  }
`
];

const canvas = document.querySelector('canvas#triangle');
const gl = canvas.getContext("webgl");

const programInfo = twgl.createProgramInfo(gl, [vertexShader, renderShader]);
const sandProgram = twgl.createProgramInfo(gl, sandShaders);

const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
  // this is the attribute again
  position: [
    -1, -1, 0, //
    1, -1, 0,
    1, 1, 0,
    //
    -1, 1, 0,
    -1, -1, 0,
    1, 1, 0
  ],
});

const sand1 = twgl.createFramebufferInfo(gl, [
  { format: gl.RGBA, type: gl.UNSIGNED_BYTE, min: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE }
]);
const sand2 = twgl.createFramebufferInfo(gl, [
  { format: gl.RGBA, type: gl.UNSIGNED_BYTE, min: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE }
]);

requestAnimationFrame(function render(time) {
  twgl.resizeCanvasToDisplaySize(canvas, window.devicePixelRatio);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.useProgram(sandProgram.program);
  twgl.bindFramebufferInfo(gl, sand2);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, {
    inverseTileTextureSize: [1 / canvas.width, 1 / canvas.height],
    sandTexture: sand1.attachments[0].attachment
  });

  twgl.drawBufferInfo(gl, bufferInfo);



  gl.useProgram(programInfo.program);
  twgl.bindFramebufferInfo(gl, null);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, {
    // and this is the uniform again
    time: time / 1000,
  });
  twgl.drawBufferInfo(gl, bufferInfo);

  requestAnimationFrame(render);
});
