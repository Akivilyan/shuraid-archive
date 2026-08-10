export function isPointInSector(
  originX: number,
  originY: number,
  facingX: number,
  facingY: number,
  pointX: number,
  pointY: number,
  radius: number,
  halfAngle: number,
): boolean {
  const offsetX = pointX - originX;
  const offsetY = pointY - originY;
  const distanceSquared = offsetX * offsetX + offsetY * offsetY;
  if (distanceSquared > radius * radius) {
    return false;
  }
  if (distanceSquared <= 0.0001) {
    return true;
  }
  const inverseDistance = 1 / Math.sqrt(distanceSquared);
  const facingDot = (offsetX * facingX + offsetY * facingY) * inverseDistance;
  return facingDot >= Math.cos(halfAngle);
}

