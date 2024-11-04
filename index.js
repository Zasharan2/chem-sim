var c = document.getElementById("mainCanvas");
var ctx = c.getContext("2d");

const canvasWidth = c.getBoundingClientRect().width;
const canvasHeight = c.getBoundingClientRect().height;

var keys = [];

document.addEventListener("keydown", function (event) {
    keys[event.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(event.key) > -1) {
        event.preventDefault();
    }
});

document.addEventListener("keyup", function (event) {
    keys[event.key] = false;
});

var mouseX, mouseY;

c.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

window.addEventListener("mousemove", function(event) {
    mouseX = event.clientX - c.getBoundingClientRect().left;
    mouseY = event.clientY - c.getBoundingClientRect().top;
});

var mouseDown, mouseButton;

window.addEventListener("mousedown", function(event) {
    mouseDown = true;
    mouseButton = event.buttons;
});

window.addEventListener("mouseup", function(event) {
    mouseDown = false;
});

const GAMESCREEN = {
    TITLE: 1,
    TITLE_TO_GAME: 1.2,
    TITLE_TO_SIMUL: 1.3,
    GAME: 2,
    SIMUL: 3,
}

var gameScreen = GAMESCREEN.TITLE;

function dist(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function distSegmentPoint(x1, y1, x2, y2, x3, y3) {
    var m12 = (y2 - y1) / (x2 - x1);
    var m12perp = -1 / m12;
    var xIntersect = ((y3 - (m12perp * x3)) - (y1 - (m12 * x1))) / (m12 - m12perp);
    var yIntersect = (m12 * xIntersect) + (y1 - (m12 * x1));
    if (Math.abs(xIntersect - x1) + Math.abs(x2 - xIntersect) == Math.abs(x1 - x2)) {
        // closest point is at xIntersect
        return dist(xIntersect, yIntersect, x3, y3);
    } else {
        // closest point is nearer to one side
        return Math.min(dist(x1, y1, x3, y3), dist(x2, y2, x3, y3));
    }
}

const atomRenderRadius = 5;

const dualElectronDistance = 3 / 16;

var selected;
var selectTimer;
var selectDelay = 40;

const atomHighlightEase = 4;
const bondUpdateEase = 10;
const buttonHighlightEase = 5;

const electronSelectRadius = 4;
const bondSelectRadius = 4;

const bondLengthScalingFactor = 5 / Math.log(1.8);
const bondLengthShift = 3;

var addAtomMenu = false;
var addAtomString = "";
var addAtomStringTimer = 0;
var addAtomStringDelay = 10;
var addAtomTimer = 0;
var addAtomDelay = 20;

function clampAngle(angle) {
    var tempAngle = angle;
    while(Math.abs(tempAngle) > Math.PI) {
        tempAngle -= 2 * Math.PI * Math.sign(tempAngle);
    }
    return tempAngle;
}

// angle1 - angle2
function smallestAngleDifference(angle1, angle2) {
    var a1 = angle1;
    var a2 = angle2;
    a1 = clampAngle(a1);
    a2 = clampAngle(a2);

    var ans = a1 - a2;
    ans = clampAngle(ans);

    return ans;
}

class BondGroup { 
    constructor(parentBonds) {
        this.parentBonds = parentBonds;
    }

    group() {
        // rearrange atoms so all e1s are on atom1
        var atom1 = this.parentBonds[0].electron1.parentAtom;
        for (var i = 1; i < this.parentBonds.length; i++) {
            if (this.parentBonds[i].electron1.parentAtom != atom1) {
                var a = this.parentBonds[i].electron1;
                this.parentBonds[i].electron1 = this.parentBonds[i].electron2;
                this.parentBonds[i].electron2 = a;
            }
        }

        // reexpress angles as unit vector components, sum
        var a1x = 0;
        var a1y = 0;
        var a2x = 0;
        var a2y = 0;
        for (var i = 0; i < this.parentBonds.length; i++) {
            a1x += Math.cos(this.parentBonds[i].electron1.angle);
            a1y += Math.sin(this.parentBonds[i].electron1.angle);
            a2x += Math.cos(this.parentBonds[i].electron2.angle);
            a2y += Math.sin(this.parentBonds[i].electron2.angle);
        }

        // find resultant (average) angle
        var a1 = clampAngle(Math.atan2(a1y, a1x));
        var a2 = clampAngle(Math.atan2(a2y, a2x));

        // set all electrons to that angle + offset
        for (var i = 0; i < this.parentBonds.length; i++) {
            this.parentBonds[i].electron1.angle += ((smallestAngleDifference(clampAngle(a1 + ((i - ((this.parentBonds.length - 1) / 2)) * 2 * dualElectronDistance)), clampAngle(this.parentBonds[i].electron1.angle))) / bondUpdateEase) * deltaTime;
            this.parentBonds[i].electron2.angle += ((smallestAngleDifference(clampAngle(a2 - ((i - ((this.parentBonds.length - 1) / 2)) * 2 * dualElectronDistance)), clampAngle(this.parentBonds[i].electron2.angle))) / bondUpdateEase) * deltaTime;
            // this.parentBonds[i].electron1.angle = clampAngle(a1 + ((i - ((this.parentBonds.length - 1) / 2)) * 2 * dualElectronDistance));
            // this.parentBonds[i].electron2.angle = clampAngle(a2 - ((i - ((this.parentBonds.length - 1) / 2)) * 2 * dualElectronDistance));
        }
    }

    hovering() {
        var any = false;
        for (var i = 0; i < this.parentBonds.length; i++) {
            any = any | this.parentBonds[i].hovering();
        }
        // console.log(any);
        return any;
    }

    update() {
        this.group();

        if (this.hovering() && mouseDown) {
            // newly selecting bondgroup
            if (!(selected instanceof Atom) && !(selected instanceof Bond) && !(selected instanceof BondGroup) && selectTimer > selectDelay) {
                selected = this;
                selectTimer = 0;
            }
            // prioritize bondgroup selection over bond selection
            if (selected instanceof Bond && this.parentBonds.includes(selected)) {
                selected = this;
                selectTimer = 0;
            }
            // already selected bond
            if (selected instanceof Bond && !this.parentBonds.includes(selected)) {
                this.parentBonds.push(selected);
                selected.bondGroupList.push(this);
                this.group();
                selected = null;
            }
        }
    }

    render() {
        // for (var i = 0; i < this.parentBonds; i++) {
        //     this.parentBonds[i].render();
        // }
    }
}

class Bond {
    constructor(electron1, electron2) {
        this.electron1 = electron1;
        this.electron2 = electron2;
        this.electron1.bondList.push(this);
        this.electron2.bondList.push(this);
        this.bondLength = dist(this.electron1.parentAtom.x, this.electron1.parentAtom.y, this.electron2.parentAtom.x, this.electron2.parentAtom.y);
        this.targetBondLength = bondLengthShift + bondLengthScalingFactor * Math.log(periodicTableInfo.elements[this.electron1.parentAtom.number].single_bond_length + periodicTableInfo.elements[this.electron2.parentAtom.number].single_bond_length);
        this.angle = Math.atan2(this.electron2.y - this.electron1.y, this.electron2.x - this.electron1.x);
        this.bondGroupList = [];
    }

    moveToBondLength() {
        // determine angle from e1 to e2
        this.angle = Math.atan2(this.electron2.y - this.electron1.y, this.electron2.x - this.electron1.x);

        // determine 1/15 of distance from e1 to e2 component wise
        var deltaX = ((this.targetBondLength - this.bondLength) * Math.cos(this.angle) / bondUpdateEase) * deltaTime;
        var deltaY = ((this.targetBondLength - this.bondLength) * Math.sin(this.angle) / bondUpdateEase) * deltaTime;

        // move atom 1 by dx, dy
        this.electron1.parentAtom.x -= deltaX / 2;
        this.electron1.parentAtom.y -= deltaY / 2;

        // move atom 2 by dx, dy
        this.electron2.parentAtom.x += deltaX / 2;
        this.electron2.parentAtom.y += deltaY / 2;

        // move atoms' electrons
        this.electron1.parentAtom.moveElectrons(-deltaX / 2, -deltaY / 2);

        // move atoms' electrons
        this.electron2.parentAtom.moveElectrons(deltaX / 2, deltaY / 2);

        // rotate atoms' electrons
        this.electron1.parentAtom.rotateElectrons((smallestAngleDifference(this.angle, this.electron1.angle) / bondUpdateEase) * deltaTime);
        this.electron2.parentAtom.rotateElectrons((smallestAngleDifference(this.angle + Math.PI, this.electron2.angle) / bondUpdateEase) * deltaTime);

        // calculate new bond length
        this.bondLength = dist(this.electron1.parentAtom.x, this.electron1.parentAtom.y, this.electron2.parentAtom.x, this.electron2.parentAtom.y);
    }

    hovering() {
        // x > e1.x - 2, x < e2.x + 2, y > e1.y - 2 + (mx), y < e1.y + 2 + (mx)
        if (distSegmentPoint(this.electron1.x, this.electron1.y, this.electron2.x, this.electron2.y, mouseX, mouseY) < bondSelectRadius) {
            return true;
        }
        return false;
    }

    update() {
        this.moveToBondLength();

        if (this.hovering() && mouseDown && this.bondGroupList.length == 0) {
            // if newly selecting bond
            if (!(selected instanceof Atom) && !(selected instanceof Bond) && !(selected instanceof BondGroup) && selectTimer > selectDelay) {
                selected = this;
                selectTimer = 0;
            }
            // if already selected other (lone) bond
            if (selected instanceof Bond && selected != this && (selected.bondGroupList.length == 0) && (this.bondGroupList.length == 0) && selectTimer > selectDelay) {
                // confirm double bond between two bonds between the same two atoms (and not like 2 bonds between 3 atoms or something)
                if ((selected.electron1.parentAtom == this.electron1.parentAtom && selected.electron2.parentAtom == this.electron2.parentAtom) || (selected.electron2.parentAtom == this.electron1.parentAtom && selected.electron1.parentAtom == this.electron2.parentAtom)) {
                    var newbondgroup = new BondGroup([selected, this])
                    this.bondGroupList.push(newbondgroup);
                    selected.bondGroupList.push(newbondgroup);
                    selected = null;
                }
            }
            // if already selected other bondgroup
            if (selected instanceof BondGroup && this.bondGroupList.length == 0) {
                selected.parentBonds.push(this);
                this.bondGroupList.push(selected);
                selected.group();
                selected = null;
            }
        }

        // delete bond
        if (this.hovering() && keys["Backspace"] && !(selected instanceof Atom)) {
            if (selectTimer > selectDelay) {
                // remove bond from electron lists, so it is never called again
                this.electron1.bondList.splice(this.electron1.bondList.indexOf(this), 1);
                this.electron2.bondList.splice(this.electron2.bondList.indexOf(this), 1);
                bondList.splice(bondList.indexOf(this), 1);
                selectTimer = 0;
            }
        }

        for (var i = 0; i < this.bondGroupList.length; i++) {
            this.bondGroupList[i].update();
        }
    }

    render() {
        // check conditions to render red
        var renderRed = false;
        if (this.bondGroupList.length != 0) {
            for (var i = 0; i < this.bondGroupList.length; i++) {
                if (this.bondGroupList[i].hovering()) {
                    renderRed = true;
                }
                if (this.bondGroupList[i] == selected) {
                    renderRed = true;
                }
            }
        }
        if (!addAtomMenu && this.hovering()) {
            renderRed = true;
        }
        if (selected == this) {
            renderRed = true;
        }

        if (renderRed) {
            // red background when select
            ctx.beginPath();
            ctx.strokeStyle = "#ff0000ff";
            ctx.lineWidth = 6;
            ctx.moveTo(this.electron1.x, this.electron1.y);
            ctx.lineTo(this.electron2.x, this.electron2.y);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.strokeStyle = "#ffff0080";
        ctx.lineWidth = 3;
        ctx.moveTo(this.electron1.x, this.electron1.y);
        ctx.lineTo(this.electron2.x, this.electron2.y);
        ctx.stroke();

        // for (var i = 0; i < this.bondGroupList.length; i++) {
        //     this.bondGroupList[i].render();
        // }
    }
}

class Electron {
    constructor(parentAtom, angle) {
        this.parentAtom = parentAtom;
        this.angle = angle;
        this.x = this.parentAtom.x;
        this.y = this.parentAtom.y;
        this.findPositionByAngle();

        this.bondList = [];
    }

    findPositionByAngle() {
        this.x = this.parentAtom.x + (4 * this.parentAtom.radius * Math.cos(this.angle));
        this.y = this.parentAtom.y + (4 * this.parentAtom.radius * Math.sin(this.angle));
    }

    checkSelect() {
        if (dist(mouseX, mouseY, this.x, this.y) < electronSelectRadius) {
            if (mouseDown && !(selected instanceof Atom)) {
                // if already selected another electron, and this not in a bond
                if (selected instanceof Electron && selected != this && this.bondList.length == 0) {
                    if (selectTimer > selectDelay) {
                        // ensure not two electrons from same atom bonding
                        if (selected.parentAtom != this.parentAtom) {
                            bondList.push(new Bond(selected, this));
                        }
                        selected = null;
                        selectTimer = 0;
                    }
                // if this not in a bond
                } else if (this.bondList.length == 0) {
                    if (selectTimer > selectDelay) {
                        selected = this;
                        selectTimer = 0;
                    }
                }
            }
        }
    }

    update() {
        this.checkSelect();

        for (var i = 0; i < this.bondList.length; i++) {
            this.bondList[i].update();
        }

        // clamp angles
        if (this.bondList.length > 0) {
            this.angle = clampAngle(this.angle);
        }
    }

    render() {
        if (!addAtomMenu && dist(mouseX, mouseY, this.x, this.y) < electronSelectRadius || selected == this) {
            // red selected background
            ctx.beginPath();
            ctx.fillStyle = "#ff0000ff";
            ctx.arc(this.x, this.y, 4, 0, 2*Math.PI);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = "#ffff00ff";
        ctx.arc(this.x, this.y, 2, 0, 2*Math.PI);
        ctx.fill();
    }
}

// add atoms to be removed to here, so they can all be removed at the end after rendering
var removeAtomList = [];

class Atom {
    constructor(x, y, num) {
        this.x = x;
        this.y = y;
        this.number = num - 1;
        this.name = periodicTableInfo.elements[this.number].name;
        this.symbol = periodicTableInfo.elements[this.number].symbol;
        this.valence = periodicTableInfo.elements[this.number].valence_electrons;
        this.orbitals = periodicTableInfo.elements[this.number].electron_configuration;
        this.radius = Math.log(periodicTableInfo.elements[this.number].radius);
        this.electronegativity = periodicTableInfo.elements[this.number].electronegativity;
        this.electronList = [];

        // render vars
        this.green = 0;
        this.blue = 255;

        this.generateElectrons();
    }

    checkSelect() {
        if (dist(mouseX, mouseY, this.x, this.y) < this.radius * atomRenderRadius * 0.5) {
            // set this atom selected if no other atom is selected
            if (mouseDown && !(selected instanceof Atom)) {
                if (selectTimer > selectDelay) {
                    selected = this;
                    selectTimer = 0;
                }
            }
            // remove selected if mouse let go
            if (this == selected && !mouseDown) {
                selected = null;
            }
            // delete atom when backspace
            if (keys["Backspace"]) {
                // remove atom
                removeAtomList.push(this);

                // remove bonds
                for (var i = 0; i < this.electronList.length; i++) {
                    for (var j = 0; j < this.electronList[i].bondList.length; j++) {
                        // remove from bondlist
                        bondList.splice(bondList.indexOf(this.electronList[i].bondList[j]), 1);

                        // determine which atom has been deleted already, and remove bond objects from bondlist of other atom's electrons
                        if (this.electronList[i].bondList[j].electron1.parentAtom == this) {
                            this.electronList[i].bondList[j].electron2.bondList.splice(this.electronList[i].bondList[j].electron2.bondList.indexOf(this.electronList[i].bondList[j]));
                        } else if (this.electronList[i].bondList[j].electron2.parentAtom == this) {
                            this.electronList[i].bondList[j].electron1.bondList.splice(this.electronList[i].bondList[j].electron1.bondList.indexOf(this.electronList[i].bondList[j]));
                        }
                    }
                }
            }
        }
    }

    updateRenderGradient() {
        if (!addAtomMenu && dist(mouseX, mouseY, this.x, this.y) < this.radius * atomRenderRadius) {
            this.green += ((100 - this.green) / atomHighlightEase) * deltaTime;
            this.blue += ((155 - this.blue) / atomHighlightEase) * deltaTime;
        } else {
            this.green += ((0 - this.green) / atomHighlightEase) * deltaTime;
            this.blue += ((255 - this.blue) / atomHighlightEase) * deltaTime;
        }
        this.grd = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, this.radius * atomRenderRadius);
        this.grd.addColorStop(0, "rgba(0, " + Math.floor(this.green) + ", " + Math.floor(this.blue) + ", 255)");
        this.grd.addColorStop(1, "rgba(0, " + Math.floor(this.green) + ", " + Math.floor(this.blue) + ", 0)");
    }

    generateElectrons() {
        this.electronList = [];
        if (this.orbitals.slice(-2, -1) == "s") {
            for (var i = 0; i < this.valence; i++) {
                this.electronList.push(new Electron(this, i * Math.PI));
            }
        } else if (this.orbitals.slice(-2, -1) == "p") {
            for (var i = 0; i < this.valence; i++) {
                if (i <= (this.valence - 1) - 4) {
                    this.electronList.push(new Electron(this, (i - dualElectronDistance) * 0.5 * Math.PI));
                } else if (i >= 4) {
                    this.electronList.push(new Electron(this, (i + dualElectronDistance) * 0.5 * Math.PI));
                } else {
                    this.electronList.push(new Electron(this, i * 0.5 * Math.PI));
                }
            }
        } else if (this.orbitals.slice(-2, -1) == "d" || this.orbitals.slice(-3, -2) == "d") {
            // work on later
            for (var i = 0; i < this.valence; i++) {
                if (i <= (this.valence - 1) - 4) {
                    this.electronList.push(new Electron(this, (i - dualElectronDistance) * 0.5 * Math.PI));
                } else if (i >= 4) {
                    this.electronList.push(new Electron(this, (i + dualElectronDistance) * 0.5 * Math.PI));
                } else {
                    this.electronList.push(new Electron(this, i * 0.5 * Math.PI));
                }
            }
        }
    }

    moveElectrons(deltaX, deltaY) {
        // move each electron by dx, dy
        for (var i = 0; i < this.electronList.length; i++) {
            this.electronList[i].x += deltaX;
            this.electronList[i].y += deltaY;
        }
    }

    rotateElectrons(deltaAngle) {
        // rotate each electron by dangle
        for (var i = 0; i < this.electronList.length; i++) {
            this.electronList[i].angle += deltaAngle;
            this.electronList[i].findPositionByAngle();
        }
    }

    update() {
        // check select
        this.checkSelect();

        // electron update
        for (var i = 0; i < this.electronList.length; i++) {
            this.electronList[i].update();
        }

        // rotation
        if (this == selected) {
            if (keys["ArrowLeft"]) {
                this.rotateElectrons(-0.1 * deltaTime);
            }
            if (keys["ArrowRight"]) {
                this.rotateElectrons(0.1 * deltaTime);
            }
        }

        // atomic repulsion
        for (var i = 0; i < atomList.length; i++) {
            if (atomList[i] != this) {
                // e^(-x^2)
                var expDistDropoff = Math.exp(-Math.pow(0.1 * (dist(this.x, this.y, atomList[i].x, atomList[i].y)), 2));

                // dx & dy push away from atom i * exp dropoff
                var deltaX = (this.x - atomList[i].x) * expDistDropoff * deltaTime;
                var deltaY = (this.y - atomList[i].y) * expDistDropoff * deltaTime;

                // move
                this.x += deltaX;
                this.y += deltaY;
                this.moveElectrons(deltaX, deltaY);
            }
        }
    }

    render() {
        this.updateRenderGradient();

        // gradient centre
        ctx.beginPath();
        ctx.fillStyle = this.grd;
        ctx.arc(this.x, this.y, this.radius * atomRenderRadius, 0, 2*Math.PI);
        ctx.fill();

        // text
        ctx.beginPath();
        ctx.fillStyle = "#ffffffff";
        ctx.font = "15px Comic Sans MS";
        ctx.fillText(this.symbol, this.x + (-0.5 * ctx.measureText(this.symbol).width), this.y + 5);

        // electrons
        for (var i = 0; i < this.electronList.length; i++) {
            this.electronList[i].render();
        }
    }
}

var atomList = [];
var bondList = [];

var titlePlayButtonOpacity = 0.5;
var titleSimulButtonOpacity = 0.5;

function main() {
    switch(gameScreen) {
        case GAMESCREEN.TITLE: {
            // background
            ctx.beginPath();
            ctx.fillStyle = "#000022ff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // title
            ctx.beginPath();
            ctx.fillStyle = "#ffffffff";
            ctx.font = "70px Comic Sans MS";
            ctx.fillText("Chemistry Simulation", 60, 90);

            // // play button
            // ctx.beginPath();
            // if (mouseX > 340 && mouseX < 460 && mouseY > 140 && mouseY < 200) {
            //     titlePlayButtonOpacity += ((1 - titlePlayButtonOpacity) / buttonHighlightEase) * deltaTime
            //     if (mouseDown) {
            //         gameScreen = GAMESCREEN.TITLE_TO_GAME;
            //     }
            // } else {
            //     titlePlayButtonOpacity += ((0.5 - titlePlayButtonOpacity) / buttonHighlightEase) * deltaTime
            // }
            // ctx.fillStyle = "rgba(0, 0, 255, " + titlePlayButtonOpacity + ")";
            // ctx.roundRect(340, 140, 120, 60, 20);
            // ctx.fill();
            // ctx.beginPath()
            // ctx.font = "30px Comic Sans MS";
            // ctx.fillStyle = "#ffffffff";
            // ctx.fillText("PLAY", 362, 181);

            // simulation button
            ctx.beginPath();
            if (mouseX > 280 && mouseX < 530 && mouseY > 220 && mouseY < 280) {
                titleSimulButtonOpacity += ((1 - titleSimulButtonOpacity) / buttonHighlightEase) * deltaTime
                if (mouseDown) {
                    gameScreen = GAMESCREEN.TITLE_TO_SIMUL;
                }
            } else {
                titleSimulButtonOpacity += ((0.5 - titleSimulButtonOpacity) / buttonHighlightEase) * deltaTime
            }
            ctx.fillStyle = "rgba(0, 0, 255, " + titleSimulButtonOpacity + ")";
            ctx.roundRect(280, 220, 250, 60, 20);
            ctx.fill();
            ctx.beginPath()
            ctx.font = "30px Comic Sans MS";
            ctx.fillStyle = "#ffffffff";
            ctx.fillText("SIMULATION", 302, 261);
            break;
        }
        case GAMESCREEN.TITLE_TO_GAME: {
            atomList = [];
            atomList.push(new Atom(40, 40, 1), new Atom(760, 40, 2), new Atom(40, 100, 3), new Atom(100, 100, 4), new Atom(460, 100, 5), new Atom(520, 100, 6), new Atom(580, 100, 7), new Atom(640, 100, 8), new Atom(700, 100, 9), new Atom(760, 100, 10), new Atom(40, 160, 11), new Atom(100, 160, 12), new Atom(460, 160, 13), new Atom(520, 160, 14), new Atom(580, 160, 15), new Atom(640, 160, 16), new Atom(700, 160, 17), new Atom(760, 160, 18), new Atom(40, 220, 19), new Atom(100, 220, 20));
            atomList.push(new Atom(40, 340, 1), new Atom(100, 340, 1), new Atom(160, 340, 1), new Atom(40, 400, 8), new Atom(100, 400, 8), new Atom(160, 400, 8));

            addAtomTimer = 0;
            selectTimer = 0;

            gameScreen = GAMESCREEN.GAME;
            break;
        }
        case GAMESCREEN.TITLE_TO_SIMUL: {
            atomList = [];

            addAtomTimer = 0;
            selectTimer = 0;

            gameScreen = GAMESCREEN.SIMUL;
            break;
        }
        case GAMESCREEN.GAME: {
            ctx.fillStyle = "#000022ff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            runSimulation();
            break;
        }
        case GAMESCREEN.SIMUL: {
            ctx.fillStyle = "#000022ff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            runSimulation();
            break;
        }
        default: {
            break;
        }
    }
}

function runSimulation() {
    addAtomTimer += deltaTime;
    addAtomStringTimer += deltaTime;
    selectTimer += deltaTime;

    // render & update atoms
    for (var i = 0; i < atomList.length; i++) {
        atomList[i].render();
        if (!addAtomMenu) {
            atomList[i].update();
        }
    }

    // remove atoms
    for (var i = 0; i < removeAtomList.length; i++) {
        atomList.splice(atomList.indexOf(removeAtomList[i]), 1);
    }
    removeAtomList = [];

    if (selected instanceof Atom) {
        selected.moveElectrons(mouseX - selected.x, mouseY - selected.y);
        selected.x = mouseX;
        selected.y = mouseY;
    }

    for (var i = 0; i < bondList.length; i++) {
        bondList[i].render();
        // if (!addAtomMenu) {
        //     bondList[i].update();
        // }
    }

    if (addAtomTimer > addAtomDelay && keys[" "]) {
        if (addAtomMenu) {

        } else {
            addAtomStringTimer = 0;
            addAtomString = "";
        }
        addAtomMenu = !addAtomMenu;
        addAtomTimer = 0;
    }

    if (addAtomMenu) {
        displayAddAtomMenu();
    }
}

function displayAddAtomMenu() {
    ctx.beginPath();
    ctx.fillStyle = "#00008080";
    ctx.roundRect(150, 80, 500, 340, 50);
    ctx.fill();

    ctx.fillStyle = "#ffffffff";
    ctx.font = "30px Comic Sans MS"
    ctx.fillText("Add atom #:", 180, 140);

    ctx.fillStyle = "#ffffffff";
    ctx.font = "30px Comic Sans MS"
    ctx.fillText(addAtomString, 180, 200);

    for (var i = 0; i <= 9; i++) {
        // check numkey press
        if (keys[i.toString()] && addAtomStringTimer > addAtomStringDelay) {
            addAtomString += i.toString();
            addAtomStringTimer = 0;
        }
    }

    // check backspace press
    if (keys["Backspace"] && addAtomStringTimer > addAtomStringDelay) {
        addAtomString = addAtomString.substring(0, addAtomString.length - 1);
        addAtomStringTimer = 0;
    }

    // cap length
    if (addAtomString.length > 24) {
        addAtomString = addAtomString.substring(0, 24);
    }

    // render atom & name
    if (addAtomString.length > 0 && Number(addAtomString) != 0 && Number(addAtomString) <= periodicTableInfo.elements.length) {
        ctx.fillStyle = "#ffffffff";
        ctx.font = "20px Comic Sans MS"
        var elemName = periodicTableInfo.elements[Number(addAtomString) - 1].name
        ctx.fillText(elemName, 400 + (-0.5 * ctx.measureText(elemName).width), 250);
        (new Atom(400, 300, Number(addAtomString))).render()
    }

    // check length and validity
    if (keys["Enter"] && addAtomString.length > 0 && Number(addAtomString) != 0 && Number(addAtomString) <= periodicTableInfo.elements.length) {
        addAtomMenu = !addAtomMenu;
        atomList.push(new Atom(mouseX, mouseY, Number(addAtomString)));
        addAtomTimer = 0;
    // if invalid, reset string
    } else if (keys["Enter"] && addAtomString.length > 0 && (Number(addAtomString) == 0 || Number(addAtomString) > periodicTableInfo.elements.length)) {
        addAtomString = "";
    }
}

function init() {
    window.requestAnimationFrame(loop);
}

var deltaTime = 0;
var deltaCorrect = (1 / 16);
var prevTime = Date.now();
function loop() {
    deltaTime = (Date.now() - prevTime) * deltaCorrect;
    prevTime = Date.now();

    main();
    window.requestAnimationFrame(loop);
}

var periodicTableInfo = {
    elements: [
        {
            name: "Hydrogen",
            symbol: "H",
            number: 1,
            radius: 53,
            valence_electrons: 1,
            electron_configuration: "1s1",
            electronegativity: 2.2,
            single_bond_length: 31
        },
        {
            name: "Helium",
            symbol: "He",
            number: 2,
            radius: 31,
            valence_electrons: 2,
            electron_configuration: "1s2",
            electronegativity: null,
            single_bond_length: null
        },
        {
            name: "Lithium",
            symbol: "Li",
            number: 3,
            radius: 167,
            valence_electrons: 1,
            electron_configuration: "1s2 2s1",
            electronegativity: 0.98,
            single_bond_length: 128
        },
        {
            name: "Beryllium",
            symbol: "Be",
            number: 4,
            radius: 112,
            valence_electrons: 2,
            electron_configuration: "1s2 2s2",
            electronegativity: 1.57,
            single_bond_length: 96
        },
        {
            name: "Boron",
            symbol: "B",
            number: 5,
            radius: 87,
            valence_electrons: 3,
            electron_configuration: "1s2 2s2 2p1",
            electronegativity: 2.04,
            single_bond_length: 84
        },
        {
            name: "Carbon",
            symbol: "C",
            number: 6,
            radius: 67,
            valence_electrons: 4,
            electron_configuration: "1s2 2s2 2p2",
            electronegativity: 2.55,
            single_bond_length: 76
        },
        {
            name: "Nitrogen",
            symbol: "N",
            number: 7,
            radius: 56,
            valence_electrons: 5,
            electron_configuration: "1s2 2s2 2p3",
            electronegativity: 3.04,
            single_bond_length: 71
        },
        {
            name: "Oxygen",
            symbol: "O",
            number: 8,
            radius: 48,
            valence_electrons: 6,
            electron_configuration: "1s2 2s2 2p4",
            electronegativity: 3.44,
            single_bond_length: 66
        },
        {
            name: "Fluorine",
            symbol: "F",
            number: 9,
            radius: 42,
            valence_electrons: 7,
            electron_configuration: "1s2 2s2 2p5",
            electronegativity: 3.98,
            single_bond_length: 57
        },
        {
            name: "Neon",
            symbol: "Ne",
            number: 10,
            radius: 38,
            valence_electrons: 8,
            electron_configuration: "1s2 2s2 2p6",
            electronegativity: null,
            single_bond_length: null
        },
        {
            name: "Sodium",
            symbol: "Na",
            number: 11,
            radius: 190,
            valence_electrons: 1,
            electron_configuration: "1s2 2s2 2p6 3s1",
            electronegativity: 0.93,
            single_bond_length: 166
        },
        {
            name: "Magnesium",
            symbol: "Mg",
            number: 12,
            radius: 145,
            valence_electrons: 2,
            electron_configuration: "1s2 2s2 2p6 3s2",
            electronegativity: 1.31,
            single_bond_length: 141
        },
        {
            name: "Aluminum",
            symbol: "Al",
            number: 13,
            radius: 118,
            valence_electrons: 3,
            electron_configuration: "1s2 2s2 2p6 3s2 3p1",
            electronegativity: 1.61,
            single_bond_length: 121
        },
        {
            name: "Silicon",
            symbol: "Si",
            number: 14,
            radius: 111,
            valence_electrons: 4,
            electron_configuration: "1s2 2s2 2p6 3s2 3p2",
            electronegativity: 1.9,
            single_bond_length: 111
        },
        {
            name: "Phosphorus",
            symbol: "P",
            number: 15,
            radius: 98,
            valence_electrons: 5,
            electron_configuration: "1s2 2s2 2p6 3s2 3p3",
            electronegativity: 2.19,
            single_bond_length: 107
        },
        {
            name: "Sulfur",
            symbol: "S",
            number: 16,
            radius: 88,
            valence_electrons: 6,
            electron_configuration: "1s2 2s2 2p6 3s2 3p4",
            electronegativity: 2.58,
            single_bond_length: 105
        },
        {
            name: "Chlorine",
            symbol: "Cl",
            number: 17,
            radius: 79,
            valence_electrons: 7,
            electron_configuration: "1s2 2s2 2p6 3s2 3p5",
            electronegativity: 3.16,
            single_bond_length: 102
        },
        {
            name: "Argon",
            symbol: "Ar",
            number: 18,
            radius: 71,
            valence_electrons: 8,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6",
            electronegativity: null,
            single_bond_length: null
        },
        {
            name: "Potassium",
            symbol: "K",
            number: 19,
            radius: 243,
            valence_electrons: 1,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s1",
            electronegativity: 0.82,
            single_bond_length: 203
        },
        {
            name: "Calcium",
            symbol: "Ca",
            number: 20,
            radius: 194,
            valence_electrons: 2,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2",
            electronegativity: 1,
            single_bond_length: 176
        },
        {
            name: "Scandium",
            symbol: "Sc",
            number: 21,
            radius: 184,
            valence_electrons: 3,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d1",
            electronegativity: 1.36,
            single_bond_length: 170
        },
        {
            name: "Titanium",
            symbol: "Ti",
            number: 22,
            radius: 176,
            valence_electrons: 4,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d2",
            electronegativity: 1.54,
            single_bond_length: 160
        },
        {
            name: "Vanadium",
            symbol: "V",
            number: 23,
            radius: 171,
            valence_electrons: 5,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d3",
            electronegativity: 1.63,
            single_bond_length: 153
        },
        {
            name: "Chromium",
            symbol: "Cr",
            number: 24,
            radius: 166,
            valence_electrons: 6,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d4",
            electronegativity: 1.66,
            single_bond_length: 139
        },
        {
            name: "Manganese",
            symbol: "Mn",
            number: 25,
            radius: 161,
            valence_electrons: 7,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d5",
            electronegativity: 1.55,
            single_bond_length: 150
        },
        {
            name: "Iron",
            symbol: "Fe",
            number: 26,
            radius: 156,
            valence_electrons: 8,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d6",
            electronegativity: 1.83,
            single_bond_length: 142
        },
        {
            name: "Cobalt",
            symbol: "Co",
            number: 27,
            radius: 152,
            valence_electrons: 9,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d7",
            electronegativity: 1.88,
            single_bond_length: 138
        },
        {
            name: "Nickel",
            symbol: "Ni",
            number: 28,
            radius: 149,
            valence_electrons: 10,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d8",
            electronegativity: 1.91,
            single_bond_length: 124
        },
        {
            name: "Copper",
            symbol: "Cu",
            number: 29,
            radius: 145,
            valence_electrons: 11,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d9",
            electronegativity: 1.90,
            single_bond_length: 132
        },
        {
            name: "Zinc",
            symbol: "Zn",
            number: 30,
            radius: 142,
            valence_electrons: 12,
            electron_configuration: "1s2 2s2 2p6 3s2 3p6 4s2 3d10",
            electronegativity: 1.65,
            single_bond_length: 122
        },
    ]
}

window.requestAnimationFrame(init);