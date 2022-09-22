import {Application, Sprite, Texture, Graphics, Text} from 'pixi.js';
import '@pixi/graphics-extras';
import {stringify} from "querystring-es3";

function multiArray(dim, len, val = 0) {
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

function arrayEqual(a1, a2) {
    if (a1 === null && a2 === null) return true
    if (a1 === null || a2 === null) return false
    if (a1.length !== a2.length) return false
    for (let i = 0; i < a1.length; i++) if (a1[i] !== a2[i]) return false
    return true
}

class Ant {
    constructor(x, y, id) {
        this.x = x
        this.y = y
        this.id = id
        this.history = []
    }

    lastPos() {
        if (this.history.length === 0) {
            return [-1, -1]
        } else {
            return this.history[this.history.length - 1]
        }
    }
}

class AntColony {
    constructor(mapLen, startX, startY, goalX, goalY, maxAnt, isDeadPos) {
        this.mapLen = mapLen
        this.startX = startX
        this.startY = startY
        this.goalX = goalX
        this.goalY = goalY
        this.maxAnt = maxAnt
        this.isDeadPos = isDeadPos
        this.ants = []
        this.spawnCounter = 0
        this.pheromone = multiArray(4, mapLen, 0.10)
        this.maxPheromone = 0
        this.totalAnd = 0
    }

    trySpawnAnt() {
        this.spawnCounter = Math.max(this.spawnCounter - 1, 0)
        if (this.spawnCounter === 0 && this.ants.length < this.maxAnt) {
            this.ants.push(new Ant(this.startX, this.startY, this.totalAnd))
            this.totalAnd += 1
            this.spawnCounter = 5
        }
    }

    tauFunc(x1, y1, x2, y2) {
        return this.pheromone[x1][y1][x2][y2]
    }

    euclideanDistance(x1, y1, x2, y2) {
        return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
    }

    distanceToGoal(x, y) {
        return this.euclideanDistance(x, y, this.goalX, this.goalY)
    }

    etaFunc(x1, y1, x2, y2) {
        const d1 = this.distanceToGoal(x1, y1), d2 = this.distanceToGoal(x2, y2)
        if (d2 === 0) {
            return 1000000
        } else {
            return 1 / d2
        }
    }

    updatePheromone(x1, y1, x2, y2, rho, delta) {
        const newPheromone = (1 - rho) * this.pheromone[x1][y1][x2][y2] + delta
        this.pheromone[x1][y1][x2][y2] = Math.max(0, newPheromone)
        this.maxPheromone = Math.max(this.maxPheromone, newPheromone)
    }

    updateAnt(ant) {
        // Choose Direction
        const alpha = 1, beta = 3, p0 = 0.4

        const dx = [1, -1, 0, 0, 1, -1], dy = (ant.x % 2 === 0) ? [0, 0, 1, -1, -1, -1] : [0, 0, 1, -1, 1, 1]
        const p = [0, 0, 0, 0, 0, 0], valid = Array(6)
        const x = ant.x, y = ant.y

        for (let i = 0; i < 6; i++) {
            const nx = x + dx[i], ny = y + dy[i]
            if (nx < 0 || nx >= this.mapLen || ny < 0 || ny >= this.mapLen || arrayEqual(ant.lastPos(), [nx, ny])) {
                valid[i] = false
            } else {
                valid[i] = true
                const tau = this.tauFunc(x, y, nx, ny), eta = this.etaFunc(x, y, nx, ny)
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
        const nx = x + dx[dir], ny = y + dy[dir]
        let goal = false
        if (nx === this.goalX && ny === this.goalY) {
            goal = true
        } else if (this.isDeadPos([nx, ny])) {
            dead = true
        }
        console.log("Ant id = " + ant.id + " x = " + x + " y = " + y + " nx = " + nx + " ny = " + ny)

        // Apply local update
        const rho_local = 0.3, tau0 = 0.001
        if (!dead) {
            ant.x = nx
            ant.y = ny
            ant.history.push([x, y])
            this.updatePheromone(x, y, nx, ny, rho_local, tau0)
        }

        // Apply global update
        const rho_global = 0.5
        if (dead || goal) {
            console.log("Ant id = " + ant.id + (dead ? " dead" : " reached goal"))
            const Q = (dead ? -100 : 100) / ant.history.length
            for (let i = 0; i < ant.history.length - 1; i++) {
                const [x1, y1] = ant.history[i], [x2, y2] = ant.history[i + 1]
                this.updatePheromone(x1, y1, x2, y2, rho_global, Q)
            }
            this.ants.splice(this.ants.findIndex(other => other === ant), 1)
        }
    }

    update() {
        this.ants.forEach(this.updateAnt.bind(this))
        this.trySpawnAnt()
    }
}

async function game() {
    const len = 10;

    const antColony = new AntColony(len, 1, 1, len - 2, len - 2, 5, (pos) => pos[0] >= 4 && pos[0] <= 6 && pos[1] >= 4 && pos[1] <= 6)
    antColony.update()

    const app = new Application({
        backgroundColor: 0xffffff, antialias: true
    });
    document.body.appendChild(app.view);

    let texts = []
    const render = function () {
        if (app.stage.children.length !== 0) {
            app.stage.removeChildAt(0)
            app.stage.removeChild(...texts)
            texts = []
        }

        const r = 30;
        const dr = Math.sqrt(3) * 0.5 * r;
        const obj = new Graphics();

        obj.lineStyle({width: 1})
        for (let x = 0; x < len; x++) {
            for (let y = 0; y < len; y++) {
                const p = (x + y + 2) / (2 * len)
                const deadPos = antColony.isDeadPos([x, y])
                obj.beginFill(deadPos ? 0x000000 : 0xa4f5e3)
                    .drawRegularPolygon(40 + x * 1.5 * r, 40 + 2 * dr * y + (x % 2 === 1 ? dr : 0), r, 6, Math.PI / 2)
                    .endFill()
            }
        }

        obj.beginFill(0xff2020)
        antColony.ants.forEach(ant => {
            const x = 40 + ant.x * 1.5 * r, y = 40 + 2 * dr * ant.y + (ant.x % 2 === 1 ? dr : 0)
            obj.drawCircle(x, y, r / 3)
            const text = new Text(String(ant.id))
            text.x = x
            text.y = y
            texts.push(text)
        })
        obj.endFill()

        app.stage.addChild(obj);
        app.stage.addChild(...texts);
    }
    render()

    let lastMs = 0
    app.ticker.add(() => {
        lastMs += app.ticker.deltaMS
        if (lastMs > 500) {
            lastMs = 0
            antColony.update()
            render()
        }
    })
}

game()