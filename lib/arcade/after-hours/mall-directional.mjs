import {SKATE_CLIPS,skateFrameScale} from './mall-animation.mjs';

const actionRow={
 [SKATE_CLIPS.crouch]:1,
 [SKATE_CLIPS.ollie]:2,
 [SKATE_CLIPS.flip]:2,
 [SKATE_CLIPS.grab]:3,
 [SKATE_CLIPS.grind]:4,
};
// Facing chooses the view; the underlying action still chooses its pose.
// Scale against that view's coast, so a tuck stays shorter than standing.
export function resolveSkateFrame(base,directional,pose){
 if(pose.frame<SKATE_CLIPS.left||!directional)return {sheet:base,frame:base.frames[pose.frame],scale:skateFrameScale(base,pose.frame),directional:false};
 const view=pose.frame-SKATE_CLIPS.left,row=actionRow[pose.rearFrame]||0;
 return {sheet:directional,frame:directional.frames[row*3+view],scale:3.15/directional.frames[view].height,directional:true};
}
