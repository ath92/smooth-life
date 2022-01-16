import Regl from "regl";
import frag from "./frag.glsl";

// --- State management

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
window.addEventListener("mousemove", e => {
    mouseX = e.clientX
    mouseY = e.clientY
})
let isMouseDown = false;


window.state = {
    dt: 0.441,
    outerRadius: 8,
    ratioOfRadii: 3,
    birth1: 0.257,
    birth2: 0.336,
    survival1: 0.365,
    survival2: 0.549,
    fullness1: 0.028,
    fullness2: 0.147,

    "rr": -0.546,
    "rg": 0.295,
    "rb": 0.685,
    "gr": -0.646,
    "gg": 0.658,
    "gb": 0.552,
    "br": 0.477,
    "bg": 0.627,
    "bb": -0.532,

    brushRadius: 15,
    brushRed: 0.8,
    brushGreen: 0.9,
    brushBlue: 1,
    randomSeed: 0,
    kill: 0,
}

function setState(partial) {
    Object.entries(partial).forEach(([key, value]) => {
        state[key] = value;
    })
    const params = new URLSearchParams(state);
    window.history.replaceState({}, '', `${location.pathname}?${params}`);
}

function initStateBindings() {
    const params = Object.fromEntries(new URLSearchParams(location.search).entries());
    console.log(state, params, {...state, ...params})
    Object.entries({ ...state, ...params }).forEach(([key, value]) => {
        const boundEl = document.querySelector(`[data-state="${key}"]`);
        if (!boundEl) return;

        boundEl.value = value;
        state[key] = parseFloat(value);
        boundEl.addEventListener("input", (e) => {
            setState({
                [key]: parseFloat(e.target.value)
            })
        })
    })

    const randomSeedBtn = document.querySelector("#randomSeed");
    randomSeedBtn.addEventListener("mousedown", () => state.randomSeed = 1)
    randomSeedBtn.addEventListener("mouseup", () => state.randomSeed = 0)

    const killBtn = document.querySelector("#kill");
    killBtn.addEventListener("mousedown", () => state.kill = 1)
    killBtn.addEventListener("mouseup", () => state.kill = 0)

    window.addEventListener("mouseup", e => {
        if (e.target.tagName === "CANVAS") {
            isMouseDown = false;
        }
    });
    window.addEventListener("mousedown", e => {
        if (e.target.tagName === "CANVAS") {
            isMouseDown = true;
        }
    });
};

initStateBindings();

// --- Actual simulation

function initSimulation() {
    let width = window.innerWidth / 2;
    let height = window.innerHeight / 2;

    const regl = Regl()

    const kernelTexture = regl.texture({
        width: state.outerRadius,
        height: state.outerRadius,
    });

    const kernelFbo = regl.framebuffer({
        color: kernelTexture,
        depthStencil: false,
    });

    const drawKernel = regl({
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
            uniform float ra;

            void main() {
                vec2 center = vec2(ra / 2.);
                float d = distance(center, gl_FragCoord.xy);
                float c = .5 * sin(d) + .5;
                gl_FragColor = vec4(vec3(c), 1.);
            }
        `,

        attributes: {
            position: [
                [-1, 1], [1, 1], [1, -1],
                [1, -1], [-1, -1], [-1, 1],
            ]
        },
        count: 6,

        uniforms: {
            ra: () => state.outerRadius,
            rr: () => state.ratioOfRadii,
        },
    });
        
    kernelFbo.use(() => {
        drawKernel();
    });

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
            currentFrame: () => frame,
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

            kernel: kernelFbo,
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


    const drawInitializer = regl({
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
            uniform float randomSeed;
            uniform float kill;
            varying vec2 uv;


            // 1 out, 3 in... <https://www.shadertoy.com/view/4djSRW>
            #define MOD3 vec3(.1031,.11369,.13787)
            float hash13(vec3 p3) {
                p3 = fract(p3 * MOD3);
                p3 += dot(p3, p3.yzx+19.19);
                return fract((p3.x + p3.y)*p3.z);
            }

            float rand(vec2 co){
                return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main () {
                vec4 color = texture2D(readTexture, uv * 0.5 + 0.5);
                if (mouse.z > 0.5 && distance(mouse.xy, gl_FragCoord.xy) < brushRadius){
                    color = vec4(brushColor, 1);
                }
                if (randomSeed > 0.5) {
                    color = vec4(
                        hash13(vec3(gl_FragCoord.xy, currentFrame)),
                        hash13(vec3(gl_FragCoord.xy, currentFrame + 1.)),
                        hash13(vec3(gl_FragCoord.xy, currentFrame + 2.)),
                        1
                    );
                }
                if (kill > 0.5) {
                    color = vec4(vec3(0.), 1.);
                }
                gl_FragColor = color;
            }
        `,
        uniforms: {
            readTexture: regl.prop('readTexture'),
            mouse: () => [
                mouseX / (window.innerWidth / width),
                (window.innerHeight - mouseY) / (window.innerHeight / height),
                isMouseDown || frame < 10 ? 1 : 0,
            ],
            currentFrame: () => frame,

            brushRadius: () => state.brushRadius,
            brushColor: () => [
                state.brushRed,
                state.brushGreen,
                state.brushBlue,
            ],

            randomSeed: () => state.randomSeed,
            kill: () => state.kill,
        },
        attributes: {
            position: [
                [-1, 1], [1, 1], [1, -1],
                [1, -1], [-1, -1], [-1, 1],
            ]
        },
        count: 6,
    });

    const textureOptions = {
        width,
        height,
        mag: "linear"
    };
    
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
    const getFBOs = createPingPongBuffers();
    regl.frame(() => {
        if (isMouseDown || frame < 10 || state.randomSeed || state.kill) {
            const [read, write] = getFBOs();
            write.use(() => {
                drawInitializer({
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
        frame++
    })

    return () => regl.destroy();
}

let cleanup = initSimulation();

window.addEventListener("resize", () => {
    cleanup?.();
    cleanup = initSimulation();
});
