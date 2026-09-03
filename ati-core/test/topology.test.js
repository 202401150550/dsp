import test from 'node:test'
import assert from 'node:assert/strict'
import { Graph } from '../src/topology.js'

test('graph add / remove nodes', () => {
  const g = new Graph()
  g.addNode('a'); g.addNode('b')
  assert.equal(g.nodeCount(), 2)
  g.removeNode('a')
  assert.equal(g.nodeCount(), 1)
  assert.ok(!g.hasNode('a'))
})

test('undirected edges', () => {
  const g = new Graph()
  g.addNode('a'); g.addNode('b'); g.addNode('c')
  g.addEdge('a', 'b')
  g.addEdge('b', 'c')
  assert.equal(g.edgeCount(), 2)
  assert.deepEqual(g.neighbors('b').sort(), ['a', 'c'])
  assert.equal(g.degree('b'), 2)
})

test('adjacency matrix', () => {
  const g = new Graph()
  g.addNode('x'); g.addNode('y')
  g.addEdge('x', 'y')
  const { matrix, nodeOrder } = g.adjacencyMatrix()
  assert.deepEqual(nodeOrder, ['x', 'y'])
  // undirected → symmetric
  assert.equal(matrix.get(0, 1), 1)
  assert.equal(matrix.get(1, 0), 1)
})

test('laplacian matrix (path graph a-b-c)', () => {
  const g = new Graph()
  ;['a', 'b', 'c'].forEach((id) => g.addNode(id))
  g.addEdge('a', 'b'); g.addEdge('b', 'c')
  const { matrix: L } = g.laplacianMatrix()
  // L = D - A
  // degrees: a=1 b=2 c=1
  assert.equal(L.get(0, 0), 1)
  assert.equal(L.get(1, 1), 2)
  assert.equal(L.get(0, 1), -1)
  assert.equal(L.get(1, 0), -1)
})

test('connected components', () => {
  const g = new Graph()
  g.addNode('a'); g.addNode('b')
  g.addNode('c'); g.addNode('d')
  g.addEdge('a', 'b')
  g.addEdge('c', 'd')
  const comps = g.connectedComponents()
  assert.equal(comps.length, 2)
})

test('cycle detection (directed)', () => {
  const acyclic = new Graph({ directed: true })
  ;['a', 'b', 'c'].forEach((id) => acyclic.addNode(id))
  acyclic.addEdge('a', 'b'); acyclic.addEdge('b', 'c')
  assert.ok(!acyclic.hasCycle())

  const cyclic = new Graph({ directed: true })
  ;['a', 'b', 'c'].forEach((id) => cyclic.addNode(id))
  cyclic.addEdge('a', 'b'); cyclic.addEdge('b', 'c'); cyclic.addEdge('c', 'a')
  assert.ok(cyclic.hasCycle())
})

test('topological sort (DAG)', () => {
  const g = new Graph({ directed: true })
  ;['a', 'b', 'c', 'd'].forEach((id) => g.addNode(id))
  g.addEdge('a', 'b'); g.addEdge('a', 'c'); g.addEdge('b', 'd'); g.addEdge('c', 'd')
  const order = g.topologicalSort()
  assert.ok(order)
  assert.equal(order[0], 'a')
  assert.equal(order[3], 'd')
})

test('topological sort with cycle returns null', () => {
  const g = new Graph({ directed: true })
  g.addNode('a'); g.addNode('b')
  g.addEdge('a', 'b'); g.addEdge('b', 'a')
  assert.equal(g.topologicalSort(), null)
})

test('hyperedge', () => {
  const g = new Graph()
  ;['p', 'q', 'r'].forEach((id) => g.addNode(id))
  g.addHyperedge('h1', ['p', 'q', 'r'], { label: 'triangle' })
  assert.equal(g.hyperedges().length, 1)
  assert.deepEqual(g.hyperedges()[0].members.sort(), ['p', 'q', 'r'])
  g.removeNode('q')
  assert.equal(g.hyperedges().length, 0, 'removing node should drop hyperedge containing it')
})

test('serialize / deserialize roundtrip', () => {
  const g = new Graph({ directed: true })
  g.addNode('n1', { type: 'nn' })
  g.addNode('n2', { type: 'memory' })
  g.addEdge('n1', 'n2', { weight: 0.5 })
  const json = g.serialize()
  const g2 = Graph.deserialize(json)
  assert.equal(g2.directed, true)
  assert.deepEqual(g2.nodeIds().sort(), ['n1', 'n2'])
  assert.equal(g2.hasEdge('n1', 'n2'), true)
})

test('subgraph extraction', () => {
  const g = new Graph()
  ;['a', 'b', 'c', 'd'].forEach((id) => g.addNode(id))
  g.addEdge('a', 'b'); g.addEdge('b', 'c'); g.addEdge('c', 'd'); g.addEdge('d', 'a')
  const sub = g.subgraph(['a', 'b', 'c'])
  assert.equal(sub.nodeCount(), 3)
  assert.equal(sub.edgeCount(), 2)
})

test('dynamic topology mergeEdges adds missing nodes', () => {
  const g1 = new Graph()
  g1.addNode('a')
  const g2 = new Graph()
  g2.addNode('x'); g2.addNode('y')
  g2.addEdge('x', 'y')
  g1.mergeEdges(g2)
  assert.equal(g1.nodeCount(), 3)
  assert.equal(g1.hasEdge('x', 'y'), true)
})
