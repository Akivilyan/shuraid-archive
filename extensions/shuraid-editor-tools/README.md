# ShuRaid Editor Tools

Project-local Cocos Creator 3.8 editor automation.

The extension creates native Cocos assets at editor time. It does not assemble the runtime scene tree from gameplay code.

Current generator:

- `ShuRaid -> Generate GuanYu Stage 1`
- runs only when explicitly selected while the target scene is already open;
- never opens, switches, or saves an unnamed scene during project startup;
- creates four AnimationClip assets from imported SpriteFrames;
- creates `GuanYu.prefab` with stable root/visual hierarchy;
- places one prefab instance under the Bootstrap Canvas;
- saves the current scene after generation completes.
