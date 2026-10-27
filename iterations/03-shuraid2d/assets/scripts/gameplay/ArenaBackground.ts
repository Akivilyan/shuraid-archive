import {
    _decorator,
    Color,
    Component,
    Graphics,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ArenaBackground')
export class ArenaBackground extends Component {
    @property({ type: Graphics })
    public graphics: Graphics | null = null;

    @property
    public width = 4000;

    @property
    public height = 3000;

    @property
    public gridSize = 80;

    protected onLoad(): void {
        if (!this.graphics) {
            throw new Error('ArenaBackground requires a Graphics reference.');
        }
        this.draw();
    }

    private draw(): void {
        const graphics = this.graphics!;
        const left = -this.width * 0.5;
        const right = this.width * 0.5;
        const bottom = -this.height * 0.5;
        const top = this.height * 0.5;
        graphics.clear();
        graphics.fillColor = new Color(44, 35, 30, 255);
        graphics.rect(left, bottom, this.width, this.height);
        graphics.fill();
        graphics.strokeColor = new Color(111, 82, 54, 90);
        graphics.lineWidth = 2;
        for (let x = left; x <= right; x += this.gridSize) {
            graphics.moveTo(x, bottom);
            graphics.lineTo(x, top);
        }
        for (let y = bottom; y <= top; y += this.gridSize) {
            graphics.moveTo(left, y);
            graphics.lineTo(right, y);
        }
        graphics.stroke();
    }
}
