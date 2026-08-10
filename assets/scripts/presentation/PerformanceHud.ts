import { director, Label, Node } from 'cc';

function countActiveNodes(root: Node): number {
  if (!root.activeInHierarchy) {
    return 0;
  }
  let count = 1;
  const children = root.children;
  for (let index = 0; index < children.length; index += 1) {
    count += countActiveNodes(children[index]);
  }
  return count;
}

export class PerformanceHud {
  private sampleSeconds = 0;
  private sampleFrames = 0;

  public constructor(
    private readonly label: Label,
    private readonly sceneRoot: Node,
    private readonly poolCapacity: number,
  ) {}

  public update(frameDeltaSeconds: number, poolUsed: number): void {
    this.sampleSeconds += frameDeltaSeconds;
    this.sampleFrames += 1;
    if (this.sampleSeconds < 0.5) {
      return;
    }

    const fps = this.sampleFrames / this.sampleSeconds;
    const averageMilliseconds = this.sampleSeconds * 1000 / this.sampleFrames;
    const drawCalls = director.root?.device.numDrawCalls ?? 0;
    const activeNodes = countActiveNodes(this.sceneRoot);
    this.label.string = [
      `FPS ${fps.toFixed(0)}  Frame ${averageMilliseconds.toFixed(2)}ms`,
      `Draw ${drawCalls}  Nodes ${activeNodes}`,
      `Chef Pool ${poolUsed}/${this.poolCapacity}`,
    ].join('\n');
    this.sampleSeconds = 0;
    this.sampleFrames = 0;
  }
}

