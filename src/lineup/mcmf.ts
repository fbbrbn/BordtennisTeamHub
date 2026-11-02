/**
 * Minimal min-cost max-flow (successive shortest paths with SPFA).
 *
 * The lineup planner models a season as a flow network: each upcoming match
 * has N open slots, each slot can go to an eligible player, and every extra
 * match a player gets costs more than the previous one (convex cost). The
 * cheapest way to fill every slot is then the most balanced season plan.
 * Graphs are tiny (a few dozen nodes), so clarity beats speed here.
 */
export interface FlowEdge {
  to: number;
  cap: number;
  cost: number;
  rev: number;
}

export class MinCostFlow {
  private readonly graph: FlowEdge[][];

  constructor(nodeCount: number) {
    this.graph = Array.from({ length: nodeCount }, () => []);
  }

  /** Adds a directed edge and returns it, so callers can read its remaining capacity later. */
  addEdge(from: number, to: number, cap: number, cost: number): FlowEdge {
    if (from === to) throw new Error('self loops are not supported');
    const forward: FlowEdge = { to, cap, cost, rev: this.graph[to].length };
    const backward: FlowEdge = { to: from, cap: 0, cost: -cost, rev: this.graph[from].length };
    this.graph[from].push(forward);
    this.graph[to].push(backward);
    return forward;
  }

  /** Pushes as much flow as possible from source to sink at minimum total cost. */
  run(source: number, sink: number): { flow: number; cost: number } {
    const n = this.graph.length;
    let flow = 0;
    let cost = 0;

    for (;;) {
      const dist = new Array<number>(n).fill(Infinity);
      const inQueue = new Array<boolean>(n).fill(false);
      const prevNode = new Array<number>(n).fill(-1);
      const prevEdge = new Array<number>(n).fill(-1);
      const queue: number[] = [source];
      dist[source] = 0;
      inQueue[source] = true;

      for (let head = 0; head < queue.length; head++) {
        const u = queue[head];
        inQueue[u] = false;
        const edges = this.graph[u];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) {
            dist[e.to] = dist[u] + e.cost;
            prevNode[e.to] = u;
            prevEdge[e.to] = i;
            if (!inQueue[e.to]) {
              inQueue[e.to] = true;
              queue.push(e.to);
            }
          }
        }
      }

      if (dist[sink] === Infinity) break;

      let push = Infinity;
      for (let v = sink; v !== source; v = prevNode[v]) {
        push = Math.min(push, this.graph[prevNode[v]][prevEdge[v]].cap);
      }
      for (let v = sink; v !== source; v = prevNode[v]) {
        const e = this.graph[prevNode[v]][prevEdge[v]];
        e.cap -= push;
        this.graph[v][e.rev].cap += push;
      }
      flow += push;
      cost += push * dist[sink];
    }

    return { flow, cost };
  }
}
