import Regl from "regl";
import frag from "./frag.glsl";

let mouseX, mouseY;
window.addEventListener("mousemove", e => {
    mouseX = e.clientX
    mouseY = e.clientY
})
let isMouseDown = false;

const state = {
    dt: 0.5,
    outerRadius: 8,
    ratioOfRadii: 3,
    birth1: 0.257,
    birth2: 0.336,
    survival1: 0.365,
    survival2: 0.549,
    fullness1: 0.028,
    fullness2: 0.147,

    rr: 0.5,
    rg: 0.0,
    rb: -0.2,
    
    gr: 0.5,
    gg: 0.5,
    gb: 0.2,

    br: -0.6,
    bg: 0.28,
    bb: 1,

    brushRadius: 15,
    brushRed: 0.8,
    brushGreen: 0.9,
    brushBlue: 1,
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

    document.querySelector("canvas").addEventListener("mousedown", () => isMouseDown = true)
    document.querySelector("canvas").addEventListener("mouseup", () => isMouseDown = false)
};

const regl = Regl()

initStateBindings();

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
        }
    `,
  
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

        color_conv: () => {
            return [
                state.rr, state.rg, state.rb,
                state.gr, state.gg, state.gb,
                state.br, state.bg, state.bb,
            ];
        },

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
        uniform vec3 brushColor;
        varying vec2 uv;

        float rand(vec2 co){
            return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main () {
          vec4 color = texture2D(readTexture, uv * 0.5 + 0.5);
          if (mouse.z > 0.5 && distance(mouse.xy, gl_FragCoord.xy) < brushRadius){
            color = vec4(brushColor, 1);
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
        currentFrame: () => frame,

        brushRadius: () => state.brushRadius,
        brushColor: () => [
            state.brushRed,
            state.brushGreen,
            state.brushBlue,
        ],
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
        console.log("drawing brush")
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
