// shader copied from https://www.shadertoy.com/view/Msy3RD

precision highp float;

uniform int currentFrame;
uniform vec2 resolution;
uniform sampler2D readTexture;
uniform vec3 mouse;

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

float sigma1(float x,float a,float alpha) 
{ 
    return 1.0 / ( 1.0 + exp( -(x-a)*4.0/alpha ) );
}

float sigma2(float x,float a,float b,float alpha)
{
    return sigma1(x,a,alpha) 
        * ( 1.0-sigma1(x,b,alpha) );
}

float sigma_m(float x,float y,float m,float alpha)
{
    return x * ( 1.0-sigma1(m,0.5,alpha) ) 
        + y * sigma1(m,0.5,alpha);
}

// the transition function
// (n = outer fullness, m = inner fullness)
float s(float n,float m)
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



void main()
{
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    const float maxRa = 24.;
    // inner radius:
    float rb = ra/rr;
    // area of annulus:
    const float PI = 3.14159265358979;
    float AREA_OUTER = PI * (ra*ra - rb*rb);
    float AREA_INNER = PI * rb * rb;
    
    // how full are the annulus and inner disk?
    float outf = 0.0, inf = 0.0;
    for(float _dx=0.; _dx<=2.*maxRa; _dx++) {
        float dx = _dx - ra;
        for(float _dy=0.; _dy<=2.*maxRa; _dy++) {
            float dy = _dy - ra;
            float r = sqrt(float(dx*dx + dy*dy));
            vec2 txy = mod((gl_FragCoord.xy + vec2(dx,dy)) / resolution.xy, 1.);
            float val = texture2D(readTexture, txy).x; 
            inf  += val * ramp_step(-r,-rb,1.0);
            outf += val * ramp_step(-r,-ra,1.0) 
                        * ramp_step(r,rb,1.0);
            if (dy > 2. * ra) break;
        }
        if (dx > 2. * ra) break;
    }
    outf /= AREA_OUTER; // normalize by area
    inf /= AREA_INNER; // normalize by area
    
    float c = s(outf,inf); // discrete time step
    if(currentFrame < 10) { //  || mouse.z > 0.
        //c = hash13(vec3(fragCoord,frame)) - texture(iChannel1, uv).x + 0.5;
        c = hash13(vec3(gl_FragCoord.xy, currentFrame)) * 0.75;
    }
    gl_FragColor = vec4(c,c,c,1);
}