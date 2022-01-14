// Original shader copied from https://www.shadertoy.com/view/Msy3RD
// Added smooth time stepping, adapted it for parameter control through uniforms,
// and support for RGB (i.e. modelling adversarial relations between the color channels)

precision lowp float;

uniform float currentFrame;
uniform vec2 resolution;
uniform sampler2D readTexture;
uniform vec3 mouse;
uniform float randomSeed;
uniform float kill;
uniform float dt;
uniform mat3 color_conv;
// based on <https://git.io/vz29Q>
// ---------------------------------------------
// smoothglider (discrete time stepping 2D)
uniform float ra;         // outer radius
uniform float rr;          // ratio of radii
uniform float b1;        // birth1
uniform float b2;        // birth2
uniform float s1;        // survival1
uniform float s2;        // survival2
uniform float alpha_n;   // sigmoid width for outer fullness
uniform float alpha_m;   // sigmoid width for inner fullness
// ---------------------------------------------


const vec3 h3 = vec3(.5);

vec3 sigma1(vec3 x,vec3 a,float alpha) 
{ 
    return 1.0 / ( 1.0 + exp( -(x-a)*4.0/alpha ) );
}

vec3 sigma2(vec3 x,vec3 a,vec3 b,float alpha)
{
    return sigma1(x,a,alpha) 
        * ( 1.0-sigma1(x,b,alpha) );
}

vec3 sigma_m(float x,float y,vec3 m,float alpha)
{
    return x * ( 1.0-sigma1(m,h3,alpha) ) 
        + y * sigma1(m,h3,alpha);
}

// the transition function
// (n = outer fullness, m = inner fullness)
vec3 s(vec3 n,vec3 m)
{
    return sigma2( n, sigma_m(b1,s1,m,alpha_m), 
        sigma_m(b2,s2,m,alpha_m), alpha_n );
}

float ramp_step(float x,float a,float ea)
{
    return clamp((x-a)/ea + 0.5,0.0,1.0);
}

// 1 out, 3 in... <https://www.shadertoy.com/view/4djSRW>
#define MOD3 vec3(.1031,.11369,.13787)
float hash13(vec3 p3) {
	p3 = fract(p3 * MOD3);
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.x + p3.y)*p3.z);
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

    vec2 uv = gl_FragCoord.xy / resolution.xy;
    const float maxRa = 24.;
    // inner radius:
    float rb = ra/rr;
    // area of annulus:
    const float PI = 3.14159265358979;
    float AREA_OUTER = PI * (ra*ra - rb*rb);
    float AREA_INNER = PI * rb * rb;
    
    // how full are the annulus and inner disk?
    vec3 outf = vec3(0., 0., 0.), inf = vec3(0., 0., 0.);
    for(float _dx=0.; _dx<=2.*maxRa; _dx++) {
        float dx = _dx - ra;
        for(float _dy=0.; _dy<=2.*maxRa; _dy++) {
            float dy = _dy - ra;
            float r = sqrt(float(dx*dx + dy*dy));
            vec2 txy = mod((gl_FragCoord.xy + vec2(dx,dy)) / resolution.xy, 1.);
            vec3 val = getBiasedVal(texture2D(readTexture, txy).xyz, redBias, greenBias, blueBias); 
            inf  += val * ramp_step(-r,-rb,1.0);
            outf += val * ramp_step(-r,-ra,1.0) 
                        * ramp_step(r,rb,1.0);
            if (dy > 2. * ra) break;
        }
        if (dx > 2. * ra) break;
    }
    outf /= AREA_OUTER; // normalize by area
    inf /= AREA_INNER; // normalize by area
    
    vec3 prev = texture2D(readTexture, gl_FragCoord.xy / resolution.xy).xyz;
    // square dt to get a nicer UX out of the slider
    vec3 c = prev + dt*dt * (s(outf,inf) - prev);
    if(randomSeed > 0.5 || currentFrame <= 1.) { //  || mouse.z > 0.
        //c = hash13(vec3(fragCoord,frame)) - texture(iChannel1, uv).x + 0.5;
        c = vec3(
            hash13(vec3(gl_FragCoord.xy, currentFrame)),
            hash13(vec3(gl_FragCoord.xy, currentFrame + 1.)),
            hash13(vec3(gl_FragCoord.xy, currentFrame + 2.))
        );
    }
    if (kill > 0.5) {
        c = vec3(0.);
    }
    gl_FragColor = vec4(c,1);
}