import Konva from "konva";

function multiArray(dim, len, val = 0): any {
    if (dim === 0) {
        return val
    } else {
        const arr = Array(len);
        for (let i = 0; i < len; i++) {
            arr[i] = multiArray(dim - 1, len, val)
        }
        return arr
    }
}

function arrayEqual<T>(a1: T[], a2: T[]): boolean {
    if (a1 === null && a2 === null) return true
    if (a1 === null || a2 === null) return false
    if (a1.length !== a2.length) return false
    for (let i = 0; i < a1.length; i++) if (a1[i] !== a2[i]) return false
    return true
}

class Pos {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    equal(p: Pos): boolean {
        return p.x === this.x && p.y === this.y
    }
}

const r = 20;

function toScreenPos(p: Pos): Pos {
    const dr = Math.sqrt(3) * 0.5 * r;
    return new Pos(40 + p.x * 1.5 * r, 40 + 2 * dr * p.y + (p.x % 2 === 1 ? dr : 0));
}

class Ant {
    private _pos = new Pos(0, 0)
    id = 0;
    history: Pos[] = [];
    circle: Konva.Circle;
    text: Konva.Text;

    constructor(pos: Pos, id: number, antLayer: Konva.Layer) {
        this.circle = new Konva.Circle({
            id: `Ant-${id}-Circle`,
            radius: r / 2,
            fill: "#ff0000",
            stroke: "#ffffff",
            strokeWidth: 1,
        })
        this.text = new Konva.Text({
            text: String(id),
            id: `Ant-${id}-Text`,
            align: "center",
            verticalAlign: "center",
            fontSize: 10
        })
        antLayer.add(this.circle, this.text)
        this.id = id;
        this.pos = pos
    }

    get pos(): Pos {
        return this._pos;
    }

    set pos(value: Pos) {
        this.history.push(this._pos)
        this._pos = value;
        const screenPos = toScreenPos(value)
        this.circle.x(screenPos.x)
        this.circle.y(screenPos.y)
        this.text.x(screenPos.x)
        this.text.y(screenPos.y)
    }

    lastPos(): Pos {
        if (this.history.length === 0) {
            return new Pos(-1, -1)
        } else {
            return this.history[this.history.length - 1]
        }
    }

    remove() {
        this.circle.destroy()
        this.text.destroy()
    }
}

class AntColony {
    mapLen: number;
    startPos: Pos;
    goalPos: Pos;
    maxAnt: number;
    isDeadPos: (p: Pos) => boolean;
    ants: Ant[];
    spawnCounter: number;
    spawnInterval: number;
    pheromone: number[][][][];
    maxPheromone: number;
    minPheromone: number;
    totalAnt: number;
    blocks: Konva.RegularPolygon[][];
    mapLayer: Konva.Layer;
    antLayer: Konva.Layer;

    constructor(mapLen: number, startPos: Pos, goalPos: Pos, maxAnt: number, isDeadPos: (p: Pos) => boolean, spawnInterval: number, stage: Konva.Stage) {
        this.mapLen = mapLen;
        this.startPos = startPos;
        this.goalPos = goalPos;
        this.maxAnt = maxAnt;
        this.isDeadPos = isDeadPos;
        this.ants = [];
        this.spawnInterval = spawnInterval;
        this.spawnCounter = spawnInterval;
        this.pheromone = multiArray(4, mapLen);
        this.maxPheromone = 0;
        this.minPheromone = 0;
        this.totalAnt = 0;
        this.mapLayer = new Konva.Layer();
        this.antLayer = new Konva.Layer();
        stage.add(this.mapLayer, this.antLayer);
        this.initBlocks();
        this.updateBlockColor();
    }

    nextPos(p: Pos, d: number): [Pos, boolean] {
        const dx = [1, -1, 0, 0, 1, -1], dy = (p.x % 2 === 0) ? [0, 0, 1, -1, -1, -1] : [0, 0, 1, -1, 1, 1]
        const x = p.x + dx[d], y = p.y + dy[d]
        return [new Pos(x, y), x >= 0 && x < this.mapLen && y >= 0 && y < this.mapLen]
    }

    initBlocks() {
        this.blocks = Array(this.mapLen);
        for (let x = 0; x < this.mapLen; x++) {
            this.blocks[x] = Array(this.mapLen)
            for (let y = 0; y < this.mapLen; y++) {
                const screenPos = toScreenPos(new Pos(x, y))
                const block = new Konva.RegularPolygon({
                    id: `Blk-${x}-${y}`,
                    x: screenPos.x,
                    y: screenPos.y,
                    sides: 6,
                    radius: r,
                    rotation: 90,
                    fill: "#ffffff",
                    stroke: "#000000",
                    strokeWidth: 2,
                })
                this.mapLayer.add(block);
                this.blocks[x][y] = block;
            }
        }
    }

    getPheromone(p1: Pos, p2: Pos): number {
        return this.pheromone[p1.x][p1.y][p2.x][p2.y]
    }

    setPheromone(p1: Pos, p2: Pos, phe: number) {
        this.pheromone[p1.x][p1.y][p2.x][p2.y] = phe
    }

    calculatePheromone(p: Pos): number {
        return Math.max(
            ...Array.from({length: 6}, (_, i) => this.nextPos(p, i))
                .filter(([np, va]) => va)
                .map(([np, va]) => this.getPheromone(p, np))
        )
    }

    colorToRGB(c: string): number[] {
        const rgb = [c.substring(1, 3), c.substring(3, 5), c.substring(5, 7)]
        return rgb.map((comp) => parseInt(comp, 16))
    }

    RGBToColor(c: number[]): string {
        return "#" + c.map((comp) => Math.round(comp).toString(16).padStart(2, "0")).join("")
    }

    colorInterpolate(c1: string, c2: string, lambda: number): string {
        const rgb1 = this.colorToRGB(c1), rgb2 = this.colorToRGB(c2)
        const rgb = Array.from({length: 3}, (_, i) => lambda * rgb1[i] + (1 - lambda) * rgb2[i])
        return this.RGBToColor(rgb)
    }

    updateBlockColor() {
        for (let x = 0; x < this.mapLen; x++) {
            for (let y = 0; y < this.mapLen; y++) {
                const p = new Pos(x, y)
                let color = "#ffffff";
                if (this.isDeadPos(p)) {
                    color = "#555555"
                } else if (this.startPos.equal(p)) {
                    color = "#36cbff"
                } else if (this.goalPos.equal(p)) {
                    color = "#30d93c"
                } else {
                    const phe = this.calculatePheromone(p)
                    if (phe > 0) {
                        color = this.colorInterpolate(color, "#ff4545", phe / this.maxPheromone)
                    } else if (phe < 0) {
                        color = this.colorInterpolate(color, "#3754ff", phe / this.minPheromone)
                    }
                }
                this.blocks[x][y].fill(color)
            }
        }
    }

    trySpawnAnt() {
        this.spawnCounter = Math.max(this.spawnCounter - 1, 0);
        if (this.spawnCounter === 0 && this.ants.length < this.maxAnt) {
            this.ants.push(new Ant(this.startPos, this.totalAnt, this.antLayer));
            this.totalAnt += 1;
            this.spawnCounter = this.spawnInterval;
        }
    }

    tauFunc(p1: Pos, p2: Pos): number {
        return this.getPheromone(p1, p2)
    }

    euclideanDistance(p1: Pos, p2: Pos) {
        return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y))
    }

    distanceToGoal(p: Pos) {
        return this.euclideanDistance(p, this.goalPos)
    }

    etaFunc(p1: Pos, p2: Pos) {
        const d1 = this.distanceToGoal(p1), d2 = this.distanceToGoal(p2)
        if (d2 === 0) {
            return 1000000
        } else {
            return 1 / d2
        }
    }

    updatePheromone(p1: Pos, p2: Pos, rho: number, delta: number) {
        const newPheromone = (1 - rho) * this.pheromone[p1.x][p1.y][p2.x][p2.y] + delta
        this.maxPheromone = Math.max(this.maxPheromone, newPheromone)
        this.minPheromone = Math.min(this.minPheromone, newPheromone)
        this.setPheromone(p1, p2, newPheromone)
    }

    updateAnt(ant: Ant) {
        // Choose Direction
        const alpha = 1, beta = 3, p0 = 0.4

        const x = ant.pos.x, y = ant.pos.y
        const p = [0, 0, 0, 0, 0, 0], valid = Array(6)

        for (let i = 0; i < 6; i++) {
            const [np, va] = this.nextPos(ant.pos, i)
            if (!va || ant.lastPos().equal(np)) {
                valid[i] = false
            } else {
                valid[i] = true
                const tau = this.tauFunc(ant.pos, np), eta = this.etaFunc(ant.pos, np)
                p[i] = Math.pow(tau, alpha) * Math.pow(eta, beta)
            }
        }
        const totalP = p.reduce((a, b) => a + b)
        const hasValid = valid.some((v) => v)
        console.log("Ant id = " + ant.id + " p = " + JSON.stringify(p))

        let dir = 0, dead = false
        if (!hasValid || ant.history.length > 25) {
            // Dead
            dead = true
        } else if (totalP === 0) {
            // Random
            do {
                dir = Math.floor(Math.random() * 6)
            } while (!valid[dir]);
        } else if (Math.random() < p0) {
            // Exploitation
            dir = p.indexOf(Math.max(...p))
        } else {
            // Exploration
            let rand = Math.random()
            const newP = p.map(p => p / totalP)
            for (; dir < 6; dir++) {
                if (rand < newP[dir] && valid[dir]) {
                    break;
                }
                rand -= newP[dir]
            }
        }

        // Move and check if dead or reached goal
        const [np, va] = this.nextPos(ant.pos, dir)
        let goal = false
        if (this.goalPos.equal(np)) {
            goal = true
        } else if (!va || this.isDeadPos(np)) {
            dead = true
        }
        console.log("Ant id = " + ant.id + " x = " + x + " y = " + y + " nx = " + np.x + " ny = " + np.y)

        // Apply local update
        const rho_local = 0.3, tau0 = 0.001
        if (!dead) {
            this.updatePheromone(ant.pos, np, rho_local, tau0)
            ant.pos = np
        }

        // Apply global update
        const rho_global = 0.5
        if (dead || goal) {
            console.log("Ant id = " + ant.id + (dead ? " dead" : " reached goal"))
            const Q = (dead ? -100 : 100) / ant.history.length
            for (let i = 0; i < ant.history.length - 1; i++) {
                this.updatePheromone(ant.history[i], ant.history[i + 1], rho_global, Q)
            }
            ant.remove()
            this.ants.splice(this.ants.findIndex(other => other === ant), 1)
        }
    }

    update() {
        this.ants.forEach(this.updateAnt.bind(this))
        this.trySpawnAnt()
        this.updateBlockColor()
    }
}


const stage = new Konva.Stage({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight
})

const colony = new AntColony(10, new Pos(1, 1), new Pos(8, 8), 5, () => false, 5, stage);

setInterval(() => {
    colony.update()
}, 1000)