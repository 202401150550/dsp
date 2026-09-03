// ati-core · 线性代数子模块
// 纯数学，不依赖任何神经网络 / 业务代码

export class Vec {
  constructor(data) {
    if (!Array.isArray(data)) throw new TypeError('Vec expects array')
    this.data = data
  }

  get dim() { return this.data.length }
  get(i) { return this.data[i] }
  set(i, v) { this.data[i] = v; return this }

  clone() { return new Vec([...this.data]) }
  add(other) {
    this._checkDim(other)
    return new Vec(this.data.map((v, i) => v + other.data[i]))
  }
  sub(other) {
    this._checkDim(other)
    return new Vec(this.data.map((v, i) => v - other.data[i]))
  }
  scale(k) { return new Vec(this.data.map((v) => v * k)) }

  dot(other) {
    this._checkDim(other)
    let s = 0
    for (let i = 0; i < this.dim; i++) s += this.data[i] * other.data[i]
    return s
  }

  norm(p = 2) {
    if (p === Infinity) return Math.max(...this.data.map(Math.abs))
    const s = this.data.reduce((acc, v) => acc + Math.pow(Math.abs(v), p), 0)
    return Math.pow(s, 1 / p)
  }

  normalize() {
    const n = this.norm()
    return n === 0 ? this.clone() : this.scale(1 / n)
  }

  toArray() { return [...this.data] }
  _checkDim(other) {
    if (!(other instanceof Vec)) throw new TypeError('expects Vec')
    if (other.dim !== this.dim) throw new RangeError(`dim mismatch ${this.dim} vs ${other.dim}`)
  }
}

export class Mat {
  // rows: number[][] — row-major
  constructor(rows) {
    Mat._validate(rows)
    this.rows = rows
  }

  static _validate(rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('Mat expects non-empty rows')
    const cols = rows[0].length
    for (const r of rows) {
      if (!Array.isArray(r) || r.length !== cols) throw new TypeError('all rows must have same length')
    }
  }

  static zeros(r, c) {
    return new Mat(Array.from({ length: r }, () => new Array(c).fill(0)))
  }
  static identity(n) {
    const m = Mat.zeros(n, n)
    for (let i = 0; i < n; i++) m.rows[i][i] = 1
    return m
  }
  static diag(values) {
    const n = values.length
    const m = Mat.zeros(n, n)
    for (let i = 0; i < n; i++) m.rows[i][i] = values[i]
    return m
  }
  static fromRows(rows) { return new Mat(rows) }

  get rowCount() { return this.rows.length }
  get colCount() { return this.rows[0].length }
  get shape() { return [this.rowCount, this.colCount] }
  isSquare() { return this.rowCount === this.colCount }

  get(i, j) { return this.rows[i][j] }
  set(i, j, v) { this.rows[i][j] = v; return this }
  row(i) { return new Vec([...this.rows[i]]) }
  col(j) { return new Vec(this.rows.map((r) => r[j])) }

  T() {
    const out = Mat.zeros(this.colCount, this.rowCount)
    for (let i = 0; i < this.rowCount; i++)
      for (let j = 0; j < this.colCount; j++)
        out.rows[j][i] = this.rows[i][j]
    return out
  }

  mulVec(v) {
    if (this.colCount !== v.dim) throw new RangeError(`matmul vec: ${this.colCount} vs ${v.dim}`)
    return new Vec(this.rows.map((r) => r.reduce((s, a, j) => s + a * v.get(j), 0)))
  }

  mulMat(other) {
    if (this.colCount !== other.rowCount) throw new RangeError(`shape mismatch ${this.shape} × ${other.shape}`)
    const out = Mat.zeros(this.rowCount, other.colCount)
    for (let i = 0; i < this.rowCount; i++)
      for (let k = 0; k < other.colCount; k++) {
        let s = 0
        for (let j = 0; j < this.colCount; j++) s += this.rows[i][j] * other.rows[j][k]
        out.rows[i][k] = s
      }
    return out
  }

  scale(k) {
    return new Mat(this.rows.map((r) => r.map((v) => v * k)))
  }

  det() {
    if (!this.isSquare()) throw new Error('det requires square matrix')
    const n = this.rowCount
    const a = this.rows.map((r) => [...r])
    let d = 1
    for (let i = 0; i < n; i++) {
      // pivot
      let piv = i
      for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[piv][i])) piv = k
      if (Math.abs(a[piv][i]) < 1e-12) return 0
      if (piv !== i) { [a[i], a[piv]] = [a[piv], a[i]]; d = -d }
      d *= a[i][i]
      for (let k = i + 1; k < n; k++) {
        const f = a[k][i] / a[i][i]
        for (let j = i; j < n; j++) a[k][j] -= f * a[i][j]
      }
    }
    return d
  }

  inv() {
    if (!this.isSquare()) throw new Error('inv requires square matrix')
    const n = this.rowCount
    const a = this.rows.map((r) => [...r])
    const b = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0); row[i] = 1; return row
    })
    for (let i = 0; i < n; i++) {
      let piv = i
      for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[piv][i])) piv = k
      if (Math.abs(a[piv][i]) < 1e-12) throw new Error('singular matrix')
      ;[a[i], a[piv]] = [a[piv], a[i]]
      ;[b[i], b[piv]] = [b[piv], b[i]]
      const pv = a[i][i]
      for (let j = 0; j < n; j++) { a[i][j] /= pv; b[i][j] /= pv }
      for (let k = 0; k < n; k++) {
        if (k === i) continue
        const f = a[k][i]
        if (f === 0) continue
        for (let j = 0; j < n; j++) { a[k][j] -= f * a[i][j]; b[k][j] -= f * b[i][j] }
      }
    }
    return new Mat(b)
  }

  trace() {
    if (!this.isSquare()) throw new Error('trace requires square matrix')
    let s = 0
    for (let i = 0; i < this.rowCount; i++) s += this.rows[i][i]
    return s
  }

  frobeniusNorm() {
    let s = 0
    for (const r of this.rows) for (const v of r) s += v * v
    return Math.sqrt(s)
  }

  toArray() { return this.rows.map((r) => [...r]) }
}
