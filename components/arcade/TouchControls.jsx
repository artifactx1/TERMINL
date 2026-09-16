import { useEffect, useRef, useState } from 'react';
import { directionMask, touchMask, raceSteeringTarget } from '../../lib/arcade/touch-input.mjs';
import s from '../../styles/TouchControls.module.css';

const RACE_ACTIONS = [[8, 'BRAKE / REV', 'brake'], [4, 'GAS', 'gas'], [16, 'DRIFT', 'drift'], [32, 'BOOST', 'boost']];
const FIGHT_ACTIONS = [[16, 'LIGHT', 'light'], [32, 'HEAVY', 'heavy'], [64, 'SPECIAL', 'special'], [128, 'GUARD', 'guard'], [256, 'DASH', 'dash'], [512, 'THROW', 'throw'], [1024, 'SUPER', 'super']];

export default function TouchControls({ racing = false, onChange, onSteer, disabled = false, resetKey = 0, meter = 0, feedback = '' }) {
  const sources = useRef(new Map()), padPointer = useRef(null), engaged = useRef(false);
  const callback = useRef(onChange); callback.current = onChange;
  const steeringCallback = useRef(onSteer); steeringCallback.current = onSteer;
  const options = useRef({});
  const [autoGas, setAutoGas] = useState(true), [available, setAvailable] = useState(false);
  const [mask, setMask] = useState(0), [stick, setStick] = useState({ x: 0, y: 0 });
  options.current = { racing, autoGas, disabled, available };

  function emit() {
    const o = options.current;
    const value = o.disabled || !o.available ? 0 : touchMask(sources.current, { ...o, engaged: engaged.current });
    setMask(value); callback.current(value);
  }
  function clear() {
    sources.current.clear(); padPointer.current = null; engaged.current = false;
    steeringCallback.current?.(0,false);
    setStick({ x: 0, y: 0 }); setMask(0); callback.current(0);
  }
  useEffect(() => {
    const query = matchMedia('(any-pointer: coarse), (max-width: 900px)');
    const change = () => { clear(); setAvailable(query.matches); };
    change(); query.addEventListener('change', change);
    const hidden = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear); window.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', hidden);
    try { const saved = localStorage.getItem('terminl:race-auto-gas'); if (saved !== null) setAutoGas(saved === 'true'); } catch {}
    return () => {
      query.removeEventListener('change', change); window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear); document.removeEventListener('visibilitychange', hidden);
      steeringCallback.current?.(0,false); callback.current(0);
    };
    // Event handlers use current refs; changing a callback must not release held fingers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Reset the pointer ownership as well as the mask on pause/rematch/settings changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { clear(); }, [disabled, resetKey]);

  function press(e, bit) {
    if (options.current.disabled || !options.current.available || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    sources.current.set(e.pointerId, bit); engaged.current = true; emit();
  }
  function release(e) {
    if (!sources.current.has(e.pointerId)) return;
    sources.current.delete(e.pointerId);
    if (padPointer.current === e.pointerId) { padPointer.current = null; steeringCallback.current?.(0,false); setStick({ x: 0, y: 0 }); }
    // OS interruption must stop auto-gas too. Normal finger lift keeps cruise enabled.
    if (e.type === 'pointercancel' || e.type === 'lostpointercapture') { clear(); return; }
    emit();
  }
  const releases = { onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release };
  function move(e) {
    if (padPointer.current !== e.pointerId || !sources.current.has(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect(), radius = Math.min(r.width, r.height) * .38;
    let x = (e.clientX - r.left - r.width / 2) / radius;
    let y = racing ? 0 : (e.clientY - r.top - r.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    setStick({ x, y });
    if (racing) steeringCallback.current?.(raceSteeringTarget(x),true);
    sources.current.set(e.pointerId, directionMask(x, y, racing)); emit();
  }
  function key(e, bit) {
    if (![' ', 'Enter'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (disabled) return;
    if (e.type === 'keydown') { sources.current.set(`key:${bit}`, bit); engaged.current = true; }
    else sources.current.delete(`key:${bit}`);
    emit();
  }
  const action = ([bit, label, tone]) => <button type="button" key={bit} className={`${s.action} ${s[tone] || ''}`}
    aria-label={label} aria-pressed={!!(mask & bit)} disabled={disabled}
    onPointerDown={e => press(e, bit)} {...releases} onKeyDown={e => key(e, bit)} onKeyUp={e => key(e, bit)}
    onBlur={() => { if (sources.current.delete(`key:${bit}`)) emit(); }}>{label}<small>{!racing && bit===1024 ? meter>=1000?'READY':`${Math.floor(meter/10)}% / 100%` : !racing && bit===64 ? mask&8?'UPPERCUT':mask&3?'DIRECTIONAL':'↓ UPPERCUT' : !racing && bit===32 && mask&8?'LOW SWEEP' : racing && bit===32?'BOOST + GAS':''}</small></button>;

  return <section className={`${s.dock} ${racing ? s.racing : s.fighting}`} aria-label={racing ? 'Touch driving controls' : 'Touch fighting controls'}
    data-input={mask} onContextMenu={e => e.preventDefault()}>
    <div className={s.tools}>
      <span>{racing ? 'SLIDE TO STEER' : 'SLIDE · ↑ JUMP · ↓ CROUCH'}</span>
      {racing ? <><button type="button" aria-pressed={autoGas} disabled={disabled} onClick={() => {
        const next = !autoGas; setAutoGas(next); options.current.autoGas = next;
        engaged.current = next; emit(); try { localStorage.setItem('terminl:race-auto-gas', String(next)); } catch {}
      }}>AUTO GAS {autoGas ? 'ON' : 'OFF'}</button>{action([64, 'RESET', 'reset'])}</> : <span>MOVE + ATTACK TO COMBINE</span>}
    </div>
    <div className={s.deck}>
      <div className={s.pad} role="group" aria-label={racing ? 'Steering thumb pad' : 'Movement thumb pad'} aria-disabled={disabled}
        onPointerDown={e => { if (padPointer.current !== null || disabled) return; press(e, 0); if (!sources.current.has(e.pointerId)) return; padPointer.current = e.pointerId; move(e); }}
        onPointerMove={move} {...releases}>
        <span className={s.left}>‹</span><span className={s.right}>›</span>
        {!racing && <><span className={s.up}>↑</span><span className={s.down}>↓</span></>}
        <i className={s.knob} style={{ transform: `translate(calc(-50% + ${stick.x * 32}px), calc(-50% + ${stick.y * 32}px))` }} />
      </div>
      <div className={s.actions}>{(racing ? RACE_ACTIONS : FIGHT_ACTIONS).map(action)}</div>
    </div>
    <p className={s.hint}>{feedback || (racing ? autoGas ? 'Touch the pad to launch. Brake overrides auto-gas; hold to reverse.' : 'Hold GAS + steer. BOOST includes gas. Hold BRAKE to reverse.' : '↓ + SPECIAL uppercuts. Toward rival + SPECIAL lunges. SUPER needs 100%.')}</p>
  </section>;
}
