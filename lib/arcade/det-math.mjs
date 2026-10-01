/** Trigonometry that gives bit-identical results in every JavaScript engine.
 *
 * The language leaves Math.sin, Math.cos, Math.atan2 and Math.hypot to each engine, and
 * V8 (the arcade server, Chrome) and JavaScriptCore (every iPhone browser) differ in the
 * last bits. Over thousands of physics ticks that grows into a different race, so a
 * phone's run would not verify on the server. These use only + - * /, Math.sqrt and
 * Math.round, which the language requires to be exact, so every engine agrees.
 * Accuracy is about 1e-13: far below anything visible, and identical everywhere. */
const HALF_PI=1.5707963267948966,PI=3.141592653589793,SIXTH_PI=0.5235987755982988,SQRT3=1.7320508075688772,TAN_TWELFTH_PI=0.2679491924311227;
// Taylor series on |x| <= pi/4; coefficients are exact reciprocals evaluated once.
const S3=-1/6,S5=1/120,S7=-1/5040,S9=1/362880,S11=-1/39916800,S13=1/6227020800;
const C2=-1/2,C4=1/24,C6=-1/720,C8=1/40320,C10=-1/3628800,C12=1/479001600,C14=-1/87178291200;
const sinCore=x=>{const x2=x*x;return x+x*x2*(S3+x2*(S5+x2*(S7+x2*(S9+x2*(S11+x2*S13)))));};
const cosCore=x=>{const x2=x*x;return 1+x2*(C2+x2*(C4+x2*(C6+x2*(C8+x2*(C10+x2*(C12+x2*C14))))));};
function quadrant(x){const k=Math.round(x/HALF_PI);return {r:x-k*HALF_PI,q:((k%4)+4)%4};}
export function sin(x){const {r,q}=quadrant(x);return q===0?sinCore(r):q===1?cosCore(r):q===2?-sinCore(r):-cosCore(r);}
export function cos(x){const {r,q}=quadrant(x);return q===0?cosCore(r):q===1?-sinCore(r):q===2?-cosCore(r):sinCore(r);}
/** atan on [0, tan(pi/12)] by series; wider arguments are reduced exactly first. */
function atanSmall(t){
  const t2=t*t;let term=t,sum=t;
  for(let n=3;n<=23;n+=2){term*=-t2;sum+=term/n;}
  return sum;
}
export function atan(x){
  if(x!==x)return x;
  if(x<0)return -atan(-x);
  if(x>1)return HALF_PI-atan(1/x);
  return x>TAN_TWELFTH_PI?SIXTH_PI+atanSmall((x*SQRT3-1)/(x+SQRT3)):atanSmall(x);
}
export function atan2(y,x){
  if(x>0)return atan(y/x);
  if(x<0)return y>=0?atan(y/x)+PI:atan(y/x)-PI;
  return y>0?HALF_PI:y<0?-HALF_PI:0;
}
export const hypot=(a,b)=>Math.sqrt(a*a+b*b);
export const DET_MATH=Object.freeze({sin,cos,atan2,hypot});
