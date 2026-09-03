// Open World · views-space（ATI 场背景；星系/深空整页已移除）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/views-space',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useEffect, useRef } = React

    const WEBGL_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`

    function AtiFieldCanvas({ active, tick }) {
      const ref = useRef(null)
      useEffect(() => {
        if (!active) return undefined
        const canvas = ref.current
        if (!canvas) return undefined
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: false })
        if (!gl) return undefined
        const vs = gl.createShader(gl.VERTEX_SHADER)
        const fs = gl.createShader(gl.FRAGMENT_SHADER)
        gl.shaderSource(vs, WEBGL_VS)
        gl.shaderSource(fs, `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
out vec4 fragColor;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.7))) * 45758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float dist = length(c);
  vec3 col = vec3(0.01, 0.015, 0.04);
  float ang = atan(c.y, c.x);
  float field = sin(ang * 5.0 + dist * 22.0 - uTime * 0.35) * 0.5 + 0.5;
  field *= exp(-dist * 1.8);
  col += vec3(0.35, 0.15, 0.65) * field * 0.35;
  col += vec3(0.1, 0.55, 0.5) * field * 0.2 * sin(uTime * 0.5 + dist * 8.0);
  float grid = abs(sin(uv.x * uRes.x * 0.04 + uTime * 0.1)) * abs(sin(uv.y * uRes.y * 0.04));
  col += vec3(0.05, 0.12, 0.2) * grid * 0.08 * exp(-dist * 2.0);
  fragColor = vec4(col, 1.0);
}`)
        gl.compileShader(vs)
        gl.compileShader(fs)
        const prog = gl.createProgram()
        gl.attachShader(prog, vs)
        gl.attachShader(prog, fs)
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined
        gl.useProgram(prog)
        const uTime = gl.getUniformLocation(prog, 'uTime')
        const uRes = gl.getUniformLocation(prog, 'uRes')
        let raf = 0
        const start = performance.now()
        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          canvas.width = Math.floor(canvas.clientWidth * dpr)
          canvas.height = Math.floor(canvas.clientHeight * dpr)
          gl.viewport(0, 0, canvas.width, canvas.height)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)
        const draw = (now) => {
          raf = requestAnimationFrame(draw)
          gl.uniform1f(uTime, (now - start) / 1000)
          gl.uniform2f(uRes, canvas.width, canvas.height)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
        }
        raf = requestAnimationFrame(draw)
        return () => { cancelAnimationFrame(raf); ro.disconnect(); gl.deleteProgram(prog) }
      }, [active])
      return React.createElement('canvas', { ref, className: 'ow-bg-canvas' })
    }

    module.exports = {
      WEBGL_VS,
      AtiFieldCanvas,
    }
    return module.exports
  },
})
