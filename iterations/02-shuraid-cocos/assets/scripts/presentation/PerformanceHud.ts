import { director, Label, Node } from 'cc';

const SAMPLE_INTERVAL_SECONDS = 1;
const FRAME_BUCKET_MILLISECONDS = 0.5;
const FRAME_BUCKET_COUNT = 201;

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
  private readonly frameBuckets = new Uint16Array(FRAME_BUCKET_COUNT);
  private sampleSeconds = 0;
  private sampleFrames = 0;
  private peakMilliseconds = 0;

  public constructor(
    private readonly label: Label,
    private readonly sceneRoot: Node,
    private readonly poolCapacity: number,
  ) {}

  public update(frameDeltaSeconds: number, poolUsed: number): void {
    this.sampleSeconds += frameDeltaSeconds;
    this.sampleFrames += 1;
    const frameMilliseconds = frameDeltaSeconds * 1000;
    const bucketIndex = Math.min(
      FRAME_BUCKET_COUNT - 1,
      Math.floor(frameMilliseconds / FRAME_BUCKET_MILLISECONDS),
    );
    this.frameBuckets[bucketIndex] += 1;
    this.peakMilliseconds = Math.max(this.peakMilliseconds, frameMilliseconds);

    if (this.sampleSeconds < SAMPLE_INTERVAL_SECONDS) {
      return;
    }

    const fps = this.sampleFrames / this.sampleSeconds;
    const averageMilliseconds = this.sampleSeconds * 1000 / this.sampleFrames;
    const p95Milliseconds = this.resolvePercentileMilliseconds(0.95);
    const drawCalls = director.root?.device.numDrawCalls ?? 0;
    const activeNodes = countActiveNodes(this.sceneRoot);
    this.label.string = [
      `FPS ${fps.toFixed(0)}  Avg ${averageMilliseconds.toFixed(2)}ms  P95 ${p95Milliseconds.toFixed(1)}ms`,
      `Max ${this.peakMilliseconds.toFixed(1)}ms  Draw ${drawCalls}  Nodes ${activeNodes}`,
      `Chef Pool ${poolUsed}/${this.poolCapacity}`,
    ].join('\n');
    this.sampleSeconds = 0;
    this.sampleFrames = 0;
    this.peakMilliseconds = 0;
    this.frameBuckets.fill(0);
  }

  private resolvePercentileMilliseconds(percentile: number): number {
    const targetFrame = Math.ceil(this.sampleFrames * percentile);
    let accumulatedFrames = 0;
    for (let index = 0; index < this.frameBuckets.length; index += 1) {
      accumulatedFrames += this.frameBuckets[index];
      if (accumulatedFrames >= targetFrame) {
        return (index + 0.5) * FRAME_BUCKET_MILLISECONDS;
      }
    }
    return (FRAME_BUCKET_COUNT - 0.5) * FRAME_BUCKET_MILLISECONDS;
  }
}
