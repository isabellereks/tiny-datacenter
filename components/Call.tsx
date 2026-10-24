'use client';

import { useEffect, useState } from 'react';
import type { Action } from '@/lib/game/actions';
import { RING_MS, type Call as CallT } from '@/lib/game/calls';

/** Their words, typed out as they say them. */
function useTyped(text: string, on: boolean, ms = 28) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setN(k => (k >= text.length ? (window.clearInterval(id), k) : k + 1)), ms);
    return () => window.clearInterval(id);
  }, [text, on, ms]);
  return text.slice(0, n);
}

/** A ringing phone, then the caller live on air: same lower-third look as the news. */
export function Call({ call, dispatch, font }: { call: CallT; dispatch: (a: Action) => void; font: string }) {
  const said = useTyped(call.line, call.answered);
  const [secs, setSecs] = useState(0);

  // unanswered calls go to voicemail
  useEffect(() => {
    if (call.answered) return;
    const left = Math.max(0, RING_MS - (Date.now() - call.t0));
    const id = window.setTimeout(() => dispatch({ type: 'call', act: 'missed' }), left);
    return () => window.clearTimeout(id);
  }, [call.id, call.answered, call.t0, dispatch]);

  useEffect(() => {
    if (!call.answered) return;
    const id = window.setInterval(() => setSecs(k => k + 1), 1000);
    return () => window.clearInterval(id);
  }, [call.answered]);

  return (
    <div className={`call ${font}${call.answered ? ' on' : ' ringing'}`} role="alertdialog" aria-label={`Call from ${call.who}`}>
      <div className="call-tag">
        <span className="dot" />
        {call.answered ? `On the line  0:${String(secs).padStart(2, '0')}` : 'Incoming call'}
      </div>
      <div className="call-who">
        <i className={`caller ${call.mood}`} aria-hidden="true" />
        <b>{call.who}</b>
      </div>
      {call.answered ? (
        <div className="call-line" aria-label={call.line}>
          <span>{said}</span>{said.length < call.line.length && <i className="caret" />}
        </div>
      ) : null}
      <div className="call-foot">
        {call.answered ? (
          <button className="call-btn" onClick={() => dispatch({ type: 'call', act: 'hangup' })}>Hang up</button>
        ) : (
          <>
            <button className="call-btn decline" onClick={() => dispatch({ type: 'call', act: 'decline' })}>Decline</button>
            <button className="call-btn answer" onClick={() => dispatch({ type: 'call', act: 'answer' })}>Answer</button>
          </>
        )}
      </div>
    </div>
  );
}
