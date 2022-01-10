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

const state = {
    dt: 0.5,
    outerRadius: 8,
    ratioOfRadii: 3,
    birth1: 0.34,
    birth2: 0.56,
    survival1: 0.56,
    survival2: 0.75,
    fullness1: 0.07,
    fullness2: 0.230,

    brushRadius: 10,
    randomSeed: 0,
    kill: 0,
}

function initStateBindings() {
    Object.entries(state).forEach(([key, value]) => {
        const boundEl = document.querySelector(`[data-state="${key}"]`);
        if (!boundEl) return;

        boundEl.value = value;
        boundEl.addEventListener("input", (e) => {
            state[key] = parseFloat(e.target.value);
        })
    })

    const randomSeedBtn = document.querySelector("#randomSeed");
    randomSeedBtn.addEventListener("mousedown", () => state.randomSeed = 1)
    randomSeedBtn.addEventListener("mouseup", () => state.randomSeed = 0)

    const killBtn = document.querySelector("#kill");
    killBtn.addEventListener("mousedown", () => state.kill = 1)
    killBtn.addEventListener("mouseup", () => state.kill = 0)

};

initStateBindings();

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

        dt: () => state.dt,
        ra: () => state.outerRadius,
        rr: () => state.ratioOfRadii,
        b1: () => state.birth1,
        b2: () => state.birth2,
        s1: () => state.survival1,
        s2: () => state.survival2,
        alpha_n: () => state.fullness1,
        alpha_m: () => state.fullness2,
        randomSeed: () => state.randomSeed,
        kill: () => state.kill,
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


const drawBrushStroke = regl({
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
        uniform vec3 mouse;
        uniform float brushRadius;
        uniform float currentFrame;
        varying vec2 uv;

        float rand(vec2 co){
            return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main () {
          vec4 color = texture2D(readTexture, uv * 0.5 + 0.5);
          if (mouse.z > 0.5 && distance(mouse.xy, gl_FragCoord.xy) < brushRadius && rand(gl_FragCoord.xy * currentFrame) > 0.5){
            color = vec4(1);
          }
          gl_FragColor = color;
        }
    `,
    uniforms: {
        readTexture: regl.prop('readTexture'),
        mouse: () => [
            mouseX,
            window.innerHeight - mouseY,
            isMouseDown ? 1 : 0,
        ],
        brushRadius: () => state.brushRadius,
        currentFrame: () => frame,
    },
    attributes: {
        position: [
            [-1, 1], [1, 1], [1, -1],
            [1, -1], [-1, -1], [-1, 1],
        ]
    },
    count: 6,
})

const getFBOs = createPingPongBuffers();
regl.frame(() => {
    if (isMouseDown) {
        const [read, write] = getFBOs();
        write.use(() => {
            drawBrushStroke({
                readTexture: read,
            });
        });
    }

    const [read, write] = getFBOs();
    write.use(() => {
        drawLife({
            readTexture: read,
        });
    });
    drawToCanvas({
        readTexture: write
    });
})
