// Original shader copied from https://www.shadertoy.com/view/Msy3RD
// Added smooth time stepping, adapted it for parameter control through uniforms,
// and support for RGB (i.e. modelling adversarial relations between the color channels)

precision mediump float;

uniform float currentFrame;
uniform vec2 resolution;
uniform sampler2D readTexture;
uniform float dt;
uniform mat3 color_conv;
uniform sampler2D kernelTexture;
uniform float ra; // kernel size
uniform float center;
uniform float stdDev;

vec3 _center =vec3(center);
vec3 _stdDev = vec3(stdDev * stdDev);
vec3 one = vec3(1);

vec3 transition(vec3 a) {
    vec3 l = a - _center;
    return 2. * exp(-(l*l) / (2. * _stdDev)) - one;
}

vec3 sum1(vec3 v) {
    return v / (v.x + v.y + v.z);
}

vec3 getBiasedVal(vec3 val, vec3 redBias, vec3 greenBias, vec3 blueBias) {
    return vec3(
        redBias.x * val.x + redBias.y * val.y + redBias.z * val.z,
        greenBias.x * val.x + greenBias.y * val.y + greenBias.z * val.z,
        blueBias.x * val.x + blueBias.y * val.y + blueBias.z * val.z
    );
}

void main()
{
    vec3 redBias = sum1(color_conv[0]);
    vec3 greenBias = sum1(color_conv[1]);
    vec3 blueBias = sum1(color_conv[2]);

    const float maxRa = 24.;
    
    vec3 neighbourhood = vec3(0.);
    for(float _dx=0.; _dx<=2.*maxRa; _dx++) {
        float dx = _dx - ra;
        for(float _dy=0.; _dy<=2.*maxRa; _dy++) {
            float dy = _dy - ra;
            vec2 txy = mod((gl_FragCoord.xy + vec2(dx,dy)) / resolution.xy, 1.);
            vec3 val = getBiasedVal(texture2D(readTexture, txy).xyz, redBias, greenBias, blueBias); 
            float kernelValue = texture2D(kernelTexture, vec2(_dx + .5, _dy + .5) / (2.*ra)).x * 2. - 1.;
            neighbourhood += val * kernelValue;
            if (dy >= 2. * ra) break;
        }
        if (dx >= 2. * ra) break;
    }
    neighbourhood /= ra*ra;
    
    vec3 prev = texture2D(readTexture, gl_FragCoord.xy / resolution.xy).xyz;
    // square dt to get a nicer UX out of the slider
    vec3 trans = transition(neighbourhood);
    vec3 c = prev + dt * dt * (trans - prev);
    gl_FragColor = vec4(c,1);
}