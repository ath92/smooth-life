import Regl from "regl";
import frag from "./frag.glsl";

let mouseX, mouseY;
window.addEventListener("mousemove", e => {
    mouseX = e.clientX
    mouseY = e.clientY
})
let isMouseDown = false;
window.addEventListener("mousedown", () => isMouseDown = true)
window.addEventListener("mouseup", () => isMouseDown = false)

const regl = Regl()

const textureOptions = {
    width: window.innerWidth,
    height: window.innerHeight,
}
const createPingPongBuffers = () => {
    const tex1 = regl.texture(textureOptions);
    const tex2 = regl.texture(textureOptions);
    const one = regl.framebuffer({
        color: tex1,
        depthStencil: false
    });
    const two = regl.framebuffer({
        color: tex2,
        depthStencil: false
    });
    let flip = false
    return () => {
        flip = !flip
        return flip ? [one, two] : [two, one]
    }
};

let frame = 0;
const drawLife = regl({
    frag,
  
    vert: `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0, 1);
    }`,
  
    attributes: {
        position: [
            [-1, 1], [1, 1], [1, -1],
            [1, -1], [-1, -1], [-1, 1],
        ]
    },

    uniforms: {
        resolution: ctx => [ctx.viewportWidth, ctx.viewportHeight],
        currentFrame: () => ++frame,
        mouse: () => [
            mouseX / window.innerWidth,
            mouseY / window.innerHeight,
            isMouseDown ? 1 : 0,
        ],
        readTexture: regl.prop("readTexture"),

    },
  
    count: 6
})

// render texture to screen
const drawToCanvas = regl({
    vert: `
        precision highp float;
        attribute vec2 position;
        varying vec2 uv;
        void main() {
            uv = position;
            gl_Position = vec4(position, 0, 1);
        }
    `,
    frag: `
        precision highp float;
        uniform sampler2D readTexture;
        varying vec2 uv;

        void main () {
          vec4 color = texture2D(readTexture, uv * 0.5 + 0.5);
          gl_FragColor = color;
        }
    `,
    uniforms: {
        readTexture: regl.prop('readTexture'),
    },
    attributes: {
        position: [
            [-1, 1], [1, 1], [1, -1],
            [1, -1], [-1, -1], [-1, 1],
        ]
    },
    count: 6,
});

const getFBOs = createPingPongBuffers();
regl.frame(() => {
    const [read, write] = getFBOs();
    write.use(() => {
        drawLife({
            readTexture: read,
        })
    })
    drawToCanvas({
        readTexture: write
    })
})
